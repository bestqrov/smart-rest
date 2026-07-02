// ─── Smart Intelligence Recommendation Engine — Rule Registry (K35) ────────
// Same Map-based registry shape as AgentRegistry (K30) and
// DataAdapterRegistry (K32) — the fourth instance of this idiom in the
// Intelligence module. No rules are registered here; this is the mechanism
// future rule-based recommendations plug into.

import type { RecommendationCategory, RecommendationRuleDefinition } from './types'

const registry = new Map<string, RecommendationRuleDefinition>()

export function registerRecommendationRule(rule: RecommendationRuleDefinition): void {
  if (registry.has(rule.id)) {
    throw new Error(`Intelligence: recommendation rule "${rule.id}" is already registered`)
  }
  registry.set(rule.id, rule)
}

export function getRecommendationRule(id: string): RecommendationRuleDefinition | undefined {
  return registry.get(id)
}

export function hasRecommendationRule(id: string): boolean {
  return registry.has(id)
}

export function getAllRecommendationRules(): RecommendationRuleDefinition[] {
  return Array.from(registry.values())
}

export function getRulesByCategory(category: RecommendationCategory): RecommendationRuleDefinition[] {
  return Array.from(registry.values()).filter(r => r.category === category)
}

// for testing only
export function _resetRecommendationRuleRegistry(): void {
  registry.clear()
}
