// ─── Smart Intelligence AI Copilot — Workflow Approval (K70) ───────────────
// Same reuse posture as K69's ActionProposalService/ActionConfirmationService,
// one level up (a multi-step workflow instead of a single action). The
// PENDING Decision is the approval gate (same prisma.decision.create
// pattern K41/K54/K69 already use); confirming it explicitly calls K48's
// executeWorkflow — never automatically, and every ACTION step inside
// that workflow still only queues via K37's enqueueAction (K48's own
// TaskRouter already enforces that), never runs.

import prisma from '../../prisma'
import { publishStandardEvent, AuditService } from '../../core'
import { approveDecision, rejectDecision, getDecision } from '../decisions'
import { executeWorkflow } from '../orchestrator'
import type { WorkflowRunState } from '../orchestrator'
import { estimateAutomationImpact } from '../automation-advisor'
import type { AutomationOpportunity, AutomationImpactEstimate } from '../automation-advisor'
import { ensureCopilotWorkflow } from './WorkflowGeneration'
import { previewCopilotWorkflow, type WorkflowPreview } from './WorkflowPreview'

const COPILOT_WORKFLOW_CATEGORY = 'copilot-workflow'

export interface WorkflowProposalResult {
  decisionId: string
  workflowId: string
  preview:    WorkflowPreview | undefined
  impact:     AutomationImpactEstimate
}

export async function proposeCopilotWorkflow(
  tenantId: string, opportunity: AutomationOpportunity, performedBy: string,
): Promise<WorkflowProposalResult> {
  const workflow = ensureCopilotWorkflow(opportunity)
  const impact = await estimateAutomationImpact(opportunity)

  const decision = await prisma.decision.create({
    data: {
      tenantId, ruleId: `ai-copilot-workflow:${opportunity.ruleId}`, category: COPILOT_WORKFLOW_CATEGORY,
      title: workflow.name, description: workflow.description,
      priority: opportunity.occurrences >= 10 ? 'HIGH' : 'MEDIUM',
      confidence: Math.min(1, opportunity.occurrences / 10),
      metadata: JSON.stringify({ workflowId: workflow.id, opportunity, impact, proposedBy: performedBy }),
    },
  })

  publishStandardEvent('IntelDecisionCreated', {
    tenantId, resourceId: decision.id, metadata: { ruleId: decision.ruleId, source: 'ai-copilot-workflow' },
  }, 'ai-copilot')

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'CopilotWorkflowProposal', entityId: decision.id, action: 'PROPOSE',
    performedBy, metadata: { tenantId, workflowId: workflow.id },
  }).catch(() => undefined)

  return { decisionId: decision.id, workflowId: workflow.id, preview: previewCopilotWorkflow(workflow.id), impact }
}

function readWorkflowId(metadata: string | null | undefined): string | undefined {
  if (!metadata) return undefined
  try { return (JSON.parse(metadata) as { workflowId?: string }).workflowId } catch { return undefined }
}

export async function confirmCopilotWorkflow(decisionId: string, performedBy: string): Promise<
  { status: 'RUN'; run: WorkflowRunState } | { status: 'FAILED'; reason: string }
> {
  const decision = await getDecision(decisionId)
  const workflowId = readWorkflowId(decision?.metadata)
  if (!decision || !workflowId) return { status: 'FAILED', reason: 'workflow proposal not found' }

  try {
    await approveDecision(decisionId, performedBy)
    const run = await executeWorkflow(workflowId, { tenantId: decision.tenantId, performedBy, callerId: 'ai-copilot' })

    await AuditService.createAudit({
      module: 'INTELLIGENCE', entity: 'CopilotWorkflowProposal', entityId: decisionId, action: 'CONFIRM',
      performedBy, metadata: { workflowId, runId: run.runId, status: run.status },
    }).catch(() => undefined)

    return { status: 'RUN', run }
  } catch (err: any) {
    return { status: 'FAILED', reason: err?.message ?? 'confirmation failed' }
  }
}

export async function rejectCopilotWorkflow(decisionId: string, performedBy: string): Promise<{ status: 'REJECTED' | 'FAILED'; reason?: string }> {
  try {
    await rejectDecision(decisionId, performedBy)
    await AuditService.createAudit({
      module: 'INTELLIGENCE', entity: 'CopilotWorkflowProposal', entityId: decisionId, action: 'REJECT', performedBy,
    }).catch(() => undefined)
    return { status: 'REJECTED' }
  } catch (err: any) {
    return { status: 'FAILED', reason: err?.message ?? 'rejection failed' }
  }
}
