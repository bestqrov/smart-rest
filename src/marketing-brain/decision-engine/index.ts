// ─── Entry point ──────────────────────────────────────────────────────────────

export { decide } from './DecisionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { DecisionContext, ResolvedDecisionContext, CampaignGoal } from './DecisionContext'

export type {
  DecisionResult,
  ReasoningTrail,
  DecisionStep,
  ScoreBreakdown,
  DecisionDimension,
} from './DecisionResult'

// ─── Rule evaluation (pure, unit-testable) ────────────────────────────────────

export {
  evaluateRule,
  filterApplicableRules,
  mergeRuleConstraints,
  explainRuleMatch,
} from './RuleEvaluator'

export type { MergedConstraints } from './RuleEvaluator'

// ─── Confidence scoring (pure, unit-testable) ─────────────────────────────────

export {
  scoreTemplate,
  scoreVariables,
  scoreRules,
  scoreScenario,
  buildScoreBreakdown,
  buildReasoningTrail,
  failedStep,
  successStep,
} from './ConfidenceScore'

// ─── Validators ───────────────────────────────────────────────────────────────

export { validateDecisionContext, assertDecisionContext } from '../validators/DecisionValidator'
export { validateVariables, requiredKeysFromDefs, allRequiredPresent } from '../validators/VariableValidator'
