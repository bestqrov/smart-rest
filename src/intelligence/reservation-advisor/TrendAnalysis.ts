// ─── Smart Intelligence Reservation Advisor v1 — Trend Analysis (K63) ──────
// Reuses fetchReservations/groupByDayOfWeek — no new query.

import { fetchReservations, groupByDayOfWeek } from './ReservationMetrics'
import type { ReservationTrend } from './types'

export async function analyzeReservationTrend(tenantId: string, windowDays = 90): Promise<ReservationTrend> {
  const rows = await fetchReservations(tenantId, windowDays)
  const midpoint = Date.now() - (windowDays / 2) * 24 * 60 * 60 * 1000

  const recentCount = rows.filter(r => r.date.getTime() >= midpoint).length
  const priorCount  = rows.filter(r => r.date.getTime() < midpoint).length
  const changePct   = priorCount > 0 ? Math.round(((recentCount - priorCount) / priorCount) * 100) : 0

  const byDayOfWeek = [...groupByDayOfWeek(rows).entries()]
    .map(([dayOfWeek, list]) => ({ dayOfWeek, count: list.length }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return { windowDays, recentCount, priorCount, changePct, byDayOfWeek }
}
