// ─── Standard Event Publisher (K11: Platform Event Standardization) ───────
// Thin helper over the existing EventBus that normalizes the payload shape
// for Subscriptions/Billing/Payments/Notifications events to one contract:
// eventId, eventName, tenantId, actor, timestamp, resourceId, metadata.
// Does not replace or wrap eventBus.publish — just standardizes what gets
// passed in as the payload.

import crypto from 'crypto'
import { eventBus } from './EventBus'
import type { PlatformEventName, StandardEventPayload } from '../types'

export interface StandardEventInput {
  tenantId:   string
  resourceId: string
  actor?:     string
  metadata?:  Record<string, unknown>
}

export function publishStandardEvent(
  name:   PlatformEventName,
  input:  StandardEventInput,
  source = 'unknown',
): StandardEventPayload {
  const payload: StandardEventPayload = {
    eventId:    crypto.randomUUID(),
    eventName:  name,
    tenantId:   input.tenantId,
    actor:      input.actor ?? 'system',
    timestamp:  new Date(),
    resourceId: input.resourceId,
    metadata:   input.metadata,
  }
  eventBus.publish(name, payload, source)
  return payload
}
