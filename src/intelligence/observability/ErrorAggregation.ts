// ─── Smart Intelligence Observability — Error Aggregation (K51) ────────────
// Reads the same persisted IntelligenceEventLog (K31 replayEvents) instead
// of a new error store — every engine already publishes its own failure
// event, this just collects them across a time window.

import { replayEvents } from '../EventPersistence'
import type { AggregatedIntelligenceError } from './types'

const ERROR_EVENT_NAMES = [
  'IntelAgentError',
  'IntelActionFailed',
  'IntelDecisionRejected',
  'IntelInsightDismissed',
  'IntelRecommendationDismissed',
] as const

const DEFAULT_WINDOW_MS = 60 * 60 * 1000

export async function getRecentIntelligenceErrors(windowMs = DEFAULT_WINDOW_MS, limit = 50): Promise<AggregatedIntelligenceError[]> {
  const from = new Date(Date.now() - windowMs)

  const results = await Promise.all(
    ERROR_EVENT_NAMES.map(eventName => replayEvents({ eventName, from, limit })),
  )

  return results
    .flat()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map(event => ({
      eventName:  event.eventName,
      module:     event.module,
      tenantId:   event.tenantId,
      resourceId: event.resourceId,
      timestamp:  event.timestamp,
      message:    typeof event.metadata['error'] === 'string' ? event.metadata['error'] as string : undefined,
    }))
}
