/**
 * Marketing Brain — public API surface
 *
 * Sprint 1 + 2: database layer only.
 * No routes, no business logic, no AI.
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
