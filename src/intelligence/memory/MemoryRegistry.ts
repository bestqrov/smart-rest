// ─── Smart Intelligence Memory Engine — Namespace Registry (K44) ───────────
// Same registry-of-definitions idiom as every other Intelligence module
// (AgentRegistry, DataAdapterRegistry, KnowledgeSourceRegistry, ...).
// Namespaces declare their tier and default expiration up front so callers
// don't have to repeat a TTL at every remember() call site.

import type { MemoryNamespaceDefinition } from './types'

const registry = new Map<string, MemoryNamespaceDefinition>()

export function registerMemoryNamespace(def: MemoryNamespaceDefinition): void {
  registry.set(def.id, def)
}

export function getMemoryNamespace(id: string): MemoryNamespaceDefinition | undefined {
  return registry.get(id)
}

export function hasMemoryNamespace(id: string): boolean {
  return registry.has(id)
}

export function getAllMemoryNamespaces(): MemoryNamespaceDefinition[] {
  return [...registry.values()]
}
