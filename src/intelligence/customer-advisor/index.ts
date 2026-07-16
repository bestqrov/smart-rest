// ─── Smart Intelligence Customer Advisor v1 — Public API (K61) ─────────────

export type {
  CustomerMetric, ChurnRiskCustomer, CustomerLtvEstimate, VisitFrequencyBucket,
  CustomerSegmentCounts, RetentionAction, CustomerAdvisorSummary,
} from './types'

export { computeCustomerMetrics } from './CustomerMetrics'
export { detectNewCustomers } from './NewCustomerDetection'
export { identifyVipCustomers } from './VipIdentification'
export { detectChurnRiskCustomers } from './ChurnRiskDetection'
export { detectInactiveCustomers } from './InactiveCustomerDetection'
export { analyzeVisitFrequency } from './VisitFrequencyAnalysis'
export { estimateCustomerLtv } from './LtvEstimation'
export { getCustomerSegmentCounts } from './SegmentationInsights'
export { getRecommendedRetentionActions } from './RetentionActions'
export { customerRetentionRecommendationRule } from './RetentionRecommendationRule'
export { getCustomerAdvisorSummary } from './CustomerAdvisorService'
export { registerCustomerAdvisorAgent } from './CustomerAdvisorAgent'
