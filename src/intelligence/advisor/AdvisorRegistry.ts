// ─── Smart Intelligence Business Advisor — Registry (K46) ──────────────────
// Same registry-of-definitions idiom as every other Intelligence module.
// Does not register anything with K40/K45 itself — an advisor's agentId
// must already be a registered framework agent (registerFrameworkAgent),
// this registry only maps an advisor identity onto that agent.

import { hasAdvisorCapability } from './AdvisorCapabilityRegistry'
import type { AdvisorDefinition } from './types'

const registry = new Map<string, AdvisorDefinition>()

export function registerAdvisor(def: AdvisorDefinition): void {
  const unknown = def.capabilities.filter(c => !hasAdvisorCapability(c))
  if (unknown.length > 0) {
    throw new Error(`Intelligence: advisor "${def.id}" declares unregistered capabilities: ${unknown.join(', ')}`)
  }
  registry.set(def.id, def)
}

export function getAdvisor(id: string): AdvisorDefinition | undefined {
  return registry.get(id)
}

export function hasAdvisor(id: string): boolean {
  return registry.has(id)
}

export function getAllAdvisors(): AdvisorDefinition[] {
  return [...registry.values()]
}

export function getAdvisorsByDomain(domain: string): AdvisorDefinition[] {
  return getAllAdvisors().filter(a => a.domain === domain)
}

export function getAdvisorsByCapability(capability: string): AdvisorDefinition[] {
  return getAllAdvisors().filter(a => a.capabilities.includes(capability))
}
