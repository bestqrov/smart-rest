// ─── Smart Intelligence Automation Advisor — Public API (K54) ──────────────

export type {
  AutomationOpportunity, AutomationRecommendation, AutomationReadinessScore,
  AutomationActionPlanStep, AutomationActionPlan, AutomationImpactEstimate,
  PendingAutomationDecision, AutomationAdvisorSummary,
} from './types'

export { detectAutomationOpportunities } from './OpportunityDetection'
export { computeAutomationReadinessScore } from './ReadinessScoring'
export { generateAutomationRecommendations } from './RecommendationEngine'
export { generateActionPlan } from './ActionPlanGenerator'
export { estimateAutomationImpact } from './ImpactEstimation'
export { proposeAutomationForApproval, listPendingAutomationApprovals } from './ApprovalWorkflow'
export {
  getAutomationAdvisorSummary, getBusinessAndAutomationSummary,
  type BusinessAndAutomationSummary,
} from './AutomationAdvisorService'
