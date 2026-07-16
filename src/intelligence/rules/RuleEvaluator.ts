// ─── Smart Intelligence Rule Engine — Condition Evaluator (K41) ────────────
// Pure function, no I/O, no side effects — safe to call from both live
// evaluation and the testing interface without risk of a false trigger.

import type { RuleCondition, RuleConditionGroup, FeatureVector } from './types'

function evaluateCondition(condition: RuleCondition, data: FeatureVector): boolean {
  const actual = data[condition.field]

  switch (condition.operator) {
    case 'exists':  return actual !== undefined && actual !== null
    case 'eq':      return actual === condition.value
    case 'neq':     return actual !== condition.value
    case 'gt':      return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value
    case 'gte':     return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value
    case 'lt':      return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value
    case 'lte':     return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value
    case 'contains': return typeof actual === 'string' && typeof condition.value === 'string' && actual.includes(condition.value)
    default:        return false
  }
}

export function evaluateConditionGroup(group: RuleConditionGroup, data: FeatureVector): boolean {
  const evalEntry = (entry: RuleCondition | RuleConditionGroup): boolean =>
    'field' in entry ? evaluateCondition(entry, data) : evaluateConditionGroup(entry, data)

  if (group.all) return group.all.every(evalEntry)
  if (group.any) return group.any.some(evalEntry)
  return false // an empty group never matches — avoids accidentally-always-true rules
}
