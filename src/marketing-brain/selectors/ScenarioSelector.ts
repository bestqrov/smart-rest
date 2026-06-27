import { Scenario }  from '../models/Scenario'
import type { IScenario } from '../models/Scenario'
import type { DecisionStep } from '../decision-engine/DecisionResult'
import { failedStep, successStep } from '../decision-engine/ConfidenceScore'

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ScenarioSelectorResult {
  selected:      IScenario | null
  step:          DecisionStep
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find the active scenario for a given trigger string.
 *
 * When multiple scenarios share a trigger (rare), the highest-priority one wins.
 * Tiebreak: slug ascending — deterministic under all conditions.
 */
export async function selectScenario(trigger: string): Promise<ScenarioSelectorResult> {
  // Fetch top 2 so we can list the runner-up as an alternative in the reasoning
  const docs = await Scenario
    .find({ trigger, isActive: true })
    .sort({ priority: -1, slug: 1 })
    .limit(2)
    .lean<IScenario[]>()

  if (!docs.length) {
    return {
      selected: null,
      step: failedStep(
        'SCENARIO',
        `No active scenario found for trigger='${trigger}'. ` +
        'Continuing with no scenario — template fallback levels will be reduced.',
      ),
    }
  }

  const selected     = docs[0]
  const alternatives = docs.slice(1).map(d => d.slug)

  const step = successStep(
    'SCENARIO',
    selected.slug,
    `Matched trigger='${trigger}' → scenario '${selected.slug}' [stage: ${selected.stage}]. ` +
    (selected.priority > 0 ? `Priority: ${selected.priority}.` : ''),
    selected.priority,
    0,   // scenario selection is always "exact" (trigger matches or not)
    alternatives,
  )

  return { selected, step }
}
