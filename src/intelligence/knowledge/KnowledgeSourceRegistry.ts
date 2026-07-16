// ─── Smart Intelligence Knowledge Engine — Source Registry (K39) ───────────
// Same Map-based registry shape used throughout this module — 8th instance
// (Agent/Collector/DataAdapter/RecommendationRule/InsightRule/
// ActionExecutor/DecisionRule/KnowledgeSource).

import type { KnowledgeSourceDefinition, KnowledgeSourceType } from './types'

const registry = new Map<string, KnowledgeSourceDefinition>()

export function registerKnowledgeSource(source: KnowledgeSourceDefinition): void {
  if (registry.has(source.id)) {
    throw new Error(`Intelligence: knowledge source "${source.id}" is already registered`)
  }
  registry.set(source.id, source)
}

export function getKnowledgeSource(id: string): KnowledgeSourceDefinition | undefined {
  return registry.get(id)
}

export function hasKnowledgeSource(id: string): boolean {
  return registry.has(id)
}

export function getAllKnowledgeSources(): KnowledgeSourceDefinition[] {
  return Array.from(registry.values())
}

export function getKnowledgeSourcesByType(type: KnowledgeSourceType): KnowledgeSourceDefinition[] {
  return Array.from(registry.values()).filter(s => s.type === type)
}

// for testing only
export function _resetKnowledgeSourceRegistry(): void {
  registry.clear()
}
