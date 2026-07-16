// ─── Smart Intelligence Executive AI Advisor v1 — Service (K66) ────────────
// Combines already-existing K53/K55 outputs with the new cross-module
// detectors into one executive briefing. Cached via K44's short-term
// Memory Engine — same 5-minute pattern used throughout this module.
// healthScore/topPriorities/criticalAlerts are reused verbatim, not
// recomputed — K53's computeBusinessHealthScore and K55's
// getTopPriorities/getCriticalAlerts already exist for exactly this.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { computeBusinessHealthScore } from '../business-advisor'
import { getTopPriorities, getCriticalAlerts } from '../executive-dashboard'
import { fetchAdvisorBundle, getAdvisorContributions } from './AdvisorAggregation'
import { detectCrossModuleOpportunities } from './CrossModuleOpportunityDetection'
import { detectCrossModuleRisks } from './CrossModuleRiskDetection'
import { buildExecutiveActionPlan } from './ExecutiveActionPlan'
import type { ExecutiveBriefing } from './types'

const NAMESPACE = 'executive-ai-advisor'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureBriefingCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Executive AI Advisor briefings',
  })
}

export async function getExecutiveBriefing(tenantId: string): Promise<ExecutiveBriefing> {
  ensureBriefingCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'briefing')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as ExecutiveBriefing
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [healthScore, topPriorities, criticalAlerts, bundle] = await Promise.all([
    computeBusinessHealthScore(tenantId),
    getTopPriorities(tenantId, 5),
    getCriticalAlerts(tenantId),
    fetchAdvisorBundle(tenantId),
  ])

  const crossModuleOpportunities = detectCrossModuleOpportunities(bundle)
  const crossModuleRisks = detectCrossModuleRisks(bundle)
  const actionPlan = await buildExecutiveActionPlan(tenantId, crossModuleRisks, crossModuleOpportunities)
  const advisorContributions = getAdvisorContributions(bundle)

  const briefing: ExecutiveBriefing = {
    tenantId, healthScore, topPriorities, criticalAlerts, crossModuleOpportunities,
    crossModuleRisks, actionPlan, advisorContributions, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'briefing', JSON.stringify(briefing))
  return briefing
}
