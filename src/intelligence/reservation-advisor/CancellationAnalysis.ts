// ─── Smart Intelligence Reservation Advisor v1 — Cancellation Analysis (K63) ─
// Same shape as NoShowAnalysis, different status filter — reuses
// fetchReservations/groupByDayOfWeek, no new query.

import { fetchReservations, groupByDayOfWeek } from './ReservationMetrics'
import type { CancellationBreakdown } from './types'

export async function analyzeCancellations(tenantId: string, windowDays = 90): Promise<CancellationBreakdown> {
  const rows = await fetchReservations(tenantId, windowDays)
  const total = rows.length
  const cancellations = rows.filter(r => r.status === 'CANCELLED').length

  const byDayOfWeek = [...groupByDayOfWeek(rows).entries()]
    .map(([dayOfWeek, list]) => {
      const dayCancellations = list.filter(r => r.status === 'CANCELLED').length
      return { dayOfWeek, count: list.length, ratePct: list.length > 0 ? Math.round((dayCancellations / list.length) * 100) : 0 }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return { total, cancellations, ratePct: total > 0 ? Math.round((cancellations / total) * 100) : 0, byDayOfWeek }
}
