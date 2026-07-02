// ─── Smart Intelligence Event Hub — Public API (K30 + K31) ─────────────────
// Infrastructure only: agent contract, registry, normalization,
// categorization, persistence/replay, and event dispatch. No prediction/
// recommendation logic and no built-in agents — future sprints register
// concrete agents via registerAgent(); nothing here is business-specific.

export type { IntelligenceAgentDefinition, AgentEventHandler, NormalizedIntelligenceEvent } from './types'

export {
  registerAgent,
  unregisterAgent,
  getAgent,
  hasAgent,
  getAllAgents,
  getAgentsByModule,
  getAgentsForEvent,
} from './AgentRegistry'

export { initIntelligenceCore } from './IntelligenceEventBus'

export { categorizeEvent } from './EventCategoryRegistry'

export { normalizeEvent } from './EventNormalizer'

export { persistEvent, replayEvents, getEventsBySource } from './EventPersistence'
export type { ReplayFilter } from './EventPersistence'
