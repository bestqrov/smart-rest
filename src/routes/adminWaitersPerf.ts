/**
 * Waiter Performance Report
 *
 * GET /api/admin/waiters-performance
 *   Query params:
 *     period  — 'week' | 'month' (default: 'week')
 *     from    — ISO date string (overrides period if provided)
 *     to      — ISO date string (default: now)
 *
 * Response per waiter:
 *   id, name, role, shiftStatus
 *   closedOrders   — count of CLOSED_PRINTED + CLOSED_VIRTUAL orders in period
 *   totalRevenue   — sum of totalPrice on those orders
 *   totalHours     — sum of clock-in/clock-out durations in period
 *   avgOrdersPerHour — closedOrders / totalHours (null if no shifts)
 *
 * Multi-tenancy: scoped to req.admin.cafeId.
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/api/admin/waiters-performance', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    // ── Date range ────────────────────────────────────────────────────────────
    const now    = new Date()
    let fromDate: Date

    if (req.query['from']) {
      fromDate = new Date(req.query['from'] as string)
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid "from" date' })
      }
    } else {
      const period = (req.query['period'] as string) ?? 'week'
      fromDate = new Date(now)
      if (period === 'month') fromDate.setMonth(fromDate.getMonth() - 1)
      else                    fromDate.setDate(fromDate.getDate() - 7)
    }

    const toDate = req.query['to'] ? new Date(req.query['to'] as string) : now

    // ── All staff for this cafe ───────────────────────────────────────────────
    const allStaff = await prisma.staff.findMany({
      where: { cafeId, isActive: true },
      select: { id: true, name: true, role: true, shiftStatus: true },
      orderBy: { name: 'asc' },
    })

    // ── Aggregate closed orders per waiter ────────────────────────────────────
    const orderStats = await prisma.order.groupBy({
      by: ['assignedWaiterId'],
      where: {
        cafeId,
        assignedWaiterId: { not: null },
        billStatus: { in: ['CLOSED_PRINTED', 'CLOSED_VIRTUAL'] },
        createdAt: { gte: fromDate, lte: toDate },
      },
      _sum:   { totalPrice: true },
      _count: { id: true },
    })

    // Index by staffId for fast lookup
    const statsByStaff = new Map<string, { count: number; revenue: number }>()
    for (const row of orderStats) {
      if (row.assignedWaiterId) {
        statsByStaff.set(row.assignedWaiterId, {
          count:   row._count.id,
          revenue: row._sum.totalPrice ?? 0,
        })
      }
    }

    // ── Aggregate shift hours per waiter ──────────────────────────────────────
    const shifts = await prisma.waiterShift.findMany({
      where: {
        cafeId,
        clockIn: { gte: fromDate, lte: toDate },
      },
      select: { staffId: true, clockIn: true, clockOut: true },
    })

    const hoursByStaff = new Map<string, number>()
    for (const s of shifts) {
      const end    = s.clockOut ?? toDate
      const hours  = (end.getTime() - s.clockIn.getTime()) / 3_600_000
      hoursByStaff.set(s.staffId, (hoursByStaff.get(s.staffId) ?? 0) + hours)
    }

    // ── Build response ────────────────────────────────────────────────────────
    const report = allStaff.map(w => {
      const stats      = statsByStaff.get(w.id)
      const closedOrders  = stats?.count   ?? 0
      const totalRevenue  = stats?.revenue ?? 0
      const totalHours    = parseFloat((hoursByStaff.get(w.id) ?? 0).toFixed(2))
      const avgOrdersPerHour = totalHours > 0
        ? parseFloat((closedOrders / totalHours).toFixed(2))
        : null

      return {
        id:              w.id,
        name:            w.name,
        role:            w.role,
        shiftStatus:     w.shiftStatus,
        closedOrders,
        totalRevenue:    parseFloat(totalRevenue.toFixed(2)),
        totalHours,
        avgOrdersPerHour,
      }
    })

    // Sort by totalRevenue desc
    report.sort((a, b) => b.totalRevenue - a.totalRevenue)

    return res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      report,
    })
  } catch (err) {
    logger.error({ msg: 'waiters-performance error', err })
    return res.status(500).json({ error: 'Failed to compute waiter performance' })
  }
})

export default router
