// ─── Smart Intelligence Observability — Provider Performance (K51) ─────────
// No new usage tracker: K42's AIProviderBridge already publishes
// IntelAIUsageRecorded through the K30 event bus, and K31 already persists
// every event to IntelligenceEventLog. This reads that log back via K31's
// replayEvents instead of accumulating a second, in-memory usage store.

import { replayEvents } from '../EventPersistence'
import type { ProviderPerformanceSummary } from './types'

const DEFAULT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function getProviderPerformanceMetrics(windowMs = DEFAULT_WINDOW_MS): Promise<ProviderPerformanceSummary> {
  const events = await replayEvents({
    eventName: 'IntelAIUsageRecorded',
    from:      new Date(Date.now() - windowMs),
    limit:     1000,
  })

  const byProvider = new Map<string, { calls: number; successes: number; latencyTotal: number; costUsd: number }>()

  for (const event of events) {
    const provider = String(event.metadata['provider'] ?? 'unknown')
    const entry = byProvider.get(provider) ?? { calls: 0, successes: 0, latencyTotal: 0, costUsd: 0 }
    entry.calls += 1
    if (event.metadata['success']) entry.successes += 1
    entry.latencyTotal += Number(event.metadata['latencyMs'] ?? 0)
    entry.costUsd += Number(event.metadata['costUsd'] ?? 0)
    byProvider.set(provider, entry)
  }

  const totalCalls   = events.length
  const totalSuccess = [...byProvider.values()].reduce((sum, p) => sum + p.successes, 0)
  const totalCostUsd = [...byProvider.values()].reduce((sum, p) => sum + p.costUsd, 0)
  const totalLatency = [...byProvider.values()].reduce((sum, p) => sum + p.latencyTotal, 0)

  return {
    windowMs,
    totalCalls,
    successRate:  totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) / 100 : 0,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    avgLatencyMs: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : null,
    perProvider: [...byProvider.entries()].map(([provider, p]) => ({
      provider, calls: p.calls,
      successRate: p.calls > 0 ? Math.round((p.successes / p.calls) * 100) / 100 : 0,
      avgLatencyMs: p.calls > 0 ? Math.round(p.latencyTotal / p.calls) : 0,
      costUsd: Math.round(p.costUsd * 10000) / 10000,
    })),
  }
}
