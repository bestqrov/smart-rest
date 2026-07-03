// ─── Business Advisor v1 — Unified Business Summary (K53) ──────────────────
// Combines the three signals above into one snapshot, cached through K44's
// Memory Engine (short-term, 5 minutes) as the dashboard integration hook —
// a dashboard can poll this cheaply without recomputing on every load.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { computeBusinessHealthScore } from './BusinessHealthScore'
import { detectPriorityIssues } from './PriorityIssueDetection'
import { detectOpportunities } from './OpportunityDetection'
import { getRecommendedNextActions } from './NextActions'
import type { UnifiedBusinessSummary } from './types'

const NAMESPACE = 'business-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Business Advisor unified summaries for dashboard polling',
  })
}

export async function getUnifiedBusinessSummary(tenantId: string): Promise<UnifiedBusinessSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as UnifiedBusinessSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [healthScore, issues, opportunities, nextActions] = await Promise.all([
    computeBusinessHealthScore(tenantId),
    detectPriorityIssues(tenantId),
    detectOpportunities(tenantId),
    getRecommendedNextActions(tenantId),
  ])

  const summary: UnifiedBusinessSummary = {
    tenantId, healthScore, issues, opportunities, nextActions, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
