// ─── Smart Intelligence Marketing Advisor v1 — Service (K62) ───────────────
// Combines every detector above into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { computeEmailMetrics, computeWhatsAppMetrics, computeSocialMetrics, computeCampaignPerformance } from './MarketingMetrics'
import { rankChannelsByPerformance } from './BestChannelRecommendation'
import { detectBestPostingHours } from './BestPostingTimeDetection'
import { estimateCampaignRevenueImpact } from './RoiEstimation'
import { detectPromotionOpportunities } from './PromotionOpportunityDetection'
import { getAudienceTargetSuggestions } from './AudienceTargetingSuggestions'
import type { MarketingAdvisorSummary } from './types'

const NAMESPACE = 'marketing-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Marketing Advisor summaries',
  })
}

export async function getMarketingAdvisorSummary(tenantId: string): Promise<MarketingAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as MarketingAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [email, whatsapp, social, campaigns, channelRanking, bestPostingHours, roiEstimates, promotionOpportunities, audienceTargets] = await Promise.all([
    computeEmailMetrics(tenantId),
    computeWhatsAppMetrics(tenantId),
    computeSocialMetrics(tenantId),
    computeCampaignPerformance(tenantId),
    rankChannelsByPerformance(tenantId),
    detectBestPostingHours(tenantId),
    estimateCampaignRevenueImpact(tenantId),
    detectPromotionOpportunities(tenantId),
    getAudienceTargetSuggestions(tenantId),
  ])

  const summary: MarketingAdvisorSummary = {
    tenantId, email, whatsapp, social, campaigns, channelRanking, bestPostingHours,
    roiEstimates, promotionOpportunities, audienceTargets, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
