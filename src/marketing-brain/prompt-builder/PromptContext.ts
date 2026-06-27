import type { DecisionResult }    from '../decision-engine/DecisionResult'
import type { DecisionContext }   from '../decision-engine/DecisionContext'
import type { StrategyResult }    from '../strategy/StrategyResult'
import type {
  CountryKnowledge,
  PersonaKnowledge,
  ScenarioKnowledge,
  BusinessTypeKnowledge,
  ObjectionKnowledge,
} from '../knowledge/types'

/**
 * Everything the Prompt Builder needs to assemble a complete, provider-agnostic prompt.
 *
 * The three primary inputs are:
 *   - decisionResult   — which template, rules, variables, scenario, and followup sequence
 *   - strategyResult   — which channel, when to send, follow-up plan, escalation
 *   - decisionContext  — the raw request (language, country, businessType, persona, etc.)
 *
 * Knowledge objects are all optional. Their presence enriches the prompt with
 * cultural intelligence and persona psychology. Absence gracefully degrades.
 */
export interface PromptContext {
  /** Full output of the Decision Engine — template, rules, variables, confidence. */
  decisionResult:          DecisionResult

  /** The original caller-provided context that produced the DecisionResult. */
  decisionContext:         DecisionContext

  /** Full output of the Strategy Engine — channel, timing, followup, escalation. */
  strategyResult:          StrategyResult

  /** Enriched country record — dialect, cultural notes, contact hours. */
  countryKnowledge?:       CountryKnowledge | null

  /** Enriched persona record — pain points, messaging principles, trigger words. */
  personaKnowledge?:       PersonaKnowledge | null

  /** Enriched scenario record — key messages, CTA, urgency, success indicator. */
  scenarioKnowledge?:      ScenarioKnowledge | null

  /** Enriched business type record — pain points, key use cases, avoid topics. */
  businessTypeKnowledge?:  BusinessTypeKnowledge | null

  /** Active objection enrichment — underlying fear, handling strategy, do-not-say list. */
  objectionKnowledge?:     ObjectionKnowledge | null
}
