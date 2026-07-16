// ─── Smart Intelligence Reservation Advisor v1 — Recommendation Rule (K63) ─
// Ties optimizations into K35's Recommendation Engine — same
// "Foundation shipped zero business rules" gap K53/K60/K61/K62 already
// filled for their domains, now filled for reservations. Reuses
// getReservationOptimizations as-is.

import { getReservationOptimizations } from './OptimizationRecommendations'
import type { RecommendationRuleDefinition } from '../recommendations/types'

export const reservationOptimizationRecommendationRule: RecommendationRuleDefinition = {
  id:       'reservation-optimization-recommendation',
  name:     'Reservation Optimization Recommendation',
  category: 'operations',
  async evaluate(context) {
    const optimizations = await getReservationOptimizations(context.tenant.tenantId)
    if (optimizations.length === 0) return null

    const top = optimizations[0]!

    return {
      category:    'operations',
      title:       top.title,
      description: top.description,
      score:       optimizations.length * 30,
      metadata:    { count: optimizations.length, optimizations },
    }
  },
}
