// ─── Smart Intelligence Orchestrator — Dependency Resolution (K48) ─────────
// Deterministic Kahn's-algorithm topological sort, grouped into batches
// (each batch is safe to run in parallel; batches run in sequence). Pure
// function of the declared step list — no planning, no inference.

import type { WorkflowStepDefinition } from './types'

export function resolveExecutionOrder(steps: WorkflowStepDefinition[]): string[][] {
  const byId       = new Map(steps.map(s => [s.id, s]))
  const inDegree   = new Map<string, number>(steps.map(s => [s.id, (s.dependsOn ?? []).length]))
  const dependents = new Map<string, string[]>(steps.map(s => [s.id, []]))

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      dependents.get(dep)!.push(step.id)
    }
  }

  const batches: string[][] = []
  let frontier = steps.filter(s => inDegree.get(s.id) === 0).map(s => s.id)
  let processed = 0

  while (frontier.length > 0) {
    batches.push(frontier)
    processed += frontier.length
    const next: string[] = []

    for (const id of frontier) {
      for (const dependentId of dependents.get(id) ?? []) {
        const remaining = inDegree.get(dependentId)! - 1
        inDegree.set(dependentId, remaining)
        if (remaining === 0) next.push(dependentId)
      }
    }

    frontier = next
  }

  if (processed !== byId.size) {
    throw new Error('Intelligence: workflow has a circular dependency')
  }

  return batches
}
