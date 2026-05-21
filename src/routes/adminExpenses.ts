/**
 * Expense Management
 *
 * GET    /api/admin/expenses         — list with date range filter
 * POST   /api/admin/expenses         — create
 * DELETE /api/admin/expenses/:id     — delete
 * GET    /api/admin/financials/report — income vs expense summary by period
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// ─── GET /api/admin/expenses ──────────────────────────────────────────────────

router.get('/api/admin/expenses', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { from, to } = req.query as Record<string, string>

    const fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30))
    const toDate   = to   ? new Date(to)   : new Date()

    const expenses = await prisma.expense.findMany({
      where:   { cafeId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'desc' },
    })

    return res.json({ expenses })
  } catch (err) {
    logger.error({ msg: 'GET expenses error', err })
    return res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

// ─── POST /api/admin/expenses ─────────────────────────────────────────────────

router.post('/api/admin/expenses', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { amount, category, description, date } = req.body as {
      amount:      number
      category:    string
      description: string
      date?:       string
    }

    if (!amount || amount <= 0)   return res.status(400).json({ error: 'amount must be positive' })
    if (!category?.trim())        return res.status(400).json({ error: 'category is required' })
    if (!description?.trim())     return res.status(400).json({ error: 'description is required' })

    const expense = await prisma.expense.create({
      data: {
        cafeId,
        amount:      Number(amount),
        category:    category.trim(),
        description: description.trim(),
        date:        date ? new Date(date) : new Date(),
      },
    })

    return res.status(201).json(expense)
  } catch (err) {
    logger.error({ msg: 'POST expense error', err })
    return res.status(500).json({ error: 'Failed to create expense' })
  }
})

// ─── DELETE /api/admin/expenses/:id ──────────────────────────────────────────

router.delete('/api/admin/expenses/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params.id as string

    const existing = await prisma.expense.findUnique({ where: { id }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) return res.status(404).json({ error: 'Not found' })

    await prisma.expense.delete({ where: { id } })
    return res.json({ success: true })
  } catch (err) {
    logger.error({ msg: 'DELETE expense error', err })
    return res.status(500).json({ error: 'Failed to delete expense' })
  }
})

// ─── GET /api/admin/financials/report ────────────────────────────────────────
//
// Returns: income (cash/tpe breakdown), expenses, netProfit, daily breakdown

router.get('/api/admin/financials/report', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { period = 'month', from, to } = req.query as Record<string, string>

    const now = new Date()
    let fromDate: Date
    if (from) {
      fromDate = new Date(from)
    } else if (period === 'today') {
      fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - 7)
    } else {
      fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 1)
    }
    const toDate = to ? new Date(to) : now

    // ── Income from closed orders ─────────────────────────────────────────────
    const orders = await prisma.order.findMany({
      where: {
        cafeId,
        billStatus: { in: ['CLOSED_PRINTED', 'CLOSED_VIRTUAL'] },
        createdAt:  { gte: fromDate, lte: toDate },
      },
      select: { totalPrice: true, paymentMethod: true, createdAt: true },
    })

    let incomeCash = 0, incomeCard = 0
    const dailyIncome: Record<string, number> = {}

    for (const o of orders) {
      if (o.paymentMethod === 'CASH')   incomeCash += o.totalPrice
      else                              incomeCard += o.totalPrice
      const day = o.createdAt.toISOString().slice(0, 10)
      dailyIncome[day] = (dailyIncome[day] ?? 0) + o.totalPrice
    }

    // ── Expenses ──────────────────────────────────────────────────────────────
    const expenses = await prisma.expense.findMany({
      where: { cafeId, date: { gte: fromDate, lte: toDate } },
      select: { amount: true, category: true, date: true },
    })

    let totalExpenses = 0
    const byCategory: Record<string, number> = {}
    const dailyExpense: Record<string, number> = {}

    for (const e of expenses) {
      totalExpenses += e.amount
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
      const day = e.date.toISOString().slice(0, 10)
      dailyExpense[day] = (dailyExpense[day] ?? 0) + e.amount
    }

    // ── Merge daily data into chart series ────────────────────────────────────
    const allDays = new Set([...Object.keys(dailyIncome), ...Object.keys(dailyExpense)])
    const chart = Array.from(allDays).sort().map(day => ({
      date:    day,
      income:  parseFloat((dailyIncome[day] ?? 0).toFixed(2)),
      expense: parseFloat((dailyExpense[day] ?? 0).toFixed(2)),
      profit:  parseFloat(((dailyIncome[day] ?? 0) - (dailyExpense[day] ?? 0)).toFixed(2)),
    }))

    const totalIncome = incomeCash + incomeCard
    return res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      income: {
        total: parseFloat(totalIncome.toFixed(2)),
        cash:  parseFloat(incomeCash.toFixed(2)),
        card:  parseFloat(incomeCard.toFixed(2)),
      },
      expenses: {
        total:      parseFloat(totalExpenses.toFixed(2)),
        byCategory,
      },
      netProfit: parseFloat((totalIncome - totalExpenses).toFixed(2)),
      chart,
    })
  } catch (err) {
    logger.error({ msg: 'financials/report error', err })
    return res.status(500).json({ error: 'Failed to generate report' })
  }
})

export default router
