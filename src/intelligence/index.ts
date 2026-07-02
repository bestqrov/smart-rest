// ─── Smart Intelligence Platform — Public API (K30-K33 + K35-K37) ──────────
// Infrastructure only: agent contract/registry, event normalization/
// categorization/persistence/replay, the pull-based Data Hub (cross-module
// adapters, unified tenant-aware access, feature extraction, cache hooks),
// the Context Engine (tenant/branch/user/business/time/request context
// composed from existing services), the Recommendation Engine (rule-based,
// pulled on demand), the Insight Engine (rule-based, event-driven — insight
// rules register as agents under the hood, so there's still only one
// eventBus subscription in this whole module), and the Action Engine
// (executor registry + explicit-only queue/run — nothing auto-executes).
// No built-in agents/rules/executors ship — future sprints register them;
// nothing here is business-specific.

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

export * from './insights'

export * from './actions'
