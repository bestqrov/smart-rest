/**
 * Marketing Brain — public API surface
 *
 * Sprint 1 + 2: database layer (Mongoose models + seed).
 * Sprint 3:     service layer (decision engine, no AI calls).
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
