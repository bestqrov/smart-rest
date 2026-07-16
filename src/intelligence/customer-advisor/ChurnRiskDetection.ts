// ─── Smart Intelligence Customer Advisor v1 — Churn Risk Detection (K61) ───
// Rule-based: previously-regular customers (visits >= 3) who have gone
// quiet for 30-90 days. Reuses computeCustomerMetrics — no new calculation.
// Beyond 90 days a customer is InactiveCustomerDetection's concern, not
// "at risk" (they're already gone), so the two never overlap.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { ChurnRiskCustomer } from './types'

const MIN_VISITS_TO_BE_REGULAR = 3
const RISK_WINDOW_START_DAYS = 30
const RISK_WINDOW_END_DAYS = 90

export async function detectChurnRiskCustomers(tenantId: string, windowDays?: number): Promise<ChurnRiskCustomer[]> {
  const metrics = await computeCustomerMetrics(tenantId, windowDays)

  return metrics
    .filter(m => m.visits >= MIN_VISITS_TO_BE_REGULAR && m.daysSinceLastVisit >= RISK_WINDOW_START_DAYS && m.daysSinceLastVisit < RISK_WINDOW_END_DAYS)
    .map((m): ChurnRiskCustomer => ({
      phone: m.phone, name: m.name, daysSinceLastVisit: m.daysSinceLastVisit, visits: m.visits,
      riskLevel: m.daysSinceLastVisit >= 60 ? 'HIGH' : 'MEDIUM',
    }))
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
}
