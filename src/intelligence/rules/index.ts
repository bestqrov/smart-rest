// ─── Smart Intelligence Rule Engine — Public API (K41) ─────────────────────

export type {
  RuleOperator, RuleCondition, RuleConditionGroup, RuleActionType,
  RuleActionBinding, RuleDefinitionInput, EvaluationResult,
} from './types'

export { evaluateConditionGroup } from './RuleEvaluator'

export {
  defineRule, getActiveRule, getRuleHistory, listRules,
} from './RuleRegistry'
export type { StoredRule } from './RuleRegistry'

export { evaluateRuleForTenant, testRule } from './RuleEngine'
