// ─── Smart Intelligence AI Copilot — Workflow Rollback (K70) ───────────────
// Honest scope: only ever cancels ACTION steps that are still QUEUED
// (via K37's existing cancelAction) — actions the platform has already
// run cannot be undone generically (nothing in K37/K48 tracks reverse
// operations), so this never claims to undo completed work, only to stop
// what hasn't run yet.

import { AuditService } from '../../core'
import { getWorkflowRun, getWorkflow } from '../orchestrator'
import { cancelAction } from '../actions'

export interface WorkflowRollbackResult {
  runId:              string
  cancelledActionIds: string[]
  skipped:            string[]   // step ids that couldn't be cancelled (already run, not an action, etc.)
}

export async function rollbackCopilotWorkflow(runId: string, performedBy: string): Promise<WorkflowRollbackResult> {
  const run = getWorkflowRun(runId)
  const cancelledActionIds: string[] = []
  const skipped: string[] = []

  if (!run) return { runId, cancelledActionIds, skipped }

  const workflow = getWorkflow(run.workflowId)

  for (const stepResult of run.steps) {
    const stepDef = workflow?.steps.find(s => s.id === stepResult.stepId)
    if (stepDef?.kind !== 'ACTION' || stepResult.status !== 'COMPLETED') continue

    const output = stepResult.output as { id?: string } | undefined
    if (!output?.id) { skipped.push(stepResult.stepId); continue }

    try {
      await cancelAction(output.id)
      cancelledActionIds.push(output.id)
    } catch {
      skipped.push(stepResult.stepId) // already run or not QUEUED — nothing to roll back
    }
  }

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'CopilotWorkflowRun', entityId: runId, action: 'ROLLBACK',
    performedBy, metadata: { cancelledActionIds, skipped },
  }).catch(() => undefined)

  return { runId, cancelledActionIds, skipped }
}
