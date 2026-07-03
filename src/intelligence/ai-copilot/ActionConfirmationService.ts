// ─── Smart Intelligence AI Copilot — Action Confirmation (K69) ─────────────
// The only place this module calls K38's approveDecision/executeDecision
// — and only from an explicit, human-initiated call (a chat "yes"/
// "confirm" routed here by the caller, never automatically). executeDecision
// itself still only queues the action via K37's enqueueAction, never runs
// it — the same "never auto-execute" boundary K37/K38 already enforce.

import { AuditService } from '../../core'
import { approveDecision, rejectDecision, executeDecision, getDecision } from '../decisions'
import type { ActionConfirmationResult } from './types'

export async function confirmCopilotAction(decisionId: string, performedBy: string): Promise<ActionConfirmationResult> {
  try {
    await approveDecision(decisionId, performedBy)
    const executed = await executeDecision(decisionId, performedBy)

    await AuditService.createAudit({
      module: 'INTELLIGENCE', entity: 'CopilotActionProposal', entityId: decisionId, action: 'CONFIRM',
      performedBy, metadata: { linkedActionId: executed.linkedActionId ?? undefined },
    }).catch(() => undefined)

    return { status: 'EXECUTED', decisionId, linkedActionId: executed.linkedActionId ?? undefined }
  } catch (err: any) {
    return { status: 'FAILED', decisionId, reason: err?.message ?? 'confirmation failed' }
  }
}

export async function rejectCopilotAction(decisionId: string, performedBy: string): Promise<ActionConfirmationResult> {
  try {
    await rejectDecision(decisionId, performedBy)

    await AuditService.createAudit({
      module: 'INTELLIGENCE', entity: 'CopilotActionProposal', entityId: decisionId, action: 'REJECT', performedBy,
    }).catch(() => undefined)

    return { status: 'REJECTED', decisionId }
  } catch (err: any) {
    return { status: 'FAILED', decisionId, reason: err?.message ?? 'rejection failed' }
  }
}

export async function getCopilotActionProposal(decisionId: string) {
  return getDecision(decisionId)
}
