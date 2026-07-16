// ─── Smart Intelligence AI Copilot — Workflow Generation (K70) ─────────────
// Builds a K48 WorkflowDefinition from a K54 AutomationOpportunity — reuses
// K48's WorkflowRegistry/types and K37's getActionExecutorsByCategory
// directly, no second workflow model, no second executor lookup.
// Deterministic two-step shape: DECISION_EVALUATE (re-check current
// signals via K38) feeding an ACTION step (if a matching K37 executor
// exists) — demonstrates the dependsOn graph K48 already resolves,
// nothing invented here beyond wiring.

import { registerWorkflow, hasWorkflow, getWorkflow } from '../orchestrator'
import type { WorkflowDefinition, WorkflowStepDefinition } from '../orchestrator'
import { getActionExecutorsByCategory } from '../actions'
import type { AutomationOpportunity } from '../automation-advisor'

export function workflowIdForOpportunity(opportunity: AutomationOpportunity): string {
  return `copilot-automation:${opportunity.ruleId}`
}

export function generateWorkflowFromOpportunity(opportunity: AutomationOpportunity): WorkflowDefinition {
  const executors = getActionExecutorsByCategory(opportunity.category)
  const steps: WorkflowStepDefinition[] = [
    { id: 'evaluate', kind: 'DECISION_EVALUATE' },
  ]

  if (executors.length > 0) {
    steps.push({
      id: 'apply', kind: 'ACTION', targetId: executors[0]!.id, dependsOn: ['evaluate'],
      input: { ruleId: opportunity.ruleId, category: opportunity.category },
    })
  }

  return {
    id: workflowIdForOpportunity(opportunity),
    name: `Copilot automation: ${opportunity.ruleId}`,
    description: opportunity.description,
    steps,
  }
}

export function ensureCopilotWorkflow(opportunity: AutomationOpportunity): WorkflowDefinition {
  const id = workflowIdForOpportunity(opportunity)
  if (hasWorkflow(id)) return getWorkflow(id)!

  const workflow = generateWorkflowFromOpportunity(opportunity)
  registerWorkflow(workflow)
  return workflow
}
