// ─── Smart Intelligence Reservation Advisor v1 — Low Occupancy (K63) ───────
// Rule-based: (day-of-week, hour) buckets with reservation volume in the
// bottom band relative to the tenant's own average. Reuses
// fetchReservations — same bucketing shape as PeakPrediction, opposite
// direction, no duplicate query.

import { fetchReservations } from './ReservationMetrics'
import type { LowOccupancySlot } from './types'

const LOW_OCCUPANCY_RATIO = 0.3 // below 30% of the tenant's average slot volume

export async function detectLowOccupancySlots(tenantId: string, windowDays = 90, limit = 5): Promise<LowOccupancySlot[]> {
  const rows = await fetchReservations(tenantId, windowDays)
  if (rows.length === 0) return []

  const counts = new Map<string, LowOccupancySlot>()
  for (const row of rows) {
    const dayOfWeek = row.date.getUTCDay()
    const hour = row.date.getUTCHours()
    const key = `${dayOfWeek}:${hour}`
    const entry = counts.get(key) ?? { dayOfWeek, hour, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }

  const slots = [...counts.values()]
  const avgCount = slots.reduce((sum, s) => sum + s.count, 0) / slots.length
  const threshold = avgCount * LOW_OCCUPANCY_RATIO

  return slots
    .filter(s => s.count <= threshold)
    .sort((a, b) => a.count - b.count)
    .slice(0, limit)
}
