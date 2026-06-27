// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  CountryKnowledge,
  PersonaKnowledge,
  ScenarioKnowledge,
  ObjectionKnowledge,
  BusinessTypeKnowledge,
  KnowledgeMap,
  ContactChannel,
  // Primitives
  FormalityLevel, MarketMaturity, DigitalAdoption, DecisionMaking,
  TechComfort, DecisionSpeed, PriceSensitivity, TrustRequirement,
  ContentLength, Urgency, StaffSize, Complexity, Seasonality,
  BudgetCycle, DecisionMaker,
} from './types'

// ─── Services ─────────────────────────────────────────────────────────────────
// Namespace exports: CountryKnowledgeService.getByCode('MA'), etc.

export * as CountryKnowledgeService      from './CountryKnowledgeService'
export * as PersonaKnowledgeService      from './PersonaKnowledgeService'
export * as ScenarioKnowledgeService     from './ScenarioKnowledgeService'
export * as ObjectionKnowledgeService    from './ObjectionKnowledgeService'
export * as BusinessTypeKnowledgeService from './BusinessTypeKnowledgeService'

// ─── Cache utility ────────────────────────────────────────────────────────────

export { createCache, withCache } from './cache'
export type { KnowledgeCache }    from './cache'

// ─── Raw profiles (for testing and prompt-building) ───────────────────────────

export { COUNTRY_PROFILES, REGION_PROFILES }   from './profiles/country'
export { PERSONA_PROFILES }                    from './profiles/persona'
export { STAGE_PROFILES, TRIGGER_OVERRIDES }   from './profiles/scenario'
export { OBJECTION_PROFILES }                  from './profiles/objection'
export { BUSINESS_TYPE_PROFILES }              from './profiles/businessType'
