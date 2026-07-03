// ─── Smart Intelligence Financial Advisor v1 — Revenue Analysis (K65) ──────
// Reuses fetchRevenue — no new query. Same recent-half-vs-prior-half trend
// idiom K63's TrendAnalysis already uses.

import { fetchRevenue, dateKey } from './FinancialMetrics'
import type { RevenueTrend } from './types'

export async function analyzeRevenueTrend(tenantId: string, windowDays = 30): Promise<RevenueTrend> {
  const rows = await fetchRevenue(tenantId, windowDays)
  const midpoint = Date.now() - (windowDays / 2) * 24 * 60 * 60 * 1000

  const recentTotal = rows.filter(r => r.createdAt.getTime() >= midpoint).reduce((sum, r) => sum + r.totalPrice, 0)
  const priorTotal   = rows.filter(r => r.createdAt.getTime() < midpoint).reduce((sum, r) => sum + r.totalPrice, 0)
  const changePct    = priorTotal > 0 ? Math.round(((recentTotal - priorTotal) / priorTotal) * 100) : 0

  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = dateKey(row.createdAt)
    byDay.set(key, (byDay.get(key) ?? 0) + row.totalPrice)
  }

  const dailyTotals = [...byDay.entries()]
    .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    windowDays, recentTotal: Math.round(recentTotal * 100) / 100, priorTotal: Math.round(priorTotal * 100) / 100,
    changePct, dailyTotals,
  }
}
