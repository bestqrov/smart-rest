import type { RuleDefinition } from '../types'

// ─── In-memory rule registry ──────────────────────────────────────────────────

const registry = new Map<string, RuleDefinition>()

export function registerRule(rule: RuleDefinition): void {
  registry.set(rule.id, rule)
}

export function registerRules(rules: RuleDefinition[]): void {
  for (const rule of rules) registerRule(rule)
}

export function getRule(id: string): RuleDefinition {
  const r = registry.get(id)
  if (!r) throw new Error(`CertificationRule "${id}" not found`)
  return r
}

export function getRulesForProfile(profileId: string): RuleDefinition[] {
  return Array.from(registry.values()).filter(r => r.profile === profileId && r.enabled)
}

export function getAllRules(): RuleDefinition[] {
  return Array.from(registry.values())
}
