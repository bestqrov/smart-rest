// ─── Smart Intelligence Customer Advisor v1 — Inactive Customer Detection (K61) ─
// Rule-based: no visit in 90+ days. Reuses computeCustomerMetrics — no new
// calculation.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { ChurnRiskCustomer } from './types'

const INACTIVE_DAYS_THRESHOLD = 90

export async function detectInactiveCustomers(tenantId: string, windowDays?: number): Promise<ChurnRiskCustomer[]> {
  const metrics = await computeCustomerMetrics(tenantId, windowDays)

  return metrics
    .filter(m => m.daysSinceLastVisit >= INACTIVE_DAYS_THRESHOLD)
    .map((m): ChurnRiskCustomer => ({
      phone: m.phone, name: m.name, daysSinceLastVisit: m.daysSinceLastVisit, visits: m.visits,
      riskLevel: 'HIGH',
    }))
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
}
