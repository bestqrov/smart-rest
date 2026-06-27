/**
 * Marketing Brain — public API surface
 *
 * Sprint 1: database layer only.
 * No routes, no business logic, no AI.
 */

export { connect, disconnect } from './connection'

export {
  Language, Country, BusinessType, Persona,
  Scenario, Objection, MessageTemplate, FollowupSequence,
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
} from './models'

export { seedMarketingBrain } from './seed'
