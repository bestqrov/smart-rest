// ─── Smart Intelligence Action Engine — Executor Registry (K37) ────────────
// Same Map-based registry shape as the other Intelligence registries
// (Agent/Collector/DataAdapter/RecommendationRule/InsightRule) — 6th
// instance. Empty by default; no executors ship in this foundation.

import type { ActionExecutorDefinition } from './types'

const registry = new Map<string, ActionExecutorDefinition>()

export function registerActionExecutor(executor: ActionExecutorDefinition): void {
  if (registry.has(executor.id)) {
    throw new Error(`Intelligence: action executor "${executor.id}" is already registered`)
  }
  registry.set(executor.id, executor)
}

export function getActionExecutor(id: string): ActionExecutorDefinition | undefined {
  return registry.get(id)
}

export function hasActionExecutor(id: string): boolean {
  return registry.has(id)
}

export function getAllActionExecutors(): ActionExecutorDefinition[] {
  return Array.from(registry.values())
}

export function getActionExecutorsByCategory(category: string): ActionExecutorDefinition[] {
  return Array.from(registry.values()).filter(e => e.category === category)
}

// for testing only
export function _resetActionRegistry(): void {
  registry.clear()
}
