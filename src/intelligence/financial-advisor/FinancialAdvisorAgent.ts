// ─── Smart Intelligence Financial Advisor v1 — Reactive Bridge (K65) ───────
// One K40 framework agent (same reactive-agent idiom as K53/K60-K64's
// siblings) that keeps the cached summary + K35 recommendation fresh when
// relevant order/billing events fire. Rule-based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getFinancialAdvisorSummary } from './FinancialAdvisorService'
import { financialOptimizationRecommendationRule } from './FinancialRecommendationRule'

const AGENT_ID = 'financial-advisor-agent'

function registerBuiltinFinancialRecommendationRule(): void {
  if (!hasRecommendationRule(financialOptimizationRecommendationRule.id)) {
    registerRecommendationRule(financialOptimizationRecommendationRule)
  }
}

export function registerFinancialAdvisorAgent(): void {
  registerBuiltinFinancialRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Financial Advisor Agent', module: 'financial-advisor',
    events: ['OrderCompleted', 'PosOrderClosed'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getFinancialAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
