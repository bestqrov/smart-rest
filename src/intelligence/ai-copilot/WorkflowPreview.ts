// ─── Smart Intelligence AI Copilot — Workflow Preview (K70) ────────────────
// Reuses K48's getWorkflow + resolveExecutionOrder directly — shows what
// would run and in what order, without running anything.

import { getWorkflow, resolveExecutionOrder } from '../orchestrator'
import type { WorkflowDefinition } from '../orchestrator'

export interface WorkflowPreview {
  workflow:       WorkflowDefinition
  executionOrder: string[][]
}

export function previewCopilotWorkflow(workflowId: string): WorkflowPreview | undefined {
  const workflow = getWorkflow(workflowId)
  if (!workflow) return undefined
  return { workflow, executionOrder: resolveExecutionOrder(workflow.steps) }
}
