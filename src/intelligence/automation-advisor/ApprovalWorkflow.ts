// ─── Smart Intelligence Automation Advisor — Manual Approval Workflow (K54) ─
// Reuses K38's existing Decision model and lifecycle (approveDecision/
// rejectDecision/executeDecision, unchanged) instead of a second approval
// mechanism. proposeAutomationForApproval only ever creates a PENDING
// Decision — a human must explicitly approve it, and executeDecision only
// ever queues (never runs) the linked action, same boundary K37/K38
// already enforce on every other caller.

import prisma from '../../prisma'
import { publishStandardEvent } from '../../core'
import { listDecisions } from '../decisions'
import type { AutomationOpportunity, PendingAutomationDecision } from './types'

const AUTOMATION_CATEGORY = 'automation'

export async function proposeAutomationForApproval(
  tenantId: string, opportunity: AutomationOpportunity, performedBy: string,
) {
  const decision = await prisma.decision.create({
    data: {
      tenantId,
      ruleId:      `automation-advisor:${opportunity.ruleId}`,
      category:    AUTOMATION_CATEGORY,
      title:       `Automate: ${opportunity.ruleId}`,
      description: opportunity.description,
      priority:    opportunity.occurrences >= 10 ? 'HIGH' : 'MEDIUM',
      confidence:  Math.min(1, opportunity.occurrences / 10),
      metadata:    JSON.stringify({ opportunity, proposedBy: performedBy }),
    },
  })

  publishStandardEvent('IntelDecisionCreated', {
    tenantId, resourceId: decision.id, metadata: { ruleId: decision.ruleId, source: 'automation-advisor' },
  }, 'automation-advisor')

  return decision
}

export async function listPendingAutomationApprovals(tenantId: string): Promise<PendingAutomationDecision[]> {
  const decisions = await listDecisions(tenantId, 'PENDING')
  return decisions
    .filter(d => d.category === AUTOMATION_CATEGORY)
    .map(d => ({ id: d.id, category: d.category, title: d.title, status: d.status, createdAt: d.createdAt }))
}
