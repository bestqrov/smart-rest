// ─── Smart Intelligence Core — Public API (K30 Foundation) ─────────────────
// Infrastructure only: agent contract, registry, and event dispatch. No
// prediction/recommendation logic and no built-in agents — future sprints
// register concrete agents via registerAgent(); nothing here is
// business-specific.

export type { IntelligenceAgentDefinition, AgentEventHandler } from './types'

export {
  registerAgent,
  getAgent,
  hasAgent,
  getAllAgents,
  getAgentsByModule,
  getAgentsForEvent,
} from './AgentRegistry'

export { initIntelligenceCore } from './IntelligenceEventBus'
