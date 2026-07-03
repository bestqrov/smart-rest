// ─── Smart Intelligence Staff Advisor v1 — Recommendation Rule (K64) ───────
// Ties staffing optimizations into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53/K60/K61/K62/K63
// already filled for their domains, now filled for staffing. Reuses
// getStaffingOptimizations as-is.

import { getStaffingOptimizations } from './StaffingOptimizationRecommendations'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const staffingOptimizationRecommendationRule: RecommendationRuleDefinition = {
  id:       'staffing-optimization-recommendation',
  name:     'Staffing Optimization Recommendation',
  category: 'operations',
  async evaluate(context) {
    const optimizations = await getStaffingOptimizations(context.tenant.tenantId)
    if (optimizations.length === 0) return null

    const top = optimizations[0]!

    return {
      category:    'operations',
      title:       top.title,
      description: top.description,
      score:       optimizations.length * 25,
      metadata:    { count: optimizations.length, optimizations },
    }
  },
}
