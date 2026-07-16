// ─── Smart Intelligence Executive AI Advisor v1 — Public API (K66) ─────────

export type {
  AdvisorContribution, CrossModuleOpportunity, CrossModuleRisk,
  ExecutiveActionItem, ExecutiveBriefing,
} from './types'

export { fetchAdvisorBundle, getAdvisorContributions, type AdvisorBundle } from './AdvisorAggregation'
export { detectCrossModuleOpportunities } from './CrossModuleOpportunityDetection'
export { detectCrossModuleRisks } from './CrossModuleRiskDetection'
export { buildExecutiveActionPlan } from './ExecutiveActionPlan'
export { getExecutiveBriefing } from './ExecutiveAIAdvisorService'
export { registerExecutiveAIAdvisorAgent } from './ExecutiveAIAdvisorAgent'
