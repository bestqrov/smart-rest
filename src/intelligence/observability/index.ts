// ─── Smart Intelligence Observability — Public API (K51) ───────────────────

export type {
  AgentExecutionMetricsSummary, ProviderPerformanceSummary, IntelligenceDashboardMetrics,
  AggregatedIntelligenceError, TraceSpan, TraceHook, TimingStats,
} from './types'

export { checkIntelligenceHealth } from './IntelligenceHealthCheck'

export { getAgentExecutionMetrics } from './AgentExecutionMetrics'

export { getProviderPerformanceMetrics } from './ProviderPerformanceMetrics'

export { getIntelligenceDashboardMetrics } from './DashboardMetrics'

export { getRecentIntelligenceErrors } from './ErrorAggregation'

export { addTraceHook, startSpan, type ActiveSpan } from './TracingHooks'

export {
  incrementCounter, getCounter, getAllCounters,
  recordTiming, getTimingStats, getAllTimingStats,
} from './PerformanceCounters'
