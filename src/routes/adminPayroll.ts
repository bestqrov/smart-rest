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
 *  - approved:       whether a PayrollApproval already exists for this exact period
 *
 * PATCH /api/admin/payroll/:staffId/rate
 *   body: { dailyRate: number }
 *   Sets the daily rate for payroll calculation.
 *
 * POST /api/admin/payroll/:staffId/approve
 *   body: { from: ISO string, to: ISO string }  — must match a period the
 *   admin actually viewed (returned by GET above)
 *   Persists the approval (PayrollApproval + a linked Expense(category:'wages')
 *   so it flows into existing financial reporting), server-recomputing the
 *   amount rather than trusting the client. Duplicate-safe via a DB unique
 *   constraint on (staffId, periodFrom, periodTo).
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { computePayroll } from '../services/payroll'

const router = express.Router()

function resolvePeriod(query: Request['query']): { from: Date; to: Date } {
  const now = new Date()
  const from = query.from ? new Date(query.from as string) : new Date(now.getFullYear(), now.getMonth(), 1)
  const to   = query.to   ? new Date(query.to   as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { from, to }
}

// ─── GET /api/admin/payroll ───────────────────────────────────────────────────

router.get('/api/admin/payroll', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { from, to } = resolvePeriod(req.query)

    const [lines, approvals] = await Promise.all([
      computePayroll(cafeId, from, to),
      prisma.payrollApproval.findMany({
        where:  { cafeId, periodFrom: from, periodTo: to },
        select: { staffId: true },
      }),
    ])
    const approvedIds = new Set(approvals.map(a => a.staffId))

    const payroll = lines.map(line => ({ ...line, approved: approvedIds.has(line.id) }))

    return res.json({ payroll, period: { from: from.toISOString(), to: to.toISOString() } })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/payroll error', err })
    return res.status(500).json({ error: 'Failed to compute payroll' })
  }
})

// ─── POST /api/admin/payroll/:staffId/approve ────────────────────────────────

router.post('/api/admin/payroll/:staffId/approve', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const adminId = req.admin!.userId
    const staffId = String(req.params.staffId)
    const { from: fromStr, to: toStr } = req.body as { from?: string; to?: string }

    if (!fromStr || !toStr) return res.status(400).json({ error: 'from and to are required' })
    const from = new Date(fromStr)
    const to   = new Date(toStr)
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: 'from/to must be valid dates' })
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { cafeId: true, name: true } })
    if (!staff || staff.cafeId !== cafeId) return res.status(404).json({ error: 'Staff not found' })

    // Server-authoritative recompute — never trust a client-sent amount.
    const [line] = await computePayroll(cafeId, from, to, staffId)
    if (!line) return res.status(404).json({ error: 'No payroll data for this staff member/period' })

    try {
      const approval = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            cafeId,
            amount:      line.netSalary,
            category:    'wages',
            description: `Payroll — ${staff.name} (${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)})`,
            date:        new Date(),
          },
        })
        return tx.payrollApproval.create({
          data: {
            cafeId, staffId,
            periodFrom: from, periodTo: to,
            netSalary:  line.netSalary,
            expenseId:  expense.id,
            approvedBy: adminId,
          },
        })
      })

      logger.info({ msg: 'Payroll approved', cafeId, staffId, netSalary: line.netSalary, adminId })
      return res.status(201).json({ ok: true, approval })
    } catch (err: any) {
      // Unique constraint on (staffId, periodFrom, periodTo) — already approved.
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Already approved for this period' })
      }
      throw err
    }
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/payroll/:staffId/approve error', err })
    return res.status(500).json({ error: 'Failed to approve payment' })
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
