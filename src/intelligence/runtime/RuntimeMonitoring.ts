// ─── Smart Intelligence Agent Runtime — Monitoring Hooks + Stats (K45) ─────
// Same "addHook" bridge idiom as K42's addUsageHook — synchronous callbacks
// for external monitoring, plus an in-memory per-agent stats rollup.

import type { AgentRuntimeStats, RuntimeMonitoringEvent, RuntimeMonitoringHook } from './types'

const hooks = new Set<RuntimeMonitoringHook>()
const stats = new Map<string, AgentRuntimeStats>()

export function addRuntimeMonitoringHook(hook: RuntimeMonitoringHook): void {
  hooks.add(hook)
}

export function removeRuntimeMonitoringHook(hook: RuntimeMonitoringHook): void {
  hooks.delete(hook)
}

function emptyStats(agentId: string): AgentRuntimeStats {
  return { agentId, totalRuns: 0, successCount: 0, failureCount: 0, timeoutCount: 0, skippedCount: 0 }
}

export function emitRuntimeEvent(event: RuntimeMonitoringEvent): void {
  for (const hook of hooks) {
    try { hook(event) } catch { /* a broken monitoring hook must never break agent execution */ }
  }

  if (event.phase === 'RETRY' || event.phase === 'START') return

  const s = stats.get(event.agentId) ?? emptyStats(event.agentId)
  s.totalRuns += 1
  if (event.durationMs !== undefined) s.lastDurationMs = event.durationMs
  s.lastRunAt = new Date()

  switch (event.phase) {
    case 'SUCCESS': s.successCount += 1; break
    case 'ERROR':   s.failureCount += 1; s.lastError = event.error; break
    case 'TIMEOUT': s.timeoutCount += 1; s.lastError = event.error; break
    case 'SKIPPED': s.skippedCount += 1; break
  }

  stats.set(event.agentId, s)
}

export function getRuntimeStats(agentId: string): AgentRuntimeStats | undefined {
  return stats.get(agentId)
}

export function getAllRuntimeStats(): AgentRuntimeStats[] {
  return [...stats.values()]
}
