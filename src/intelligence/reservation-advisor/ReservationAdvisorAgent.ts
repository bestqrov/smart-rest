// ─── Smart Intelligence Reservation Advisor v1 — Reactive Bridge (K63) ─────
// One K40 framework agent (same reactive-agent idiom as K53/K60/K61/K62's
// siblings) that keeps the cached summary + K35 recommendation fresh when
// relevant reservation events fire. Rule-based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getReservationAdvisorSummary } from './ReservationAdvisorService'
import { reservationOptimizationRecommendationRule } from './ReservationRecommendationRule'

const AGENT_ID = 'reservation-advisor-agent'

function registerBuiltinReservationRecommendationRule(): void {
  if (!hasRecommendationRule(reservationOptimizationRecommendationRule.id)) {
    registerRecommendationRule(reservationOptimizationRecommendationRule)
  }
}

export function registerReservationAdvisorAgent(): void {
  registerBuiltinReservationRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Reservation Advisor Agent', module: 'reservation-advisor',
    events: ['ReservationCreated', 'ReservationNoShow', 'ReservationCancelled', 'ReservationCheckedIn'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getReservationAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
