// ─── Smart Intelligence AI Copilot — Action Proposal (K69) ─────────────────
// Reuses K38's existing Decision model/lifecycle directly (same
// prisma.decision.create pattern K41's RuleEngine and K54's
// ApprovalWorkflow already use) — a proposal is nothing more than a
// PENDING Decision; no second proposal/approval mechanism. Reuses K58's
// checkAICapability as the permission gate (the existing AI-features
// entitlement check), and the existing AuditService for audit logging.

import prisma from '../../prisma'
import { publishStandardEvent, AuditService } from '../../core'
import { checkAICapability } from '../ai-readiness'
import { isActionRequest } from './ActionIntentDetection'
import { findMatchingExecutor } from './ActionCatalog'
import { assessActionRisk } from './ActionRiskAssessment'
import type { ActionProposalResult } from './types'

const COPILOT_ACTION_CATEGORY = 'copilot-action'

export async function proposeCopilotAction(tenantId: string, message: string, performedBy: string): Promise<ActionProposalResult> {
  if (!isActionRequest(message)) {
    return { proposed: false, reason: 'message does not look like an action request' }
  }

  const capability = await checkAICapability(tenantId)
  if (!capability.ready) {
    return { proposed: false, reason: capability.reasons.join('; ') }
  }

  const executor = findMatchingExecutor(message)
  if (!executor) {
    return { proposed: false, reason: 'no matching action is currently available for this request' }
  }

  const risk = assessActionRisk(executor)

  const decision = await prisma.decision.create({
    data: {
      tenantId, ruleId: `ai-copilot:${executor.id}`, category: COPILOT_ACTION_CATEGORY,
      title: `Copilot action: ${executor.name}`,
      description: `Requested via chat: "${message}"`,
      priority: risk === 'HIGH' ? 'HIGH' : risk === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      confidence: 0.5,
      suggestedActionExecutorId: executor.id,
      metadata: JSON.stringify({ risk, requestedBy: performedBy, message }),
    },
  })

  publishStandardEvent('IntelDecisionCreated', {
    tenantId, resourceId: decision.id, metadata: { ruleId: decision.ruleId, source: 'ai-copilot' },
  }, 'ai-copilot')

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'CopilotActionProposal', entityId: decision.id, action: 'PROPOSE',
    performedBy, metadata: { tenantId, executorId: executor.id, risk },
  }).catch(() => undefined)

  return {
    proposed: true, decisionId: decision.id,
    preview: { executorId: executor.id, executorName: executor.name, category: executor.category, risk },
  }
}
