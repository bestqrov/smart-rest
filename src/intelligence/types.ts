// ─── Smart Intelligence Core — Contracts (K30 Foundation) ──────────────────
// Mirrors the existing analytics module's registry-definition idiom
// (analytics/types/index.ts's CollectorDefinition) applied to a new concern:
// agents that react to platform events instead of collectors that produce
// metrics. No prediction/recommendation types here by design — this sprint
// is infrastructure only.

import type { PlatformEventName, PlatformEvent } from '../core'

export type AgentEventHandler = (event: PlatformEvent) => void | Promise<void>

export interface IntelligenceAgentDefinition {
  id:     string                       // unique agent id
  name:   string
  module: string                       // domain the agent belongs to (billing, pos, kitchen, ...)
  events: PlatformEventName[] | '*'    // which platform events this agent reacts to
  handle: AgentEventHandler
}
