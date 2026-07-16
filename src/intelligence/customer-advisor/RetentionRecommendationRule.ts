// ─── Smart Intelligence Customer Advisor v1 — Recommendation Rule (K61) ────
// Ties retention actions into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53 filled for
// opportunities, K60 filled for inventory, now filled for customer
// retention. Reuses getRecommendedRetentionActions as-is.

import { getRecommendedRetentionActions } from './RetentionActions'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const customerRetentionRecommendationRule: RecommendationRuleDefinition = {
  id:       'customer-retention-recommendation',
  name:     'Customer Retention Recommendation',
  category: 'growth',
  async evaluate(context) {
    const actions = await getRecommendedRetentionActions(context.tenant.tenantId)
    if (actions.length === 0) return null

    const churnRiskCount = actions.filter(a => a.reason === 'CHURN_RISK').length

    return {
      category:    'growth',
      title:       `${actions.length} customer(s) need retention attention`,
      description: `${churnRiskCount} at churn risk, ${actions.length - churnRiskCount} inactive — consider a win-back campaign.`,
      score:       Math.min(100, actions.length * 5),
      metadata:    { count: actions.length, actions: actions.slice(0, 5) },
    }
  },
}
