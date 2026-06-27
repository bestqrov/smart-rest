/**
 * Marketing Brain — public API surface
 *
 * Sprint 1 + 2:   database layer (Mongoose models + seed).
 * Sprint 2.5:     knowledge layer (cultural + strategy enrichment).
 * Sprint 3:       decision engine — deterministic, confidence-scored,
 *                 with full reasoning trail. No AI calls.
 */

export { connect, disconnect } from './connection'

export {
  Language, Country, BusinessType, Persona,
  Scenario, Objection, MessageTemplate, FollowupSequence,
  AIRule, Variable, TemplatePerformance,
} from './models'

export type {
  ILanguage,
  ICountry,  Region,
  IBusinessType,
  IPersona,
  IScenario, FunnelStage,
  IObjection, ObjectionCategory, ObjectionFrequency,
  IMessageTemplate, Channel, Format, Tone,
  IFollowupSequence, ISequenceStep, StepCondition,
  IAIRule, RuleType, IAppliesTo, IRuleBody,
  IVariable, VariableDataType, VariableSource,
  ITemplatePerformance, PerformancePeriod,
} from './models'

export { seedMarketingBrain } from './seed'

// ── Service layer (Sprint 3) ──────────────────────────────────────────────────

export {
  decide,
  select,
  resolveAIRules,
  resolveVariables,
  render,
  extractKeys,
  planFollowup,
  buildPrompt,
  validateLeadProfile,
  validateResolvedVariables,
  validateBuiltPrompt,
  assertLeadProfile,
  mergeConstraints,
} from './services'

export type {
  LeadProfile,
  ResolvedContext,
  TemplateMatch,
  SequenceMatch,
  VariableResolution,
  BuiltPrompt,
  DecisionResult,
} from './types'

export type { PromptBuildArgs } from './services'

// ── Knowledge layer (Sprint 2.5) ──────────────────────────────────────────────
// Service namespaces: CountryKnowledgeService.getByCode('MA'), etc.

export * as CountryKnowledgeService      from './knowledge/CountryKnowledgeService'
export * as PersonaKnowledgeService      from './knowledge/PersonaKnowledgeService'
export * as ScenarioKnowledgeService     from './knowledge/ScenarioKnowledgeService'
export * as ObjectionKnowledgeService    from './knowledge/ObjectionKnowledgeService'
export * as BusinessTypeKnowledgeService from './knowledge/BusinessTypeKnowledgeService'

// Knowledge object types
export type {
  CountryKnowledge,
  PersonaKnowledge,
  ScenarioKnowledge,
  ObjectionKnowledge,
  BusinessTypeKnowledge,
  ContactChannel,
} from './knowledge/types'

export { createCache, withCache } from './knowledge/cache'
export type { KnowledgeCache }    from './knowledge/cache'

// ── Decision Engine (Sprint 3 — new structured layer) ────────────────────────
// Primary entry point: decide(context) → DecisionResult with confidence + reasoning

export { decide as decideV2 } from './decision-engine/DecisionEngine'

export type {
  DecisionContext,
  ResolvedDecisionContext,
  CampaignGoal,
} from './decision-engine/DecisionContext'

export type {
  DecisionResult   as DecisionResultV2,
  ReasoningTrail,
  DecisionStep,
  ScoreBreakdown,
  DecisionDimension,
} from './decision-engine/DecisionResult'

export {
  evaluateRule,
  filterApplicableRules,
  mergeRuleConstraints,
} from './decision-engine/RuleEvaluator'

export type { MergedConstraints } from './decision-engine/RuleEvaluator'

export {
  scoreTemplate, scoreVariables, scoreRules, scoreScenario,
  buildScoreBreakdown, buildReasoningTrail,
} from './decision-engine/ConfidenceScore'

export { validateDecisionContext, assertDecisionContext } from './validators/DecisionValidator'
export { validateVariables, requiredKeysFromDefs }        from './validators/VariableValidator'

export {
  selectScenario, selectTemplate, selectRules,
  selectFollowup, selectVariables, renderTemplate, extractKeys as extractTemplateKeys,
} from './selectors'

// ── Strategy Layer (Sprint 4) ─────────────────────────────────────────────────
// plan(decisionResult, decisionContext) → StrategyResult

export { plan as planStrategy, planFromContext } from './strategy/StrategyEngine'

export type {
  StrategyContext,
  StrategyResult,
  StrategyReasoning,
  ChannelPlan,
  RecommendedSendTime,
  FollowupPlan,
  FollowupTouchpoint,
  EscalationPlan,
  EscalationTrigger,
  EscalationAction,
  StopCondition,
  StopCode,
} from './strategy'

export { planChannels, planTiming, planSequence, planEscalation, buildStopConditions } from './strategy'
