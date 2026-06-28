import type { CollectorDefinition } from '../types'

// ─── In-memory collector registry ────────────────────────────────────────────

const registry = new Map<string, CollectorDefinition>()

export function registerCollector(collector: CollectorDefinition): void {
  if (registry.has(collector.module)) {
    throw new Error(`Analytics: collector for module "${collector.module}" is already registered`)
  }
  registry.set(collector.module, collector)
}

export function getCollector(module: string): CollectorDefinition {
  const c = registry.get(module)
  if (!c) throw new Error(`Analytics: no collector registered for module "${module}"`)
  return c
}

export function hasCollector(module: string): boolean {
  return registry.has(module)
}

export function getAllCollectors(): CollectorDefinition[] {
  return Array.from(registry.values())
}

// Returns the module name that provides a given metricId
export function getCollectorForMetric(metricId: string): CollectorDefinition | undefined {
  return Array.from(registry.values()).find(c => c.metrics.includes(metricId))
}

// for testing only
export function _resetCollectorRegistry(): void {
  registry.clear()
}
