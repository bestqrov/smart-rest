// ─── Smart Intelligence Rule Engine — Contracts (K41) ──────────────────────
// Declarative rules (data), distinct from the RecommendationRule/
// InsightRule/DecisionRule registries (K35/K36/K38), which hold TypeScript
// functions (code). Conditions are evaluated against a FeatureVector (K32)
// — the same flat key/value shape Recommendation/Insight/Decision rules
// already receive, so no new data shape to learn.

import type { FeatureVector } from '../data/DataProvider'

export type RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists'

export interface RuleCondition {
  field:    string   // a FeatureVector key, e.g. "billing.mrr"
  operator: RuleOperator
  value?:   string | number | boolean
}

export interface RuleConditionGroup {
  all?: (RuleCondition | RuleConditionGroup)[]   // AND
  any?: (RuleCondition | RuleConditionGroup)[]   // OR
}

export type RuleActionType = 'ACTION' | 'DECISION'

export interface RuleActionBinding {
  type:        RuleActionType
  executorId?: string                        // K37 Action Engine executor id, when type === 'ACTION'
  input?:      Record<string, unknown>       // when type === 'ACTION'
  decision?: {                               // when type === 'DECISION'
    category:    string
    title:       string
    description: string
    priority:    'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    confidence:  number
  }
}

export interface RuleDefinitionInput {
  key:        string
  name:       string
  category:   string
  conditions: RuleConditionGroup
  action:     RuleActionBinding
  isActive?:  boolean
}

export interface EvaluationResult {
  matched:      boolean
  ruleKey:      string
  ruleVersion:  number
  action:       RuleActionBinding | null   // the binding that would/did fire
}

export type { FeatureVector }
