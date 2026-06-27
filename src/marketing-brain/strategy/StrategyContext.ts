import type { DecisionResult }  from '../decision-engine/DecisionResult'
import type { DecisionContext }  from '../decision-engine/DecisionContext'
import type {
  CountryKnowledge,
  PersonaKnowledge,
  ScenarioKnowledge,
  BusinessTypeKnowledge,
  ObjectionKnowledge,
} from '../knowledge/types'

/**
 * Full resolved input to the Strategy Engine.
 *
 * The decisionResult + decisionContext come from the Decision Engine (Sprint 3).
 * The knowledge fields come from the Knowledge Layer (Sprint 2.5) and are pre-fetched
 * by StrategyEngine.plan() — callers do not need to supply them manually.
 *
 * Any knowledge field may be null when the corresponding entity was not found
 * in the DB or has no profile in the hardcoded knowledge base. All planners
 * must handle null gracefully via documented fallbacks.
 */
export interface StrategyContext {
  /** Output of the Decision Engine run that produced the strategy input. */
  decisionResult:        DecisionResult

  /** Original caller input — provides country, language, businessType, persona, etc. */
  decisionContext:       DecisionContext

  // ── Knowledge Layer — all nullable ────────────────────────────────────────

  /** Cultural + market intelligence for the target country. */
  countryKnowledge:      CountryKnowledge      | null
  /** Communication strategy profile for the matched persona. */
  personaKnowledge:      PersonaKnowledge      | null
  /** Funnel-stage strategy and timing profile for the trigger scenario. */
  scenarioKnowledge:     ScenarioKnowledge     | null
  /** Operational profile for the restaurant/café business type. */
  businessTypeKnowledge: BusinessTypeKnowledge | null
  /** Handling playbook for the active objection (if any). */
  objectionKnowledge:    ObjectionKnowledge    | null
}
