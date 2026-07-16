// ─── Smart Intelligence Customer Advisor v1 — Contracts (K61) ──────────────
// Rule-based only, no LLM. Every detector below reuses the single
// computeCustomerMetrics helper (CustomerMetrics.ts) — no CRM/spend
// aggregation is calculated more than once.

import type { MembershipTier } from '../../loyalty/LoyaltyService'

export interface CustomerMetric {
  phone:              string
  name:               string | null
  visits:             number
  createdAt:          Date
  lastVisit:          Date
  daysSinceLastVisit: number
  totalSpend:         number
  orderCount:         number
  loyaltyTier:        MembershipTier
}

export interface ChurnRiskCustomer {
  phone:              string
  name:               string | null
  daysSinceLastVisit: number
  visits:             number
  riskLevel:          'HIGH' | 'MEDIUM'
}

export interface CustomerLtvEstimate {
  phone:            string
  name:             string | null
  historicalSpend:  number
  avgOrderValue:    number
  estimatedAnnualLtv: number
}

export interface VisitFrequencyBucket {
  bucket:     'FREQUENT' | 'REGULAR' | 'OCCASIONAL' | 'RARE'
  count:      number
}

export interface CustomerSegmentCounts {
  newCustomers:     number
  vipCustomers:     number
  churnRisk:        number
  inactiveCustomers: number
  totalCustomers:   number
}

export interface RetentionAction {
  phone:       string
  name:        string | null
  reason:      'CHURN_RISK' | 'INACTIVE'
  suggestion:  string
}

export interface CustomerAdvisorSummary {
  tenantId:          string
  segments:          CustomerSegmentCounts
  newCustomers:      CustomerMetric[]
  vipCustomers:      CustomerMetric[]
  churnRisk:         ChurnRiskCustomer[]
  inactiveCustomers: ChurnRiskCustomer[]
  visitFrequency:    VisitFrequencyBucket[]
  topLtvCustomers:   CustomerLtvEstimate[]
  retentionActions:  RetentionAction[]
  generatedAt:       Date
}
