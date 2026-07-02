// ─── Smart Intelligence Event Hub — Normalization (K31) ────────────────────
// Converts any raw PlatformEvent — whether its payload came from
// publishStandardEvent's envelope (K11 onward: eventId/eventName/tenantId/
// actor/timestamp/resourceId/metadata) or an ad-hoc shape (pre-K11 modules
// still call eventBus.publish directly, ~45 call sites) — into one
// consistent record. Reads fields defensively; never throws on an
// unexpected payload shape.

import crypto from 'crypto'
import type { PlatformEvent } from '../core'
import type { NormalizedIntelligenceEvent } from './types'
import { categorizeEvent } from './EventCategoryRegistry'

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function normalizeEvent(event: PlatformEvent): NormalizedIntelligenceEvent {
  const payload = (event.payload ?? {}) as Record<string, unknown>

  // publishStandardEvent's envelope already has these at the top level;
  // ad-hoc payloads vary by module (tenantId is the most common field name
  // used across both styles, per the K7-K10 convention), so fall back
  // gracefully instead of assuming a shape.
  const eventId    = str(payload['eventId']) ?? event.traceId ?? crypto.randomUUID()
  const tenantId   = str(payload['tenantId'])
  const actor      = str(payload['actor']) ?? str(payload['performedBy']) ?? str(payload['staffId'])
  const resourceId = str(payload['resourceId']) ?? str(payload['invoiceId']) ?? str(payload['orderId']) ?? str(payload['id'])

  const rawMetadata = payload['metadata']
  const metadata = (rawMetadata && typeof rawMetadata === 'object')
    ? rawMetadata as Record<string, unknown>
    : payload // ad-hoc payloads: the whole thing is effectively the metadata

  return {
    eventId,
    eventName:  event.name,
    module:     categorizeEvent(event.name),
    tenantId,
    actor,
    resourceId,
    source:     event.source,
    timestamp:  event.timestamp,
    metadata,
    raw:        event.payload,
  }
}
