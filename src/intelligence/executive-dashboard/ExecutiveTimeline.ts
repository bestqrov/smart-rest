// ─── Smart Intelligence Executive Dashboard — Timeline (K55) ───────────────
// Reuses K31's persisted IntelligenceEventLog (replayEvents) — same idiom
// K51/K54 already use for reading recent activity, no new event log.

import { replayEvents } from '../EventPersistence'
import type { ExecutiveTimelineEntry } from './types'

export async function getExecutiveTimeline(tenantId: string, limit = 20): Promise<ExecutiveTimelineEntry[]> {
  const events = await replayEvents({ tenantId, limit })

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map(e => ({ eventName: e.eventName, module: e.module, resourceId: e.resourceId, timestamp: e.timestamp }))
}
