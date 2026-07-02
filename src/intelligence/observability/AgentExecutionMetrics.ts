// ─── Smart Intelligence Observability — Agent Execution Metrics (K51) ──────
// Reuses K45's already-tracked RuntimeMonitoring stats — no second counter.

import { getAllRuntimeStats } from '../runtime'
import type { AgentExecutionMetricsSummary } from './types'

export function getAgentExecutionMetrics(): AgentExecutionMetricsSummary {
  const stats = getAllRuntimeStats()

  const totalRuns    = stats.reduce((sum, s) => sum + s.totalRuns, 0)
  const successCount = stats.reduce((sum, s) => sum + s.successCount, 0)
  const failureCount = stats.reduce((sum, s) => sum + s.failureCount, 0)
  const timeoutCount = stats.reduce((sum, s) => sum + s.timeoutCount, 0)

  const durations = stats.filter(s => s.lastDurationMs !== undefined).map(s => s.lastDurationMs as number)
  const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  return {
    agentCount:  stats.length,
    totalRuns, successCount, failureCount, timeoutCount,
    successRate: totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) / 100 : 0,
    avgDurationMs,
    perAgent: stats.map(s => ({
      agentId:     s.agentId,
      totalRuns:   s.totalRuns,
      successRate: s.totalRuns > 0 ? Math.round((s.successCount / s.totalRuns) * 100) / 100 : 0,
      lastError:   s.lastError,
    })),
  }
}
