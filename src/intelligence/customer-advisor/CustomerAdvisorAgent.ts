// ─── Smart Intelligence Customer Advisor v1 — Reactive Bridge (K61) ────────
// One K40 framework agent (same reactive-agent idiom as K53/K60's
// siblings) that keeps the cached summary + K35 recommendation fresh when
// relevant CRM/order events fire. Rule-based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getCustomerAdvisorSummary } from './CustomerAdvisorService'
import { customerRetentionRecommendationRule } from './RetentionRecommendationRule'

const AGENT_ID = 'customer-advisor-agent'

function registerBuiltinCustomerRecommendationRule(): void {
  if (!hasRecommendationRule(customerRetentionRecommendationRule.id)) {
    registerRecommendationRule(customerRetentionRecommendationRule)
  }
}

export function registerCustomerAdvisorAgent(): void {
  registerBuiltinCustomerRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Customer Advisor Agent', module: 'customer-advisor',
    events: ['OrderCompleted', 'CustomerTagged'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getCustomerAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
