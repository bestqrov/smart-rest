// ─── Smart Intelligence Agent Framework — Communication (K40) ──────────────
// Agent-to-agent messages are just another platform event
// (IntelAgentMessage), delivered through the same single eventBus
// wildcard subscription every other Intelligence event uses — no second
// message bus. A receiving agent declares 'IntelAgentMessage' in its
// `events` list and filters on event.metadata.to === its own id.

import { publishStandardEvent } from '../../core'

export function sendAgentMessage(from: string, to: string, type: string, payload: unknown, tenantId = 'platform') {
  publishStandardEvent('IntelAgentMessage', {
    tenantId, resourceId: to, actor: from, metadata: { from, to, type, payload },
  }, 'agent-framework')
}
