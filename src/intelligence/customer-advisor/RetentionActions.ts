// ─── Smart Intelligence Customer Advisor v1 — Retention Actions (K61) ──────
// Rule-based transform of ChurnRiskDetection + InactiveCustomerDetection —
// no new detection.

import { detectChurnRiskCustomers } from './ChurnRiskDetection'
import { detectInactiveCustomers } from './InactiveCustomerDetection'
import type { RetentionAction } from './types'

export async function getRecommendedRetentionActions(tenantId: string, limit = 10): Promise<RetentionAction[]> {
  const [churnRisk, inactive] = await Promise.all([
    detectChurnRiskCustomers(tenantId),
    detectInactiveCustomers(tenantId),
  ])

  const actions: RetentionAction[] = [
    ...churnRisk.map((c): RetentionAction => ({
      phone: c.phone, name: c.name, reason: 'CHURN_RISK',
      suggestion: `Send a "we miss you" offer — ${c.visits} past visits, last seen ${c.daysSinceLastVisit} days ago.`,
    })),
    ...inactive.slice(0, limit).map((c): RetentionAction => ({
      phone: c.phone, name: c.name, reason: 'INACTIVE',
      suggestion: `Consider a win-back campaign — inactive for ${c.daysSinceLastVisit} days.`,
    })),
  ]

  return actions.slice(0, limit)
}
