/**
 * GET /api/admin/payroll?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns payroll summary per staff member for the given period:
 *  - attendanceDays: distinct calendar days with at least one WaiterShift clockIn
 *  - absenceDays:    workingDays - attendanceDays
 *  - lateDays:       shifts where clockIn > 09:30 (heuristic)
 *  - totalHours:     sum of all shift durations
 *  - baseSalary:     attendanceDays × dailyRate
 *  - commissions:    sum of totalCommission on COMPLETED orders in period
 *  - netSalary:      baseSalary + commissions - deductions
 *
 * PATCH /api/admin/payroll/:staffId/rate
 *   body: { dailyRate: number }
 *   Sets the daily rate for payroll calculation.
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// ─── GET /api/admin/payroll ───────────────────────────────────────────────────

router.get('/api/admin/payroll', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    // Default period: current month
    const now   = new Date()
    const from  = req.query.from ? new Date(req.query.from as string) : new Date(now.getFullYear(), now.getMonth(), 1)
    const to    = req.query.to   ? new Date(req.query.to   as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Working days in period (Mon–Sat, excluding Sunday as rest day) — approximate
    function countWorkingDays(start: Date, end: Date): number {
      let count = 0
      const cur = new Date(start)
      cur.setHours(0, 0, 0, 0)
      while (cur <= end) {
        if (cur.getDay() !== 0) count++ // skip Sunday
        cur.setDate(cur.getDate() + 1)
      }
      return count
    }
    const workingDays = countWorkingDays(from, to)

    const [allStaff, shifts, orders] = await Promise.all([
      prisma.staff.findMany({
        where:  { cafeId, isActive: true },
        select: { id: true, name: true, role: true, roles: true, dailyRate: true, shiftStatus: true },
      }),
      prisma.waiterShift.findMany({
        where: { cafeId, clockIn: { gte: from, lte: to } },
        select: { staffId: true, clockIn: true, clockOut: true },
      }),
      prisma.order.findMany({
        where:  { cafeId, status: 'COMPLETED', assignedWaiterId: { not: null }, createdAt: { gte: from, lte: to } },
        select: { assignedWaiterId: true, totalCommission: true },
      }),
    ])

    // Build payroll per staff
    const payroll = allStaff.map(member => {
      const memberShifts = shifts.filter(s => s.staffId === member.id)

      // Distinct calendar days with attendance
      const attendedDays = new Set(
        memberShifts.map(s => {
          const d = new Date(s.clockIn)
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        })
      )
      const attendanceDays = attendedDays.size
      const absenceDays    = Math.max(0, workingDays - attendanceDays)

      // Late arrivals: clockIn hour >= 10 (simple heuristic)
      const lateDays = memberShifts.filter(s => new Date(s.clockIn).getHours() >= 10).length

      // Total hours worked
      const totalHours = memberShifts.reduce((sum, s) => {
        const out = s.clockOut ? new Date(s.clockOut).getTime() : Date.now()
        return sum + (out - new Date(s.clockIn).getTime()) / 3600000
      }, 0)

      const baseSalary  = attendanceDays * member.dailyRate
      const commissions = orders
        .filter(o => o.assignedWaiterId === member.id)
        .reduce((sum, o) => sum + (o.totalCommission ?? 0), 0)

      return {
        id:           member.id,
        name:         member.name,
        role:         member.role,
        roles:        member.roles,
        shiftStatus:  member.shiftStatus,
        dailyRate:    member.dailyRate,
        attendanceDays,
        absenceDays,
        lateDays,
        totalHours:   Math.round(totalHours * 10) / 10,
        baseSalary,
        commissions:  Math.round(commissions * 100) / 100,
        deductions:   0,
        netSalary:    Math.round((baseSalary + commissions) * 100) / 100,
        workingDays,
      }
    })

    return res.json({ payroll, period: { from: from.toISOString(), to: to.toISOString() } })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/payroll error', err })
    return res.status(500).json({ error: 'Failed to compute payroll' })
  }
})

// ─── PATCH /api/admin/payroll/:staffId/rate ───────────────────────────────────

router.patch('/api/admin/payroll/:staffId/rate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const staffId = String(req.params.staffId)
    const { dailyRate } = req.body as { dailyRate?: number }

    if (dailyRate === undefined || typeof dailyRate !== 'number' || dailyRate < 0) {
      return res.status(400).json({ error: 'dailyRate must be a non-negative number' })
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { cafeId: true } })
    if (!staff || staff.cafeId !== cafeId) return res.status(404).json({ error: 'Staff not found' })

    await prisma.staff.update({ where: { id: staffId }, data: { dailyRate } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/payroll rate error', err })
    return res.status(500).json({ error: 'Failed to update daily rate' })
  }
})

export default router
