// ─── Smart Intelligence Reservation Advisor v1 — Peak Prediction (K63) ─────
// Rule-based, not ML: buckets historical reservations by (day-of-week,
// hour) and treats the highest-frequency buckets as predicted peaks for
// the coming week. Reuses fetchReservations — no new query.

import { fetchReservations } from './ReservationMetrics'
import type { PeakPrediction } from './types'

export async function predictPeakSlots(tenantId: string, windowDays = 90, limit = 5): Promise<PeakPrediction[]> {
  const rows = await fetchReservations(tenantId, windowDays)

  const counts = new Map<string, { dayOfWeek: number; hour: number; count: number }>()
  for (const row of rows) {
    const dayOfWeek = row.date.getUTCDay()
    const hour = row.date.getUTCHours()
    const key = `${dayOfWeek}:${hour}`
    const entry = counts.get(key) ?? { dayOfWeek, hour, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ dayOfWeek, hour, count }) => ({ dayOfWeek, hour, historicalCount: count }))
}
