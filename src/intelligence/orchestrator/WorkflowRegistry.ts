// ─── Smart Intelligence Orchestrator — Workflow Registry (K48) ─────────────
// Same registry-of-definitions idiom as every other Intelligence module.

import type { WorkflowDefinition } from './types'

const registry = new Map<string, WorkflowDefinition>()

export function registerWorkflow(def: WorkflowDefinition): void {
  const ids = new Set<string>()
  for (const step of def.steps) {
    if (ids.has(step.id)) throw new Error(`Intelligence: workflow "${def.id}" has a duplicate step id "${step.id}"`)
    ids.add(step.id)
  }
  for (const step of def.steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!ids.has(dep)) throw new Error(`Intelligence: workflow "${def.id}" step "${step.id}" depends on unknown step "${dep}"`)
    }
  }
  registry.set(def.id, def)
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return registry.get(id)
}

export function hasWorkflow(id: string): boolean {
  return registry.has(id)
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return [...registry.values()]
}
