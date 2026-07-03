// ─── Smart Intelligence Marketing Advisor v1 — Promotion Opportunities (K62) ─
// Reuses K60's detectOverstockItems and K61's detectChurnRiskCustomers
// directly — no new inventory/CRM detection, just a marketing framing of
// signals those modules already compute.

import { detectOverstockItems } from '../inventory-advisor'
import { detectChurnRiskCustomers } from '../customer-advisor'
import type { PromotionOpportunity } from './types'

export async function detectPromotionOpportunities(tenantId: string): Promise<PromotionOpportunity[]> {
  const [overstock, churnRisk] = await Promise.all([
    detectOverstockItems(tenantId),
    detectChurnRiskCustomers(tenantId),
  ])

  const opportunities: PromotionOpportunity[] = []

  if (overstock.length > 0) {
    opportunities.push({
      reason: 'OVERSTOCK', refCount: overstock.length,
      title:  `Run a promotion to move ${overstock.length} overstocked ingredient(s)`,
      description: `"${overstock[0]!.ingredientName}" has ${overstock[0]!.daysOfStockOnHand} days of stock on hand — feature dishes using it.`,
    })
  }

  if (churnRisk.length > 0) {
    opportunities.push({
      reason: 'CHURN_RISK', refCount: churnRisk.length,
      title:  `Win-back campaign for ${churnRisk.length} at-risk customer(s)`,
      description: `${churnRisk.length} previously-regular customers haven't visited recently — a targeted offer could bring them back.`,
    })
  }

  return opportunities
}
