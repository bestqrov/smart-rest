// ─── Smart Intelligence Marketing Advisor v1 — Reactive Bridge (K62) ───────
// One K40 framework agent (same reactive-agent idiom as K53/K60/K61's
// siblings) that keeps the cached summary + K35 recommendation fresh when
// relevant marketing events fire. Rule-based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getMarketingAdvisorSummary } from './MarketingAdvisorService'
import { marketingPromotionRecommendationRule } from './MarketingRecommendationRule'

const AGENT_ID = 'marketing-advisor-agent'

function registerBuiltinMarketingRecommendationRule(): void {
  if (!hasRecommendationRule(marketingPromotionRecommendationRule.id)) {
    registerRecommendationRule(marketingPromotionRecommendationRule)
  }
}

export function registerMarketingAdvisorAgent(): void {
  registerBuiltinMarketingRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Marketing Advisor Agent', module: 'marketing-advisor',
    events: ['EmailMessageOpened', 'WhatsAppMessageSent', 'SocialPostPublished', 'CampaignCompleted'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getMarketingAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
