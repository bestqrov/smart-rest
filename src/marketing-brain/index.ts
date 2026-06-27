/**
 * Marketing Brain — public API surface
 *
 * Sprint 1 + 2:   database layer (Mongoose models + seed).
 * Sprint 2.5:     knowledge layer (cultural + strategy enrichment).
 * Sprint 3:       decision engine service layer (no AI calls).
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
