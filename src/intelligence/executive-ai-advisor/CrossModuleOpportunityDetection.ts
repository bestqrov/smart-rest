// ─── Smart Intelligence Executive AI Advisor v1 — Cross-Module Opportunities (K66) ─
// Pure extraction from the already-fetched AdvisorBundle — no new
// detection, no additional query. Each entry maps a field a domain
// advisor already computed into a normalized cross-module item.

import type { AdvisorBundle } from './AdvisorAggregation'
import type { CrossModuleOpportunity } from './types'

export function detectCrossModuleOpportunities(bundle: AdvisorBundle): CrossModuleOpportunity[] {
  const opportunities: CrossModuleOpportunity[] = []

  if (bundle.marketing.promotionOpportunities.length > 0) {
    const top = bundle.marketing.promotionOpportunities[0]!
    opportunities.push({ module: 'marketing', title: top.title, description: top.description })
  }

  if (bundle.marketing.audienceTargets.length > 0) {
    const top = bundle.marketing.audienceTargets[0]!
    opportunities.push({ module: 'marketing', title: `Target ${top.segment} segment`, description: top.suggestion })
  }

  if (bundle.reservation.lowOccupancySlots.length > 0) {
    const top = bundle.reservation.optimizations.find(o => o.type === 'PROMOTE_LOW_OCCUPANCY')
    if (top) opportunities.push({ module: 'reservation', title: top.title, description: top.description })
  }

  if (bundle.financial.marginInsights.lowMarginProducts.length > 0) {
    const opt = bundle.financial.costOptimizations.find(o => o.type === 'LOW_MARGIN_PRODUCT')
    if (opt) opportunities.push({ module: 'financial', title: opt.title, description: opt.description })
  }

  if (bundle.customer.segments.vipCustomers > 0) {
    opportunities.push({
      module: 'customer', title: `${bundle.customer.segments.vipCustomers} VIP customer(s) to engage`,
      description: 'Consider an exclusive offer or loyalty perk for top spenders.',
    })
  }

  return opportunities
}
