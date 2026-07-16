// ─── Smart Intelligence Customer Advisor v1 — LTV Estimation (K61) ─────────
// Rule-based, no ML: estimated annual LTV = avg order value × observed
// order frequency projected to a year. Reuses computeCustomerMetrics — no
// new spend calculation.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { CustomerLtvEstimate } from './types'

export async function estimateCustomerLtv(tenantId: string, limit = 10, windowDays = 90): Promise<CustomerLtvEstimate[]> {
  const metrics = await computeCustomerMetrics(tenantId, windowDays)

  return metrics
    .filter(m => m.orderCount > 0)
    .map((m): CustomerLtvEstimate => {
      const avgOrderValue = m.totalSpend / m.orderCount
      const ordersPerYear = (m.orderCount / windowDays) * 365
      return {
        phone: m.phone, name: m.name, historicalSpend: m.totalSpend,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        estimatedAnnualLtv: Math.round(avgOrderValue * ordersPerYear),
      }
    })
    .sort((a, b) => b.estimatedAnnualLtv - a.estimatedAnnualLtv)
    .slice(0, limit)
}
