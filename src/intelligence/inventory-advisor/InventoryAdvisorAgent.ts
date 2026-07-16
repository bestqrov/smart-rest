// ─── Smart Intelligence Inventory Advisor v1 — Reactive Bridge (K60) ───────
// One K40 framework agent (same reactive-agent idiom as K53's
// business-advisor-agent) that keeps the cached summary + K35
// recommendation fresh when relevant inventory/order events fire. Rule-
// based only, no LLM.

import { registerFrameworkAgent } from '../agents'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { getInventoryAdvisorSummary } from './InventoryAdvisorService'
import { inventoryReorderRecommendationRule } from './ReorderRecommendationRule'

const AGENT_ID = 'inventory-advisor-agent'

function registerBuiltinInventoryRecommendationRule(): void {
  if (!hasRecommendationRule(inventoryReorderRecommendationRule.id)) {
    registerRecommendationRule(inventoryReorderRecommendationRule)
  }
}

export function registerInventoryAdvisorAgent(): void {
  registerBuiltinInventoryRecommendationRule()

  registerFrameworkAgent({
    id: AGENT_ID, name: 'Inventory Advisor Agent', module: 'inventory-advisor',
    events: ['StockLow', 'OrderCompleted'],
    capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'],
    permissions: { capabilities: ['insight:read', 'recommendation:read', 'recommendation:create'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await Promise.all([
        getInventoryAdvisorSummary(event.tenantId),
        runRecommendationEngine(event.tenantId),
      ])
    },
  })
}
