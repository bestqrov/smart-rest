// ─── Smart Intelligence Insight Engine — Rule Registry (K36) ───────────────
// A real registry (5th instance of the Map-based idiom, after Agent/
// Collector/DataAdapter/RecommendationRule) for introspection — but the
// "event-driven" part is not a second subscription mechanism: registering
// an insight rule also registers it as an agent in K30's AgentRegistry, so
// dispatch still goes through the single existing eventBus.subscribe('*')
// wildcard from IntelligenceEventBus.ts.

import { registerAgent, unregisterAgent } from '../AgentRegistry'
import { getContextForTenant } from '../context'
import { getTenantFeatureVector } from '../data'
import { createInsightFromCandidate } from './InsightEngine'
import type { InsightCategory, InsightRuleDefinition } from './types'

const registry = new Map<string, InsightRuleDefinition>()

function agentIdFor(ruleId: string): string {
  return `insight:${ruleId}`
}

export function registerInsightRule(rule: InsightRuleDefinition): void {
  if (registry.has(rule.id)) {
    throw new Error(`Intelligence: insight rule "${rule.id}" is already registered`)
  }
  registry.set(rule.id, rule)

  registerAgent({
    id:     agentIdFor(rule.id),
    name:   rule.name,
    module: rule.category,
    events: rule.events,
    handle: async (event) => {
      if (!event.tenantId) return // insight rules only make sense for tenant-scoped events

      const [context, features] = await Promise.all([
        getContextForTenant(event.tenantId),
        getTenantFeatureVector(event.tenantId),
      ])

      const candidate = await rule.evaluate(event, context, features)
      if (!candidate) return

      await createInsightFromCandidate(event.tenantId, rule.id, candidate, event.eventId)
    },
  })
}

export function unregisterInsightRule(id: string): boolean {
  unregisterAgent(agentIdFor(id))
  return registry.delete(id)
}

export function getInsightRule(id: string): InsightRuleDefinition | undefined {
  return registry.get(id)
}

export function hasInsightRule(id: string): boolean {
  return registry.has(id)
}

export function getAllInsightRules(): InsightRuleDefinition[] {
  return Array.from(registry.values())
}

export function getInsightRulesByCategory(category: InsightCategory): InsightRuleDefinition[] {
  return Array.from(registry.values()).filter(r => r.category === category)
}

// for testing only
export function _resetInsightRuleRegistry(): void {
  registry.clear()
}
