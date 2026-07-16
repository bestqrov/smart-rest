// ─── Smart Intelligence Decision Engine — Public API (K38) ─────────────────

export type {
  DecisionStatus, DecisionPriority, DecisionCandidate, DecisionRuleDefinition, DecisionEvaluationInput,
} from './types'

export {
  registerDecisionRule,
  getDecisionRule,
  hasDecisionRule,
  getAllDecisionRules,
  getDecisionRulesByCategory,
} from './DecisionRuleRegistry'

export {
  evaluateDecisions,
  approveDecision,
  rejectDecision,
  executeDecision,
  listDecisions,
  getDecision,
} from './DecisionEngine'
