// ─── Smart Intelligence Agent Runtime — Contracts (K45) ────────────────────
// Runtime infrastructure for invoking agents outside the reactive
// eventBus dispatch K30/K40 already own (manual + scheduled runs).
// Reuses AgentDefinition/AgentHealth (K40) and NormalizedIntelligenceEvent
// (K30/K31) as-is — no parallel agent contract.

export type RuntimeRunStatus = 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'SKIPPED'

export interface RunAgentOptions {
  timeoutMs?:  number   // default 30_000
  maxRetries?: number   // default 0 (no retry)
}

export interface RuntimeRunResult {
  agentId:     string
  status:      RuntimeRunStatus
  attempts:    number
  durationMs:  number
  error?:      string
  reason?:     string   // set when status === 'SKIPPED'
}

export interface AgentRuntimeStats {
  agentId:        string
  totalRuns:      number
  successCount:   number
  failureCount:   number
  timeoutCount:   number
  skippedCount:   number
  lastRunAt?:     Date
  lastDurationMs?: number
  lastError?:     string
}

export type RuntimePhase = 'START' | 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'SKIPPED' | 'RETRY'

export interface RuntimeMonitoringEvent {
  agentId:     string
  phase:       RuntimePhase
  attempt?:    number
  durationMs?: number
  error?:      string
}

export type RuntimeMonitoringHook = (event: RuntimeMonitoringEvent) => void

export interface ScheduleDefinition {
  agentId:    string
  intervalMs: number
  tenantId?:  string   // undefined = platform-wide scheduled run
}
