// ─── Smart Intelligence Capability Engine — Dependency Graph (K49) ─────────
// Reuses K48's resolveExecutionOrder (a pure topological sort) instead of
// re-implementing batching/cycle-detection a second time. That function
// only reads `.id`/`.dependsOn` off each entry — `kind` is required by its
// type signature but unused by its logic, so a fixed placeholder is safe.

import { resolveExecutionOrder } from '../orchestrator'
import { getAllCapabilities, getCapability } from './CapabilityRegistry'

export function resolveCapabilityOrder(ids?: string[]): string[][] {
  const all = getAllCapabilities()
  const selected = ids ? all.filter(c => ids.includes(c.id)) : all

  const steps = selected.map(c => ({
    id: c.id, kind: 'SKILL' as const, dependsOn: (c.dependsOn ?? []).filter(dep => selected.some(s => s.id === dep)),
  }))

  return resolveExecutionOrder(steps)
}

export function getTransitiveDependencies(id: string): string[] {
  const seen = new Set<string>()
  const stack = [id]

  while (stack.length > 0) {
    const current = stack.pop()!
    const def = getCapability(current)
    for (const dep of def?.dependsOn ?? []) {
      if (!seen.has(dep)) {
        seen.add(dep)
        stack.push(dep)
      }
    }
  }

  return [...seen]
}
