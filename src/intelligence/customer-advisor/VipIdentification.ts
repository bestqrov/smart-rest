// ─── Smart Intelligence Customer Advisor v1 — VIP Identification (K61) ─────
// Rule-based: top spenders by historical spend, or GOLD loyalty tier (K20
// getTier, already reused inside computeCustomerMetrics). No new ranking
// model, reuses computeCustomerMetrics.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { CustomerMetric } from './types'

export async function identifyVipCustomers(tenantId: string, limit = 10, windowDays?: number): Promise<CustomerMetric[]> {
  const metrics = await computeCustomerMetrics(tenantId, windowDays)

  return metrics
    .filter(m => m.totalSpend > 0 || m.loyaltyTier === 'GOLD')
    .sort((a, b) => {
      if (a.loyaltyTier === 'GOLD' && b.loyaltyTier !== 'GOLD') return -1
      if (b.loyaltyTier === 'GOLD' && a.loyaltyTier !== 'GOLD') return 1
      return b.totalSpend - a.totalSpend
    })
    .slice(0, limit)
}
