// ─── Smart Intelligence Core — Contracts (K30 Foundation) ──────────────────
// Mirrors the existing analytics module's registry-definition idiom
// (analytics/types/index.ts's CollectorDefinition) applied to a new concern:
// agents that react to platform events instead of collectors that produce
// metrics. No prediction/recommendation types here by design — this sprint
// is infrastructure only.

import type { PlatformEventName } from '../core'

// ─── Normalized event (K31) ─────────────────────────────────────────────────
// A consistent shape for every platform event regardless of whether the
// original publisher used publishStandardEvent's envelope (K11 onward) or
// called eventBus.publish directly with an ad-hoc payload (still ~45 call
// sites do, mostly pre-K11 modules) — agents always receive this shape.
export interface NormalizedIntelligenceEvent {
  eventId:    string
  eventName:  PlatformEventName
  module:     string                 // derived via EventCategoryRegistry
  tenantId:   string | null          // null when the source event had no tenant context
  actor:      string | null
  resourceId: string | null
  source:     string                 // eventBus.publish's third arg — already tracked upstream
  timestamp:  Date
  metadata:   Record<string, unknown>
  raw:        unknown                // original payload, for agents that need full fidelity
}

export type AgentEventHandler = (event: NormalizedIntelligenceEvent) => void | Promise<void>

export interface IntelligenceAgentDefinition {
  id:     string                       // unique agent id
  name:   string
  module: string                       // domain the agent belongs to (billing, pos, kitchen, ...)
  events: PlatformEventName[] | '*'    // which platform events this agent reacts to
  handle: AgentEventHandler
}
