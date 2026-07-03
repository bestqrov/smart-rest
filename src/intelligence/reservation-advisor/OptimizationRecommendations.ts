// ─── Smart Intelligence Reservation Advisor v1 — Optimization (K63) ────────
// Pure rule-based transform of the detectors above — no new detection.

import { analyzeNoShows } from './NoShowAnalysis'
import { detectLowOccupancySlots } from './LowOccupancyDetection'
import { getTableUtilization } from './UtilizationInsights'
import type { ReservationOptimization } from './types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function getReservationOptimizations(tenantId: string): Promise<ReservationOptimization[]> {
  const [noShows, lowOccupancy, utilization] = await Promise.all([
    analyzeNoShows(tenantId),
    detectLowOccupancySlots(tenantId),
    getTableUtilization(tenantId),
  ])

  const optimizations: ReservationOptimization[] = []

  if (noShows.ratePct >= 20) {
    optimizations.push({
      type: 'REDUCE_NO_SHOWS',
      title: 'Reduce no-shows with confirmation reminders',
      description: `${noShows.ratePct}% of reservations (${noShows.noShows} of ${noShows.total}) are no-shows — consider a same-day reminder or deposit for larger parties.`,
    })
  }

  if (utilization.utilizationPct >= 90) {
    optimizations.push({
      type: 'ADD_CAPACITY',
      title: 'Consider adding table capacity',
      description: `Table utilization is at ${utilization.utilizationPct}% of available capacity — demand may be exceeding what current tables can seat.`,
    })
  }

  if (lowOccupancy.length > 0) {
    const slot = lowOccupancy[0]!
    optimizations.push({
      type: 'PROMOTE_LOW_OCCUPANCY',
      title: `Promote ${DAY_NAMES[slot.dayOfWeek]} ${slot.hour}:00 slot`,
      description: `This time slot has historically low reservation volume (${slot.count} reservations) — a targeted promotion could fill it.`,
    })
  }

  return optimizations
}
