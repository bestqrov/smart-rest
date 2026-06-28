// ─── SmartSuite Analytics Engine — Public API ─────────────────────────────────

// ── Bootstrap ─────────────────────────────────────────────────────────────────
export { registerBuiltinMetrics }    from './metrics/builtin'
export { registerBuiltinCollectors } from './collectors/builtin'
export { registerBuiltinReports }    from './reports/builtin'
export { subscribeToEvents, unsubscribeFromEvents } from './events/EventSubscriber'

// ── Metric Registry ───────────────────────────────────────────────────────────
export {
  registerMetric,
  updateMetric,
  getMetric,
  hasMetric,
  getAllMetrics,
  getMetricsByModule,
  getMetricsByCategory,
  getMetricsByTag,
} from './metrics/MetricRegistry'

// ── Collector Registry ────────────────────────────────────────────────────────
export {
  registerCollector,
  getCollector,
  hasCollector,
  getAllCollectors,
  getCollectorForMetric,
} from './collectors/CollectorRegistry'

// ── Report Registry ───────────────────────────────────────────────────────────
export {
  registerReport,
  getReport,
  hasReport,
  getAllReports,
  getReportsByModule,
  getReportsByTag,
} from './reports/ReportRegistry'

// ── Analytics Service (main API) ──────────────────────────────────────────────
export {
  collect,
  collectModule,
  collectAll,
  collectNow,
  getMetric_value as getMetricValue,
  getMetrics,
  getModuleSummary,
  getPlatformSummary,
  getDashboardMetrics,
  generateReport,
} from './services/AnalyticsService'

// ── Storage ───────────────────────────────────────────────────────────────────
export {
  saveSnapshot,
  getLatestSnapshot,
  getSnapshots,
  getSnapshotsForPeriod,
  deleteOldSnapshots,
} from './storage/SnapshotStore'

// ── Aggregators & Periods ─────────────────────────────────────────────────────
export {
  resolvePeriod,
  previousPeriod,
} from './aggregators/periods'

export {
  sum, avg, count, min, max,
  percentage, trend,
  applyAggregation,
  buildResult,
  extractMetric,
} from './aggregators/AggregationEngine'

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  MetricUnit,
  AggregationType,
  MetricDefinition,
  PeriodType,
  Period,
  CollectedData,
  CollectorFn,
  CollectorDefinition,
  AggregationResult,
  MetricSnapshot,
  CreateSnapshotInput,
  ReportDefinition,
  ReportResult,
  DashboardMetric,
  DashboardSummary,
  CollectOptions,
  GetMetricOptions,
} from './types'

// ─── Convenience: register everything at once ─────────────────────────────────

import { registerBuiltinMetrics }    from './metrics/builtin'
import { registerBuiltinCollectors } from './collectors/builtin'
import { registerBuiltinReports }    from './reports/builtin'
import { subscribeToEvents }         from './events/EventSubscriber'

export function initAnalyticsEngine(): void {
  registerBuiltinMetrics()
  registerBuiltinCollectors()
  registerBuiltinReports()
  subscribeToEvents()
}
