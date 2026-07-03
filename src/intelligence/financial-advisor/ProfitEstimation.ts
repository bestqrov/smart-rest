// ─── Smart Intelligence Financial Advisor v1 — Profit Estimation (K65) ─────
// Rule-based: revenue minus expenses over the same window. Reuses
// fetchRevenue/fetchExpenses — no new query.

import { fetchRevenue, fetchExpenses } from './FinancialMetrics'
import type { ProfitEstimate } from './types'

export async function estimateProfit(tenantId: string, windowDays = 30): Promise<ProfitEstimate> {
  const [revenueRows, expenseRows] = await Promise.all([
    fetchRevenue(tenantId, windowDays),
    fetchExpenses(tenantId, windowDays),
  ])

  const totalRevenue  = revenueRows.reduce((sum, r) => sum + r.totalPrice, 0)
  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0)
  const estimatedProfit = totalRevenue - totalExpenses

  return {
    windowDays,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    profitMarginPct: totalRevenue > 0 ? Math.round((estimatedProfit / totalRevenue) * 1000) / 10 : 0,
  }
}
