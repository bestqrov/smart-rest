// ─── Smart Intelligence Customer Advisor v1 — Service (K61) ────────────────
// Combines every detector above into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { detectNewCustomers } from './NewCustomerDetection'
import { identifyVipCustomers } from './VipIdentification'
import { detectChurnRiskCustomers } from './ChurnRiskDetection'
import { detectInactiveCustomers } from './InactiveCustomerDetection'
import { analyzeVisitFrequency } from './VisitFrequencyAnalysis'
import { estimateCustomerLtv } from './LtvEstimation'
import { getCustomerSegmentCounts } from './SegmentationInsights'
import { getRecommendedRetentionActions } from './RetentionActions'
import type { CustomerAdvisorSummary } from './types'

const NAMESPACE = 'customer-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Customer Advisor summaries',
  })
}

export async function getCustomerAdvisorSummary(tenantId: string): Promise<CustomerAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as CustomerAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [segments, newCustomers, vipCustomers, churnRisk, inactiveCustomers, visitFrequency, topLtvCustomers, retentionActions] = await Promise.all([
    getCustomerSegmentCounts(tenantId),
    detectNewCustomers(tenantId),
    identifyVipCustomers(tenantId),
    detectChurnRiskCustomers(tenantId),
    detectInactiveCustomers(tenantId),
    analyzeVisitFrequency(tenantId),
    estimateCustomerLtv(tenantId),
    getRecommendedRetentionActions(tenantId),
  ])

  const summary: CustomerAdvisorSummary = {
    tenantId, segments, newCustomers, vipCustomers, churnRisk, inactiveCustomers,
    visitFrequency, topLtvCustomers, retentionActions, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
