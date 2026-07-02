// ─── Smart Intelligence Decision Engine — Core (K38) ───────────────────────
// evaluateDecisions is the pipeline: resolve context (K33) + features (K32)
// + active recommendations (K35) + open insights (K36) once, then run every
// registered rule against that composed input. executeDecision reuses the
// Action Engine's enqueueAction (K37) — it only ever queues an action, the
// same "never auto-execute" boundary Action Engine itself already enforces,
// so this module doesn't need to re-implement or bypass it. Every lifecycle
// transition is written to the existing AuditService (core) instead of a
// second audit table.

import prisma from '../../prisma'
import { publishStandardEvent, AuditService } from '../../core'
import { getContextForTenant } from '../context'
import { getTenantFeatureVector } from '../data'
import { listRecommendations } from '../recommendations'
import { listInsights } from '../insights'
import { enqueueAction } from '../actions'
import { getAllDecisionRules } from './DecisionRuleRegistry'
import type { DecisionEvaluationInput } from './types'

async function audit(action: string, tenantId: string, decisionId: string, performedBy: string, metadata?: Record<string, unknown>) {
  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'Decision', entityId: decisionId, action, performedBy,
    metadata: { tenantId, ...metadata },
  }).catch(() => undefined)
}

// ─── Evaluation pipeline ────────────────────────────────────────────────────
export async function evaluateDecisions(tenantId: string, performedBy = 'system') {
  const rules = getAllDecisionRules()
  if (rules.length === 0) return []

  const [context, features, recommendations, insights] = await Promise.all([
    getContextForTenant(tenantId),
    getTenantFeatureVector(tenantId),
    listRecommendations(tenantId, 'ACTIVE'),
    listInsights(tenantId, 'NEW'),
  ])

  const input: DecisionEvaluationInput = { tenantId, context, features, recommendations, insights }
  const created = []

  for (const rule of rules) {
    try {
      const candidate = await rule.evaluate(input)
      if (!candidate) continue

      const decision = await prisma.decision.create({
        data: {
          tenantId, ruleId: rule.id,
          category:                  candidate.category,
          title:                     candidate.title,
          description:               candidate.description,
          priority:                  candidate.priority,
          confidence:                candidate.confidence,
          suggestedActionExecutorId: candidate.suggestedActionExecutorId,
          suggestedActionInput:      candidate.suggestedActionInput ? JSON.stringify(candidate.suggestedActionInput) : undefined,
          metadata:                  candidate.metadata ? JSON.stringify(candidate.metadata) : undefined,
        },
      })

      publishStandardEvent('IntelDecisionCreated', {
        tenantId, resourceId: decision.id, metadata: { ruleId: rule.id, priority: candidate.priority, confidence: candidate.confidence },
      }, 'decision-engine')
      await audit('DECISION_CREATED', tenantId, decision.id, performedBy, { ruleId: rule.id })

      created.push(decision)
    } catch {
      // A single rule failing must not block the others — same posture as
      // Recommendation/Insight rule evaluation.
    }
  }

  return created
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────
export async function approveDecision(id: string, performedBy = 'system') {
  const decision = await prisma.decision.findUniqueOrThrow({ where: { id } })
  if (decision.status !== 'PENDING') throw new Error(`Decision ${id} is not PENDING (status: ${decision.status})`)

  const updated = await prisma.decision.update({ where: { id }, data: { status: 'APPROVED', decidedAt: new Date() } })
  publishStandardEvent('IntelDecisionApproved', { tenantId: decision.tenantId, resourceId: id, metadata: {} }, 'decision-engine')
  await audit('DECISION_APPROVED', decision.tenantId, id, performedBy)
  return updated
}

export async function rejectDecision(id: string, performedBy = 'system') {
  const decision = await prisma.decision.findUniqueOrThrow({ where: { id } })
  if (decision.status !== 'PENDING') throw new Error(`Decision ${id} is not PENDING (status: ${decision.status})`)

  const updated = await prisma.decision.update({ where: { id }, data: { status: 'REJECTED', decidedAt: new Date() } })
  publishStandardEvent('IntelDecisionRejected', { tenantId: decision.tenantId, resourceId: id, metadata: {} }, 'decision-engine')
  await audit('DECISION_REJECTED', decision.tenantId, id, performedBy)
  return updated
}

// Queues the suggested action (K37) — does not run it. Per the brief,
// decisions are never auto-executed; this is only ever called explicitly.
export async function executeDecision(id: string, performedBy = 'system') {
  const decision = await prisma.decision.findUniqueOrThrow({ where: { id } })
  if (decision.status !== 'APPROVED') throw new Error(`Decision ${id} is not APPROVED (status: ${decision.status})`)

  let linkedActionId: string | undefined
  if (decision.suggestedActionExecutorId) {
    const input = decision.suggestedActionInput ? JSON.parse(decision.suggestedActionInput) : undefined
    const action = await enqueueAction(decision.tenantId, decision.suggestedActionExecutorId, input, 'MANUAL')
    linkedActionId = action.id
  }

  const updated = await prisma.decision.update({
    where: { id },
    data:  { status: 'EXECUTED', executedAt: new Date(), linkedActionId },
  })
  publishStandardEvent('IntelDecisionExecuted', { tenantId: decision.tenantId, resourceId: id, metadata: { linkedActionId } }, 'decision-engine')
  await audit('DECISION_EXECUTED', decision.tenantId, id, performedBy, { linkedActionId })
  return updated
}

// ─── Public Decision API (read) ────────────────────────────────────────────
export async function listDecisions(tenantId: string, status?: string) {
  return prisma.decision.findMany({
    where:   { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDecision(id: string) {
  return prisma.decision.findUnique({ where: { id } })
}
