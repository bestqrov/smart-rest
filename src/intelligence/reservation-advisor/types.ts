// ─── Smart Intelligence Reservation Advisor v1 — Contracts (K63) ───────────
// Rule-based only, no LLM. Every detector below reuses one shared
// fetchReservations query (ReservationMetrics.ts) — no duplicate
// Reservation aggregation across the module's bullets. Verified K52's
// reservationInsightRule already computes a single overall no-show rate,
// event-triggered — this module's NoShowAnalysis computes a richer
// day-of-week breakdown from the same shared row set, not a second
// identical total/noShows count.

export interface DayOfWeekCount {
  dayOfWeek: number   // 0 = Sunday .. 6 = Saturday
  count:     number
}

export interface ReservationTrend {
  windowDays:       number
  recentCount:      number   // most recent half of the window
  priorCount:       number   // prior half of the window
  changePct:        number
  byDayOfWeek:      DayOfWeekCount[]
}

export interface PeakPrediction {
  dayOfWeek:       number
  hour:            number   // 0-23, UTC
  historicalCount: number
}

export interface LowOccupancySlot {
  dayOfWeek: number
  hour:      number
  count:     number
}

export interface NoShowBreakdown {
  total:      number
  noShows:    number
  ratePct:    number
  byDayOfWeek: (DayOfWeekCount & { ratePct: number })[]
}

export interface CancellationBreakdown {
  total:         number
  cancellations: number
  ratePct:       number
  byDayOfWeek:   (DayOfWeekCount & { ratePct: number })[]
}

export interface TableUtilization {
  activeTableCount:  number
  totalCapacity:     number
  totalGuestsReserved: number
  utilizationPct:    number
}

export interface ReservationOptimization {
  type:        'ADD_CAPACITY' | 'REDUCE_NO_SHOWS' | 'PROMOTE_LOW_OCCUPANCY'
  title:       string
  description: string
}

export interface ReservationAdvisorSummary {
  tenantId:       string
  trend:          ReservationTrend
  peakPredictions: PeakPrediction[]
  lowOccupancySlots: LowOccupancySlot[]
  noShowAnalysis: NoShowBreakdown
  cancellationAnalysis: CancellationBreakdown
  utilization:    TableUtilization
  optimizations:  ReservationOptimization[]
  generatedAt:    Date
}
