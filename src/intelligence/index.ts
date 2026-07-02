// ─── Smart Intelligence Platform — Public API (K30-K33 + K35) ──────────────
// Infrastructure only: agent contract/registry, event normalization/
// categorization/persistence/replay, the pull-based Data Hub (cross-module
// adapters, unified tenant-aware access, feature extraction, cache hooks),
// the Context Engine (tenant/branch/user/business/time/request context
// composed from existing services), and the Recommendation Engine
// (rule-based, not ML/LLM: rules are pure functions over context + feature
// data). No built-in agents or rules — future sprints register them via
// registerAgent()/registerRecommendationRule(); nothing here is
// business-specific.

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

export * from './data'

export * from './context'

export * from './recommendations'
