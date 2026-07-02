// ─── Smart Intelligence Data Hub — Adapter Registry (K32) ──────────────────
// Same Map-based registry shape as AgentRegistry.ts (K30) and
// analytics/collectors/CollectorRegistry.ts.

import type { DataAdapterDefinition } from './types'

const registry = new Map<string, DataAdapterDefinition>()

export function registerDataAdapter(adapter: DataAdapterDefinition): void {
  if (registry.has(adapter.module)) {
    throw new Error(`Intelligence: data adapter for module "${adapter.module}" is already registered`)
  }
  registry.set(adapter.module, adapter)
}

export function getDataAdapter(module: string): DataAdapterDefinition | undefined {
  return registry.get(module)
}

export function hasDataAdapter(module: string): boolean {
  return registry.has(module)
}

export function getAllDataAdapters(): DataAdapterDefinition[] {
  return Array.from(registry.values())
}

// for testing only
export function _resetDataAdapterRegistry(): void {
  registry.clear()
}
