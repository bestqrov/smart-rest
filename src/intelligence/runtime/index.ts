// ─── Smart Intelligence Agent Runtime — Public API (K45) ───────────────────

export type {
  RuntimeRunStatus, RunAgentOptions, RuntimeRunResult, AgentRuntimeStats,
  RuntimePhase, RuntimeMonitoringEvent, RuntimeMonitoringHook, ScheduleDefinition,
} from './types'

export { setMaxConcurrency, getActiveCount, tryAcquire, release } from './ConcurrencyController'

export {
  addRuntimeMonitoringHook, removeRuntimeMonitoringHook, getRuntimeStats, getAllRuntimeStats,
} from './RuntimeMonitoring'

export { runAgentNow, withTimeout } from './AgentExecutionPipeline'

export { registerSchedule, unregisterSchedule, isScheduled, getScheduledAgentIds } from './AgentScheduler'

export { activateAgent, pauseAgentRuntime, haltAgentRuntime } from './AgentLifecycleManager'
