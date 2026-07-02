// ─── Smart Intelligence Decision Engine — Rule Registry (K38) ──────────────
// Same Map-based registry shape used throughout this module — 7th instance
// (Agent/Collector/DataAdapter/RecommendationRule/InsightRule/
// ActionExecutor/DecisionRule). Empty by default.

import type { DecisionRuleDefinition } from './types'

const registry = new Map<string, DecisionRuleDefinition>()

export function registerDecisionRule(rule: DecisionRuleDefinition): void {
  if (registry.has(rule.id)) {
    throw new Error(`Intelligence: decision rule "${rule.id}" is already registered`)
  }
  registry.set(rule.id, rule)
}

export function getDecisionRule(id: string): DecisionRuleDefinition | undefined {
  return registry.get(id)
}

export function hasDecisionRule(id: string): boolean {
  return registry.has(id)
}

export function getAllDecisionRules(): DecisionRuleDefinition[] {
  return Array.from(registry.values())
}

export function getDecisionRulesByCategory(category: string): DecisionRuleDefinition[] {
  return Array.from(registry.values()).filter(r => r.category === category)
}

// for testing only
export function _resetDecisionRuleRegistry(): void {
  registry.clear()
}
