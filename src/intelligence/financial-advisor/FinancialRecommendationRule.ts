// ─── Smart Intelligence Financial Advisor v1 — Recommendation Rule (K65) ───
// Ties cost optimizations into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53/K60-K64 already filled
// for their domains, now filled for finance. Reuses
// detectCostOptimizations as-is.

import { detectCostOptimizations } from './CostOptimizationDetection'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const financialOptimizationRecommendationRule: RecommendationRuleDefinition = {
  id:       'financial-optimization-recommendation',
  name:     'Financial Optimization Recommendation',
  category: 'billing',
  async evaluate(context) {
    const opportunities = await detectCostOptimizations(context.tenant.tenantId)
    if (opportunities.length === 0) return null

    const top = opportunities[0]!

    return {
      category:    'billing',
      title:       top.title,
      description: top.description,
      score:       opportunities.length * 35,
      metadata:    { count: opportunities.length, opportunities },
    }
  },
}
