// ─── Smart Intelligence Recommendation Engine — Core (K35) ─────────────────
// Runs every registered rule against the existing Context Engine (K33) and
// Data Hub (K32) — no new data fetching, no ML/LLM. One row per
// (tenantId, ruleId): re-running updates score/priority in place instead of
// duplicating, so a rule always has at most one live recommendation.

import prisma from '../../prisma'
import logger from '../../logger'
import { publishStandardEvent } from '../../core'
import { getContextForTenant } from '../context'
import { getTenantFeatureVector } from '../data'
import { getAllRecommendationRules } from './RecommendationRuleRegistry'
import { scoreToPriority } from './PriorityScoring'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW:       ['ACTIVE', 'DISMISSED'],
  ACTIVE:    ['DISMISSED', 'COMPLETED'],
  DISMISSED: ['ACTIVE'],
  COMPLETED: [],
}

function assertTransition(from: string, to: string) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid recommendation transition: ${from} → ${to}`)
  }
}

// ─── Run the engine for one tenant ──────────────────────────────────────────
export async function runRecommendationEngine(tenantId: string) {
  const rules = getAllRecommendationRules()
  if (rules.length === 0) return []

  const [context, features] = await Promise.all([
    getContextForTenant(tenantId),
    getTenantFeatureVector(tenantId),
  ])

  const results = []
  for (const rule of rules) {
    try {
      const candidate = await rule.evaluate(context, features)
      if (!candidate) continue

      const priority = scoreToPriority(candidate.score)
      const existing = await prisma.recommendation.findUnique({ where: { tenantId_ruleId: { tenantId, ruleId: rule.id } } })

      const saved = await prisma.recommendation.upsert({
        where:  { tenantId_ruleId: { tenantId, ruleId: rule.id } },
        update: {
          category:    candidate.category,
          title:       candidate.title,
          description: candidate.description,
          score:       candidate.score,
          priority,
          metadata:    candidate.metadata ? JSON.stringify(candidate.metadata) : undefined,
        },
        create: {
          tenantId, ruleId: rule.id,
          category:    candidate.category,
          title:       candidate.title,
          description: candidate.description,
          score:       candidate.score,
          priority,
          status:      'NEW',
          metadata:    candidate.metadata ? JSON.stringify(candidate.metadata) : undefined,
        },
      })

      if (!existing) {
        publishStandardEvent('IntelRecommendationCreated', {
          tenantId, resourceId: saved.id, metadata: { ruleId: rule.id, category: candidate.category, priority },
        }, 'recommendation-engine')
      }

      results.push(saved)
    } catch (err) {
      logger.error({ msg: '[RecommendationEngine] rule evaluation failed', ruleId: rule.id, tenantId, err })
    }
  }

  return results
}

// ─── Lifecycle transitions ─────────────────────────────────────────────────
async function transition(id: string, to: string, eventName: 'IntelRecommendationActivated' | 'IntelRecommendationDismissed' | 'IntelRecommendationCompleted', extra: Record<string, unknown> = {}) {
  const rec = await prisma.recommendation.findUniqueOrThrow({ where: { id } })
  assertTransition(rec.status, to)

  const updated = await prisma.recommendation.update({ where: { id }, data: { status: to, ...extra } })
  publishStandardEvent(eventName, { tenantId: rec.tenantId, resourceId: id, metadata: { ruleId: rec.ruleId } }, 'recommendation-engine')
  return updated
}

export async function activateRecommendation(id: string) {
  return transition(id, 'ACTIVE', 'IntelRecommendationActivated')
}

export async function dismissRecommendation(id: string) {
  return transition(id, 'DISMISSED', 'IntelRecommendationDismissed', { dismissedAt: new Date() })
}

export async function completeRecommendation(id: string) {
  return transition(id, 'COMPLETED', 'IntelRecommendationCompleted', { completedAt: new Date() })
}

// ─── Recommendation API (read) ─────────────────────────────────────────────
export async function listRecommendations(tenantId: string, status?: string) {
  return prisma.recommendation.findMany({
    where:   { tenantId, ...(status ? { status } : {}) },
    orderBy: { score: 'desc' },
  })
}

export async function getRecommendation(id: string) {
  return prisma.recommendation.findUnique({ where: { id } })
}
