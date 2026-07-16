// ─── Smart Intelligence Orchestrator — Core (K48) ──────────────────────────
// executeWorkflow runs each dependency batch in sequence (steps within a
// batch in parallel), skips any step whose dependency failed, and never
// invents steps beyond what the WorkflowDefinition declares — deterministic
// coordination, not autonomous planning. Run state is in-memory only (same
// posture as K40 AgentHealth/K45 RuntimeStats); the durable trail is the
// existing AuditService, not a new table.

import crypto from 'crypto'
import { publishStandardEvent, AuditService } from '../../core'
import { getWorkflow } from './WorkflowRegistry'
import { resolveExecutionOrder } from './DependencyResolver'
import { routeStep } from './TaskRouter'
import type { ExecuteWorkflowContext, WorkflowRunState } from './types'

const runs = new Map<string, WorkflowRunState>()

async function audit(action: string, tenantId: string, runId: string, performedBy: string, metadata?: Record<string, unknown>) {
  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'WorkflowRun', entityId: runId, action, performedBy,
    metadata: { tenantId, ...metadata },
  }).catch(() => undefined)
}

export async function executeWorkflow(workflowId: string, ctx: ExecuteWorkflowContext): Promise<WorkflowRunState> {
  const def = getWorkflow(workflowId)
  if (!def) throw new Error(`Intelligence: workflow "${workflowId}" is not registered`)

  const runId = crypto.randomUUID()
  const batches = resolveExecutionOrder(def.steps)

  const state: WorkflowRunState = {
    runId, workflowId, tenantId: ctx.tenantId, status: 'RUNNING',
    steps: def.steps.map(s => ({ stepId: s.id, status: 'PENDING' })),
    startedAt: new Date(),
  }
  runs.set(runId, state)

  publishStandardEvent('IntelWorkflowStarted', {
    tenantId: ctx.tenantId, resourceId: runId, metadata: { workflowId },
  }, 'workflow-orchestrator')
  await audit('WORKFLOW_STARTED', ctx.tenantId, runId, ctx.performedBy, { workflowId })

  const failed = new Set<string>()
  const byId = new Map(def.steps.map(s => [s.id, s]))
  const resultById = new Map(state.steps.map(r => [r.stepId, r]))

  for (const batch of batches) {
    await Promise.all(batch.map(async (stepId) => {
      const step   = byId.get(stepId)!
      const result = resultById.get(stepId)!

      const blockedBy = (step.dependsOn ?? []).find(dep => failed.has(dep))
      if (blockedBy) {
        result.status = 'SKIPPED'
        result.error  = `dependency "${blockedBy}" failed`
        failed.add(stepId) // propagate skip to downstream dependents too
        return
      }

      result.status = 'RUNNING'
      const start = Date.now()
      try {
        result.output     = await routeStep(step, ctx)
        result.status     = 'COMPLETED'
        result.durationMs = Date.now() - start
      } catch (err: any) {
        result.status     = 'FAILED'
        result.error      = err?.message ?? 'Unknown error'
        result.durationMs = Date.now() - start
        failed.add(stepId)
      }
    }))
  }

  state.status      = failed.size > 0 ? 'FAILED' : 'COMPLETED'
  state.completedAt = new Date()

  publishStandardEvent('IntelWorkflowCompleted', {
    tenantId: ctx.tenantId, resourceId: runId, metadata: { workflowId, status: state.status, failedSteps: [...failed] },
  }, 'workflow-orchestrator')
  await audit(state.status === 'FAILED' ? 'WORKFLOW_FAILED' : 'WORKFLOW_COMPLETED', ctx.tenantId, runId, ctx.performedBy, { workflowId })

  return state
}

export function getWorkflowRun(runId: string): WorkflowRunState | undefined {
  return runs.get(runId)
}

export function listWorkflowRuns(tenantId: string): WorkflowRunState[] {
  return [...runs.values()].filter(r => r.tenantId === tenantId)
}
