// ─── Smart Intelligence Marketing Advisor v1 — Recommendation Rule (K62) ───
// Ties promotion opportunities into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53/K60/K61 already filled
// for their domains, now filled for marketing. Reuses
// detectPromotionOpportunities as-is.

import { detectPromotionOpportunities } from './PromotionOpportunityDetection'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const marketingPromotionRecommendationRule: RecommendationRuleDefinition = {
  id:       'marketing-promotion-recommendation',
  name:     'Marketing Promotion Recommendation',
  category: 'growth',
  async evaluate(context) {
    const opportunities = await detectPromotionOpportunities(context.tenant.tenantId)
    if (opportunities.length === 0) return null

    const top = opportunities[0]!

    return {
      category:    'growth',
      title:       top.title,
      description: top.description,
      score:       Math.min(100, top.refCount * 8),
      metadata:    { opportunities },
    }
  },
}
