// ─── Smart Intelligence Staff Advisor v1 — Reactive Bridge (K64) ───────────
// One K40 framework agent (same reactive-agent idiom as K53/K60-K63's
// siblings) that keeps the cached summary + K35 recommendation fresh when
// relevant POS events fire. Rule-based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getStaffAdvisorSummary } from './StaffAdvisorService'
import { staffingOptimizationRecommendationRule } from './StaffRecommendationRule'

const AGENT_ID = 'staff-advisor-agent'

function registerBuiltinStaffRecommendationRule(): void {
  if (!hasRecommendationRule(staffingOptimizationRecommendationRule.id)) {
    registerRecommendationRule(staffingOptimizationRecommendationRule)
  }
}

export function registerStaffAdvisorAgent(): void {
  registerBuiltinStaffRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Staff Advisor Agent', module: 'staff-advisor',
    events: ['PosOrderClosed'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getStaffAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
