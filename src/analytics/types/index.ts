// ─── SmartSuite Analytics Engine — Types ──────────────────────────────────────

// ── Metric ────────────────────────────────────────────────────────────────────

export type MetricUnit =
  | 'count'       // plain number
  | 'currency'    // monetary (MAD default)
  | 'percentage'  // 0–100
  | 'ms'          // milliseconds
  | 'tokens'      // AI tokens
  | 'bytes'       // file size
  | 'custom'      // module-specific

export type AggregationType =
  | 'SUM'         // sum of all values in period
  | 'AVG'         // arithmetic mean
  | 'COUNT'       // count of non-null values
  | 'MIN'         // minimum
  | 'MAX'         // maximum
  | 'PERCENTAGE'  // (numerator / denominator) × 100
  | 'TREND'       // % change vs previous period
  | 'LATEST'      // single point-in-time snapshot

export interface MetricDefinition {
  id:              string          // 'billing.mrr' — globally unique
  module:          string          // 'billing', 'ai', 'marketing', ...
  category:        string          // 'revenue', 'usage', 'performance', ...
  name:            string          // human-readable
  description:     string
  unit:            MetricUnit
  aggregationType: AggregationType
  enabled:         boolean
  tags:            string[]
  denominator?:    string          // for PERCENTAGE type: id of denominator metric
}

// ── Period ────────────────────────────────────────────────────────────────────

export type PeriodType =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'       // current calendar month
  | 'year'        // current calendar year
  | 'custom'

export interface Period {
  type:  PeriodType
  start: Date
  end:   Date
}

// ── Collector ─────────────────────────────────────────────────────────────────

export interface CollectedData {
  module:      string
  collectedAt: Date
  period:      Period
  // metricId → raw value (null = not applicable / not yet available)
  data:        Record<string, number | null>
}

export type CollectorFn = (period: Period, tenantId?: string) => Promise<CollectedData>

export interface CollectorDefinition {
  module:    string
  name:      string
  collect:   CollectorFn
  metrics:   string[]       // metricIds this collector provides
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface AggregationResult {
  metricId:    string
  period:      Period
  value:       number | null
  trend?:      number        // % change vs previous period (positive = up)
  collectedAt: Date
}

// ── Snapshot (persisted) ──────────────────────────────────────────────────────

export interface MetricSnapshot {
  id:          string
  metricId:    string
  period:      PeriodType
  periodStart: Date
  periodEnd:   Date
  value:       number
  trend?:      number | null
  tenantId?:   string        // null = platform-wide
  metadata?:   Record<string, unknown>
  createdAt:   Date
}

export interface CreateSnapshotInput {
  metricId:    string
  period:      PeriodType
  periodStart: Date
  periodEnd:   Date
  value:       number
  trend?:      number | null
  tenantId?:   string
  metadata?:   Record<string, unknown>
}

// ── Report ────────────────────────────────────────────────────────────────────

export interface ReportDefinition {
  id:            string
  name:          string
  description:   string
  module:        string      // 'platform', 'billing', 'ai', ...
  metrics:       string[]    // ordered list of metricIds to include
  defaultPeriod: PeriodType
  tags:          string[]
}

export interface ReportResult {
  reportId:    string
  reportName:  string
  period:      Period
  generatedAt: Date
  metrics:     AggregationResult[]
  summary:     Record<string, number | null>   // metricId → value (flat)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardMetric {
  definition: MetricDefinition
  result:     AggregationResult
  snapshot?:  MetricSnapshot
}

export interface DashboardSummary {
  period:      Period
  generatedAt: Date
  metrics:     DashboardMetric[]
  byModule:    Record<string, DashboardMetric[]>
}

// ── Analytics Service types ───────────────────────────────────────────────────

export interface CollectOptions {
  period:    PeriodType | Period
  tenantId?: string
  persist?:  boolean         // save snapshot to DB (default: true)
}

export interface GetMetricOptions {
  period:    PeriodType
  tenantId?: string
  withTrend?: boolean
}
