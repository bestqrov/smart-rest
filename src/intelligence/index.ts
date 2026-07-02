// ─── Smart Intelligence Platform — Public API (K30-K33 + K35-K45) ──────────
// Infrastructure only. Two families of "rules" coexist by design, not by
// accident: Recommendation/Insight/Decision rules (K35/K36/K38) are
// TypeScript functions — code, in-memory, one global behavior, deployed
// with the app. The Rule Engine (K41) holds DECLARATIVE rules — conditions
// + an action binding, as data — persisted, versioned, and overridable per
// tenant without a deploy. Also here: agent contract/registry, event
// normalization/categorization/persistence/replay, the pull-based Data Hub,
// the Context Engine, the Action Engine (explicit-only queue/run — nothing
// auto-executes), the Knowledge Engine (versioned facts, no vectors/RAG),
// the Agent Framework (capabilities/permissions/lifecycle/health on the
// same K30 AgentRegistry), and the AI Provider Layer (K42 — re-exports the
// existing, complete marketing-brain/providers system: interface, registry,
// selector/failover, usage tracking; adds only a Model Registry and a
// usage-event bridge into this module's event stream), and the Prompt
// Engine (K43 — versioned template registry, rendering/variable/context
// injection and validation reusing marketing-brain's generic string
// primitives, execution wired through the K42 AI Provider Layer), and the
// Memory Engine (K44 — short-term is an in-memory TTL cache, long-term is
// not a second store: it's the K39 Knowledge Engine addressed through a
// "memory:" key namespace; no vectors/embeddings), and the Agent Runtime
// (K45 — the only execution pipeline for non-reactive agent runs, manual
// or scheduled; concurrency control, timeout, bounded retry, and
// monitoring hooks around K40's AgentDefinition.handle, without touching
// K30/K40's reactive eventBus dispatch, which remains the only pipeline
// for event-triggered runs). Still exactly one eventBus subscription for
// the whole module. No built-in agents/rules/executors/templates/
// namespaces/schedules ship except the Data Hub knowledge source and the
// built-in model catalog (both direct reuse/reference data, not business
// rules); nothing here is business-specific.

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

export * from './decisions'

export * from './knowledge'

export * from './agents'

export * from './rules'

export * from './ai'

export * from './prompts'

export * from './memory'

export * from './runtime'
