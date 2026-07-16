// ─── Smart Intelligence Insight Engine — Core (K36) ────────────────────────
// createInsightFromCandidate is called by InsightRuleRegistry's agent
// handler (event-driven, via K30's AgentRegistry/K31's dispatch — no second
// subscription mechanism here). Lifecycle mirrors the same
// ALLOWED_TRANSITIONS-map pattern already used in K12 Kitchen, K15
// Reservations, and K35 Recommendation.

import prisma from '../../prisma'
import { publishStandardEvent } from '../../core'
import type { InsightCandidate } from './types'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW:          ['ACKNOWLEDGED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'],
  RESOLVED:     [],
  DISMISSED:    [],
}

function assertTransition(from: string, to: string) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid insight transition: ${from} → ${to}`)
  }
}

// ─── Creation (event-driven, called from InsightRuleRegistry) ─────────────
export async function createInsightFromCandidate(
  tenantId: string,
  ruleId:   string,
  candidate: InsightCandidate,
  sourceEventId?: string,
) {
  const insight = await prisma.insight.create({
    data: {
      tenantId, ruleId,
      category:      candidate.category,
      severity:      candidate.severity,
      title:         candidate.title,
      description:   candidate.description,
      sourceEventId,
      metadata:      candidate.metadata ? JSON.stringify(candidate.metadata) : undefined,
    },
  })

  publishStandardEvent('IntelInsightCreated', {
    tenantId, resourceId: insight.id, metadata: { ruleId, category: candidate.category, severity: candidate.severity },
  }, 'insight-engine')

  return insight
}

// ─── Lifecycle transitions ─────────────────────────────────────────────────
async function transition(id: string, to: string, eventName: 'IntelInsightAcknowledged' | 'IntelInsightResolved' | 'IntelInsightDismissed', extra: Record<string, unknown> = {}) {
  const insight = await prisma.insight.findUniqueOrThrow({ where: { id } })
  assertTransition(insight.status, to)

  const updated = await prisma.insight.update({ where: { id }, data: { status: to, ...extra } })
  publishStandardEvent(eventName, { tenantId: insight.tenantId, resourceId: id, metadata: { ruleId: insight.ruleId } }, 'insight-engine')
  return updated
}

export async function acknowledgeInsight(id: string) {
  return transition(id, 'ACKNOWLEDGED', 'IntelInsightAcknowledged', { acknowledgedAt: new Date() })
}

export async function resolveInsight(id: string) {
  return transition(id, 'RESOLVED', 'IntelInsightResolved', { resolvedAt: new Date() })
}

export async function dismissInsight(id: string) {
  return transition(id, 'DISMISSED', 'IntelInsightDismissed')
}

// ─── Insight API (read) ─────────────────────────────────────────────────────
export async function listInsights(tenantId: string, status?: string, severity?: string) {
  return prisma.insight.findMany({
    where:   { tenantId, ...(status ? { status } : {}), ...(severity ? { severity } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getInsight(id: string) {
  return prisma.insight.findUnique({ where: { id } })
}
