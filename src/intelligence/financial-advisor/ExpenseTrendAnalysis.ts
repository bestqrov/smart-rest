// ─── Smart Intelligence Financial Advisor v1 — Expense Trend Analysis (K65) ─
// Reuses fetchExpenses — no new query. Same recent-half-vs-prior-half
// trend idiom as RevenueAnalysis.

import { fetchExpenses } from './FinancialMetrics'
import type { ExpenseTrend } from './types'

export async function analyzeExpenseTrend(tenantId: string, windowDays = 30): Promise<ExpenseTrend> {
  const rows = await fetchExpenses(tenantId, windowDays)
  const midpoint = Date.now() - (windowDays / 2) * 24 * 60 * 60 * 1000

  const recentTotal = rows.filter(r => r.date.getTime() >= midpoint).reduce((sum, r) => sum + r.amount, 0)
  const priorTotal   = rows.filter(r => r.date.getTime() < midpoint).reduce((sum, r) => sum + r.amount, 0)
  const changePct    = priorTotal > 0 ? Math.round(((recentTotal - priorTotal) / priorTotal) * 100) : 0

  const byCategory = new Map<string, number>()
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount)
  }

  return {
    windowDays, recentTotal: Math.round(recentTotal * 100) / 100, priorTotal: Math.round(priorTotal * 100) / 100,
    changePct,
    byCategory: [...byCategory.entries()]
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
  }
}
