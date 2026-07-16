// ─── Smart Intelligence Observability — Contracts (K51) ────────────────────
// No new logging system: every function here reads state already tracked
// by an existing Intelligence module (K40/K45/K47 in-memory health/stats,
// K31's persisted IntelligenceEventLog via replayEvents) or shapes its
// output to fit the existing ops/types (ModuleHealth) so it slots into the
// existing HealthService/DiagnosticsService without a parallel API.

export interface AgentExecutionMetricsSummary {
  agentCount:     number
  totalRuns:      number
  successCount:   number
  failureCount:   number
  timeoutCount:   number
  successRate:    number   // 0-1, NaN-safe (0 when totalRuns === 0)
  avgDurationMs:  number | null
  perAgent:       { agentId: string; totalRuns: number; successRate: number; lastError?: string }[]
}

export interface ProviderPerformanceSummary {
  windowMs:        number
  totalCalls:      number
  successRate:     number
  totalCostUsd:    number
  avgLatencyMs:    number | null
  perProvider:     { provider: string; calls: number; successRate: number; avgLatencyMs: number; costUsd: number }[]
}

export interface IntelligenceDashboardMetrics {
  agents:       { total: number; active: number; error: number }
  skills:       { total: number; error: number }
  capabilities: { total: number; active: number }
  workflows:    { total: number }
  advisors:     { total: number }
  providers:    { active: number; hasActive: boolean }
  generatedAt:  Date
}

export interface AggregatedIntelligenceError {
  eventName:  string
  module:     string
  tenantId:   string | null
  resourceId: string | null
  timestamp:  Date
  message?:   string
}

export interface TraceSpan {
  traceId:     string
  name:        string
  startedAt:   number
  durationMs?: number
  tags?:       Record<string, string>
}

export type TraceHook = (span: TraceSpan) => void

export interface TimingStats {
  count:   number
  totalMs: number
  avgMs:   number
  maxMs:   number
}
