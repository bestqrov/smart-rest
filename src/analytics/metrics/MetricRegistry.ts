import type { MetricDefinition } from '../types'

// ─── In-memory metric registry ────────────────────────────────────────────────

const registry = new Map<string, MetricDefinition>()

export function registerMetric(metric: MetricDefinition): void {
  if (registry.has(metric.id)) {
    throw new Error(`Analytics: metric "${metric.id}" is already registered`)
  }
  if (!metric.enabled) {
    registry.set(metric.id, metric)
    return
  }
  registry.set(metric.id, metric)
}

export function updateMetric(id: string, patch: Partial<Omit<MetricDefinition, 'id'>>): void {
  const existing = registry.get(id)
  if (!existing) throw new Error(`Analytics: metric "${id}" not found`)
  registry.set(id, { ...existing, ...patch })
}

export function getMetric(id: string): MetricDefinition {
  const m = registry.get(id)
  if (!m) throw new Error(`Analytics: metric "${id}" not registered`)
  return m
}

export function hasMetric(id: string): boolean {
  return registry.has(id)
}

export function getAllMetrics(onlyEnabled = false): MetricDefinition[] {
  const all = Array.from(registry.values())
  return onlyEnabled ? all.filter(m => m.enabled) : all
}

export function getMetricsByModule(module: string, onlyEnabled = false): MetricDefinition[] {
  return getAllMetrics(onlyEnabled).filter(m => m.module === module)
}

export function getMetricsByCategory(category: string, onlyEnabled = false): MetricDefinition[] {
  return getAllMetrics(onlyEnabled).filter(m => m.category === category)
}

export function getMetricsByTag(tag: string, onlyEnabled = false): MetricDefinition[] {
  return getAllMetrics(onlyEnabled).filter(m => m.tags.includes(tag))
}

// for testing only
export function _resetMetricRegistry(): void {
  registry.clear()
}
