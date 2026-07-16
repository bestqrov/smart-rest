// ─── Smart Intelligence Financial Advisor v1 — Cash Flow Overview (K65) ────
// Reuses fetchRevenue/fetchExpenses — no new query. Combines them into a
// daily net-cash-flow view.

import { fetchRevenue, fetchExpenses, dateKey } from './FinancialMetrics'
import type { CashFlowOverview } from './types'

export async function getCashFlowOverview(tenantId: string, windowDays = 30): Promise<CashFlowOverview> {
  const [revenueRows, expenseRows] = await Promise.all([
    fetchRevenue(tenantId, windowDays),
    fetchExpenses(tenantId, windowDays),
  ])

  const revenueByDay = new Map<string, number>()
  for (const row of revenueRows) {
    const key = dateKey(row.createdAt)
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + row.totalPrice)
  }

  const expensesByDay = new Map<string, number>()
  for (const row of expenseRows) {
    const key = dateKey(row.date)
    expensesByDay.set(key, (expensesByDay.get(key) ?? 0) + row.amount)
  }

  const allDates = new Set([...revenueByDay.keys(), ...expensesByDay.keys()])
  const days = [...allDates].sort().map(date => {
    const revenue = Math.round((revenueByDay.get(date) ?? 0) * 100) / 100
    const expenses = Math.round((expensesByDay.get(date) ?? 0) * 100) / 100
    return { date, revenue, expenses, net: Math.round((revenue - expenses) * 100) / 100 }
  })

  return {
    windowDays,
    positiveDays: days.filter(d => d.net > 0).length,
    negativeDays: days.filter(d => d.net < 0).length,
    netTotal: Math.round(days.reduce((sum, d) => sum + d.net, 0) * 100) / 100,
    days,
  }
}
