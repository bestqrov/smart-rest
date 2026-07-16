// ─── Smart Intelligence Reservation Advisor v1 — Public API (K63) ──────────

export type {
  DayOfWeekCount, ReservationTrend, PeakPrediction, LowOccupancySlot,
  NoShowBreakdown, CancellationBreakdown, TableUtilization,
  ReservationOptimization, ReservationAdvisorSummary,
} from './types'

export { fetchReservations, fetchActiveTableCapacity, groupByDayOfWeek, type ReservationRow } from './ReservationMetrics'
export { analyzeReservationTrend } from './TrendAnalysis'
export { predictPeakSlots } from './PeakPrediction'
export { detectLowOccupancySlots } from './LowOccupancyDetection'
export { analyzeNoShows } from './NoShowAnalysis'
export { analyzeCancellations } from './CancellationAnalysis'
export { getTableUtilization } from './UtilizationInsights'
export { getReservationOptimizations } from './OptimizationRecommendations'
export { reservationOptimizationRecommendationRule } from './ReservationRecommendationRule'
export { getReservationAdvisorSummary } from './ReservationAdvisorService'
export { registerReservationAdvisorAgent } from './ReservationAdvisorAgent'
