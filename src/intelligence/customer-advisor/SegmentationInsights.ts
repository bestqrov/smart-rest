// ─── Smart Intelligence Customer Advisor v1 — Segmentation Insights (K61) ──
// Pure counts over the other detectors' own results — no second scan of
// the customer base.

import { computeCustomerMetrics } from './CustomerMetrics'
import { detectNewCustomers } from './NewCustomerDetection'
import { identifyVipCustomers } from './VipIdentification'
import { detectChurnRiskCustomers } from './ChurnRiskDetection'
import { detectInactiveCustomers } from './InactiveCustomerDetection'
import type { CustomerSegmentCounts } from './types'

export async function getCustomerSegmentCounts(tenantId: string): Promise<CustomerSegmentCounts> {
  const [allCustomers, newCustomers, vipCustomers, churnRisk, inactiveCustomers] = await Promise.all([
    computeCustomerMetrics(tenantId),
    detectNewCustomers(tenantId),
    identifyVipCustomers(tenantId),
    detectChurnRiskCustomers(tenantId),
    detectInactiveCustomers(tenantId),
  ])

  return {
    newCustomers: newCustomers.length, vipCustomers: vipCustomers.length,
    churnRisk: churnRisk.length, inactiveCustomers: inactiveCustomers.length,
    totalCustomers: allCustomers.length,
  }
}
