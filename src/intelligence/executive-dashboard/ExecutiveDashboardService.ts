// ─── Smart Intelligence Executive Dashboard — Service (K55) ────────────────
// Combines every already-existing signal into one read-only DTO. No
// recomputation: healthScore reuses K53's computeBusinessHealthScore
// as-is. Cached through K44's Memory Engine (same 5-minute short-term
// pattern K53/K54 already use).

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { computeBusinessHealthScore } from '../business-advisor'
import { getExecutiveKpis } from './KpiAggregation'
import { getTopPriorities } from './TopPriorities'
import { getCriticalAlerts } from './CriticalAlerts'
import { getRecommendationsSummary } from './RecommendationsSummary'
import { getOpportunitiesSummary } from './OpportunitiesSummary'
import { getExecutiveTimeline } from './ExecutiveTimeline'
import type { ExecutiveDashboard } from './types'

const NAMESPACE = 'executive-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Executive Dashboard snapshots',
  })
}

export async function getExecutiveDashboard(tenantId: string): Promise<ExecutiveDashboard> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'snapshot')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as ExecutiveDashboard
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [healthScore, kpis, topPriorities, criticalAlerts, recommendations, opportunities, timeline] = await Promise.all([
    computeBusinessHealthScore(tenantId),
    getExecutiveKpis(tenantId),
    getTopPriorities(tenantId),
    getCriticalAlerts(tenantId),
    getRecommendationsSummary(tenantId),
    getOpportunitiesSummary(tenantId),
    getExecutiveTimeline(tenantId),
  ])

  const dashboard: ExecutiveDashboard = {
    tenantId,
    healthScore: { score: healthScore.score, label: healthScore.label },
    kpis, topPriorities, criticalAlerts, recommendations, opportunities, timeline,
    generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'snapshot', JSON.stringify(dashboard))
  return dashboard
}
