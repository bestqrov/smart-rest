// ─── Business Skills Pack v1 — Review Insight Rule (K52) ───────────────────
// Rule-based only, no LLM. Triggered on ReviewSubmitted (K21 Reviews &
// Reputation, existing event). Reuses ReviewService.getRatingAnalytics —
// the same function K32's reviewsAdapter already wraps — no new storage.

import { getRatingAnalytics } from '../../reviews/ReviewService'
import type { InsightRuleDefinition } from '../insights/types'

export const reviewInsightRule: InsightRuleDefinition = {
  id:       'review-insight',
  name:     'Review Rating Insight',
  category: 'reviews',
  events:   ['ReviewSubmitted'],
  async evaluate(event) {
    const tenantId = event.tenantId
    if (!tenantId) return null

    const analytics = await getRatingAnalytics(tenantId)
    if (analytics.count < 5 || analytics.averageRating >= 3.5) return null

    return {
      category:    'reviews',
      severity:    analytics.averageRating < 2.5 ? 'CRITICAL' : 'WARNING',
      title:       'Average rating trending low',
      description: `Average rating is ${analytics.averageRating.toFixed(1)} across ${analytics.count} reviews.`,
      metadata:    { count: analytics.count, averageRating: analytics.averageRating },
    }
  },
}
