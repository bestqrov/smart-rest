// ─── Smart Intelligence Executive Dashboard — Public API (K55) ─────────────

export type {
  ExecutiveKpi, ExecutivePriority, ExecutiveCriticalAlert, RecommendationsSummary,
  OpportunitiesSummary, ExecutiveTimelineEntry, ExecutiveDashboard,
} from './types'

export { getExecutiveKpis } from './KpiAggregation'
export { getTopPriorities } from './TopPriorities'
export { getCriticalAlerts } from './CriticalAlerts'
export { getRecommendationsSummary } from './RecommendationsSummary'
export { getOpportunitiesSummary } from './OpportunitiesSummary'
export { getExecutiveTimeline } from './ExecutiveTimeline'
export { getExecutiveDashboard } from './ExecutiveDashboardService'
