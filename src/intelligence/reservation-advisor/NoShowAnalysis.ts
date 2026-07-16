// ─── Smart Intelligence Reservation Advisor v1 — No-Show Analysis (K63) ────
// Verified K52's reservationInsightRule already computes one overall
// no-show rate, event-triggered off ReservationNoShow. This computes a
// day-of-week breakdown from the same shared row set instead of a second
// identical total/noShows count — reuses fetchReservations/
// groupByDayOfWeek, no new query.

import { fetchReservations, groupByDayOfWeek } from './ReservationMetrics'
import type { NoShowBreakdown } from './types'

export async function analyzeNoShows(tenantId: string, windowDays = 90): Promise<NoShowBreakdown> {
  const rows = await fetchReservations(tenantId, windowDays)
  const total = rows.length
  const noShows = rows.filter(r => r.status === 'NO_SHOW').length

  const byDayOfWeek = [...groupByDayOfWeek(rows).entries()]
    .map(([dayOfWeek, list]) => {
      const dayNoShows = list.filter(r => r.status === 'NO_SHOW').length
      return { dayOfWeek, count: list.length, ratePct: list.length > 0 ? Math.round((dayNoShows / list.length) * 100) : 0 }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return { total, noShows, ratePct: total > 0 ? Math.round((noShows / total) * 100) : 0, byDayOfWeek }
}
