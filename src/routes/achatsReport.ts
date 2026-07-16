/**
 * GET /api/admin/achats/report?period=week|month|custom&from=&to=
 *
 * Consolidated purchases report: accounts-payable aging, spend trend,
 * top suppliers, upcoming due invoices, and the pending pipeline
 * (requisitions awaiting approval/order, POs awaiting receipt).
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requireInventory } from './inventoryAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/api/admin/achats/report', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { period = 'month', from, to } = req.query as Record<string, string>

    const now = new Date()
    let fromDate: Date
    if (from) {
      fromDate = new Date(from)
    } else if (period === 'week') {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - 7)
    } else {
      fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 1)
    }
    const toDate = to ? new Date(to) : now

    // ── Accounts payable aging (all unpaid/partial/overdue invoices, any date) ──
    const outstanding = await prisma.supplierInvoice.findMany({
      where:  { cafeId, status: { in: ['unpaid', 'partial', 'overdue'] } },
      select: { amount: true, amountPaid: true, dueDate: true },
    })

    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inv of outstanding) {
      const remaining = inv.amount - inv.amountPaid
      const dueDate = inv.dueDate ?? now
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
      if (daysPastDue <= 30)      aging['0-30']  += remaining
      else if (daysPastDue <= 60) aging['31-60'] += remaining
      else if (daysPastDue <= 90) aging['61-90'] += remaining
      else                        aging['90+']   += remaining
    }
    const agingTotal = Object.values(aging).reduce((s, v) => s + v, 0)

    // ── Spend trend (invoices issued within the period, by day) ─────────────────
    const periodInvoices = await prisma.supplierInvoice.findMany({
      where:  { cafeId, issueDate: { gte: fromDate, lte: toDate } },
      select: { amount: true, issueDate: true, supplierName: true },
    })

    const dailySpend: Record<string, number> = {}
    const bySupplier: Record<string, number> = {}
    let spendThisPeriod = 0
    for (const inv of periodInvoices) {
      spendThisPeriod += inv.amount
      const day = inv.issueDate.toISOString().slice(0, 10)
      dailySpend[day] = (dailySpend[day] ?? 0) + inv.amount
      bySupplier[inv.supplierName] = (bySupplier[inv.supplierName] ?? 0) + inv.amount
    }
    const spendTrend = Object.keys(dailySpend).sort().map(date => ({
      date, spend: parseFloat(dailySpend[date].toFixed(2)),
    }))

    const topSuppliers = Object.entries(bySupplier)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([supplierName, total]) => ({ supplierName, total: parseFloat(total.toFixed(2)) }))

    // ── Upcoming due (next 7 days, not yet paid) ─────────────────────────────────
    const sevenDaysOut = new Date(now); sevenDaysOut.setDate(now.getDate() + 7)
    const upcomingDue = await prisma.supplierInvoice.findMany({
      where: {
        cafeId,
        status:  { in: ['unpaid', 'partial'] },
        dueDate: { gte: now, lte: sevenDaysOut },
      },
      select: { id: true, supplierName: true, amount: true, amountPaid: true, currency: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    })

    // ── Pending pipeline ──────────────────────────────────────────────────────
    const [pendingRequisitions, orderedPOs] = await Promise.all([
      prisma.purchaseRequisition.count({ where: { cafeId, status: 'pending' } }),
      prisma.purchaseOrder.count({ where: { cafeId, status: 'ordered' } }),
    ])

    return res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      aging: { ...aging, total: parseFloat(agingTotal.toFixed(2)) },
      spendTrend,
      topSuppliers,
      upcomingDue,
      pending: { pendingRequisitions, orderedPOs },
      totals: {
        unpaidTotal:     parseFloat(agingTotal.toFixed(2)),
        spendThisPeriod: parseFloat(spendThisPeriod.toFixed(2)),
      },
    })
  } catch (err) {
    logger.error({ msg: 'achats/report error', err })
    return res.status(500).json({ error: 'Failed to generate report' })
  }
})

export default router
