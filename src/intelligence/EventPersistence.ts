// ─── Smart Intelligence Event Hub — Persistence + Replay (K31) ─────────────
// New cross-domain log (IntelligenceEventLog) — distinct from the existing
// billing-only BillingEventLog, which stays untouched. Persistence is a
// best-effort hook off the live dispatch path: a write failure here must
// never block agent notification.

import prisma from '../prisma'
import logger from '../logger'
import type { NormalizedIntelligenceEvent } from './types'

function rowToNormalized(row: {
  eventId: string; eventName: string; module: string; tenantId: string | null
  actor: string | null; resourceId: string | null; source: string
  timestamp: Date; metadata: string | null
}): NormalizedIntelligenceEvent {
  const metadata = row.metadata ? JSON.parse(row.metadata) : {}
  return {
    eventId:    row.eventId,
    eventName:  row.eventName as NormalizedIntelligenceEvent['eventName'],
    module:     row.module,
    tenantId:   row.tenantId ?? null,
    actor:      row.actor ?? null,
    resourceId: row.resourceId ?? null,
    source:     row.source,
    timestamp:  row.timestamp,
    metadata,
    raw:        metadata,
  }
}

export async function persistEvent(event: NormalizedIntelligenceEvent): Promise<void> {
  try {
    await prisma.intelligenceEventLog.create({
      data: {
        eventId:    event.eventId,
        eventName:  event.eventName,
        module:     event.module,
        tenantId:   event.tenantId ?? undefined,
        actor:      event.actor ?? undefined,
        resourceId: event.resourceId ?? undefined,
        source:     event.source,
        timestamp:  event.timestamp,
        metadata:   JSON.stringify(event.metadata ?? {}),
      },
    })
  } catch (err) {
    logger.error({ msg: '[Intelligence] failed to persist event', eventName: event.eventName, err })
  }
}

export interface ReplayFilter {
  tenantId?:  string   // tenant isolation — when set, only that tenant's events are returned
  module?:    string
  eventName?: string
  from?:      Date
  to?:        Date
  limit?:     number
}

// Reads persisted events back out as NormalizedIntelligenceEvent records —
// callers (e.g. a future backfill or a newly-registered agent catching up)
// dispatch them through the same IntelligenceEventBus.dispatch used for
// live events, so replay never diverges from live behavior.
export async function replayEvents(filter: ReplayFilter = {}): Promise<NormalizedIntelligenceEvent[]> {
  const rows = await prisma.intelligenceEventLog.findMany({
    where: {
      ...(filter.tenantId  ? { tenantId: filter.tenantId }   : {}),
      ...(filter.module    ? { module: filter.module }       : {}),
      ...(filter.eventName ? { eventName: filter.eventName } : {}),
      ...(filter.from || filter.to ? {
        timestamp: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to   ? { lte: filter.to }   : {}),
        },
      } : {}),
    },
    orderBy: { timestamp: 'asc' },
    take:    Math.min(filter.limit ?? 200, 1000),
  })

  return rows.map(rowToNormalized)
}

// Source tracking — reuses the same persisted log (no second store).
export async function getEventsBySource(source: string, limit = 100): Promise<NormalizedIntelligenceEvent[]> {
  const rows = await prisma.intelligenceEventLog.findMany({
    where: { source }, orderBy: { timestamp: 'desc' }, take: Math.min(limit, 1000),
  })
  return rows.map(rowToNormalized)
}
