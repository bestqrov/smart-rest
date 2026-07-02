// ─── Smart Intelligence Core — Agent Registry (K30 Foundation) ─────────────
// Same in-memory Map-based registry idiom as
// analytics/collectors/CollectorRegistry.ts — applied to intelligence agents
// instead of collectors. No agents are registered here; this is the
// mechanism future agents plug into.

import type { PlatformEventName } from '../core'
import type { IntelligenceAgentDefinition } from './types'

const registry = new Map<string, IntelligenceAgentDefinition>()

export function registerAgent(agent: IntelligenceAgentDefinition): void {
  if (registry.has(agent.id)) {
    throw new Error(`Intelligence: agent "${agent.id}" is already registered`)
  }
  registry.set(agent.id, agent)
}

export function getAgent(id: string): IntelligenceAgentDefinition | undefined {
  return registry.get(id)
}

export function hasAgent(id: string): boolean {
  return registry.has(id)
}

// K31 — subscription API symmetry (register/unregister).
export function unregisterAgent(id: string): boolean {
  return registry.delete(id)
}

export function getAllAgents(): IntelligenceAgentDefinition[] {
  return Array.from(registry.values())
}

export function getAgentsByModule(module: string): IntelligenceAgentDefinition[] {
  return Array.from(registry.values()).filter(a => a.module === module)
}

export function getAgentsForEvent(eventName: PlatformEventName): IntelligenceAgentDefinition[] {
  return Array.from(registry.values()).filter(a => a.events === '*' || a.events.includes(eventName))
}

// for testing only
export function _resetAgentRegistry(): void {
  registry.clear()
}
