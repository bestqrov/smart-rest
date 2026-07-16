// ─── Smart Intelligence Business Advisor v1 — Public API (K53) ─────────────

export type {
  BusinessHealthScore, PriorityIssue, BusinessOpportunity, RecommendedNextAction,
  NextActionSource, UnifiedBusinessSummary,
} from './types'

export {
  registerBusinessAdvisorV1,
  getUnifiedBusinessSummary,
  computeBusinessHealthScore,
  detectPriorityIssues,
  detectOpportunities,
  getRecommendedNextActions,
} from './BusinessAdvisorService'
