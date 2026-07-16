// ─── Smart Intelligence Customer Advisor v1 — New Customer Detection (K61) ─
// Reuses computeCustomerMetrics (CafeCustomer.createdAt, already tracked)
// — no second query, consistent CustomerMetric shape with every other
// detector in this module.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { CustomerMetric } from './types'

const DEFAULT_WINDOW_DAYS = 7

export async function detectNewCustomers(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<CustomerMetric[]> {
  const metrics = await computeCustomerMetrics(tenantId)
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000

  return metrics
    .filter(m => m.createdAt.getTime() >= since)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
