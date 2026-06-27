import type { IMessageTemplate }  from '../models/MessageTemplate'
import type { IAIRule }           from '../models/AIRule'
import type { IScenario }         from '../models/Scenario'
import type { IFollowupSequence } from '../models/FollowupSequence'
import type { ScoreBreakdown, ReasoningTrail, DecisionStep } from './DecisionResult'

// ─── Weight constants ─────────────────────────────────────────────────────────
// Weights sum to 100. Tune here — never in the scoring functions.

const W_TEMPLATE  = 40   // template match quality (biggest factor)
const W_VARIABLES = 25   // variable completeness
const W_RULES     = 20   // AI rules calibration
const W_SCENARIO  = 15   // scenario resolution

// ─── Per-dimension scorers ────────────────────────────────────────────────────

/**
 * Template score: 0–40.
 *
 * Base by fallback level:
 *   0 (exact)      → 40
 *   1 (any persona) → 32
 *   2 (any scenario)→ 24
 *   3 (any language)→ 16  ← minimum when a template was found
 *   no match        → 0
 *
 * Bonuses (added on top, capped at W_TEMPLATE):
 *   +3  country match
 *   +2  business type match
 *   +1–3 historical performance > 10% conversion rate
 */
export function scoreTemplate(
  template:      IMessageTemplate | null,
  fallbackLevel: number,
  countryMatch:  boolean,
  bizTypeMatch:  boolean,
): number {
  if (!template) return 0

  const base    = Math.max(16, W_TEMPLATE - fallbackLevel * 8)
  let   bonus   = 0

  if (countryMatch)  bonus += 3
  if (bizTypeMatch)  bonus += 2

  const { sent = 0, converted = 0 } = template.stats ?? {}
  if (sent > 0) {
    const rate = (converted / sent) * 100
    bonus += Math.min(Math.floor(rate / 10), 3)   // up to +3 at ≥30% conversion
  }

  return Math.min(W_TEMPLATE, base + bonus)
}

/**
 * Variable score: 0–25.
 *
 * ratio = (# required vars with non-empty value) / (# required vars)
 * score = ratio × 25
 *
 * If there are no required variables, return full marks — completeness is
 * 100% by definition when nothing is required.
 */
export function scoreVariables(
  resolved:     Record<string, string>,
  requiredKeys: string[],
): number {
  if (!requiredKeys.length) return W_VARIABLES
  const filled = requiredKeys.filter(k => Boolean(resolved[k])).length
  return Math.round((filled / requiredKeys.length) * W_VARIABLES)
}

/**
 * Rules score: 0–20.
 *
 * Reflects how well the rule set is calibrated to this context.
 * 0 rules → 5 (engine still works, but no constraints)
 * 1–2     → 10
 * 3–4     → 15
 * 5+      → 20
 * Hard rule present → +2 bonus (capped at W_RULES)
 */
export function scoreRules(rules: IAIRule[]): number {
  const count = rules.length
  let base: number

  if      (count === 0) base = 5
  else if (count <= 2)  base = 10
  else if (count <= 4)  base = 15
  else                  base = 20

  const bonus = rules.some(r => r.isHard) ? 2 : 0
  return Math.min(W_RULES, base + bonus)
}

/**
 * Scenario score: 0–15.
 * Found → 15.  Not found → 0 (engine still runs, but less targeted).
 */
export function scoreScenario(scenario: IScenario | null): number {
  return scenario ? W_SCENARIO : 0
}

// ─── Score builder ────────────────────────────────────────────────────────────

export function buildScoreBreakdown(
  template:  number,
  variables: number,
  rules:     number,
  scenario:  number,
): ScoreBreakdown {
  const total = Math.min(100, template + variables + rules + scenario)
  return { template, variables, rules, scenario, total }
}

// ─── Reasoning builder ────────────────────────────────────────────────────────

export interface ReasoningInput {
  steps:          DecisionStep[]
  scoreBreakdown: ScoreBreakdown
  template:       IMessageTemplate  | null
  scenario:       IScenario         | null
  rules:          IAIRule[]
  followup:       IFollowupSequence | null
}

/**
 * Assemble the full ReasoningTrail from per-dimension steps and scores.
 * Pure function — no DB access.
 */
export function buildReasoningTrail(input: ReasoningInput): ReasoningTrail {
  const { scoreBreakdown, template, scenario, rules, followup } = input
  const score = scoreBreakdown.total

  const summaryParts: string[] = []

  if (template) {
    const templateStep = input.steps.find(s => s.dimension === 'TEMPLATE')
    const level = templateStep?.fallbackLevel ?? 0
    const quality = level === 0 ? 'exact match' : `level-${level} fallback`
    summaryParts.push(`template '${template.slug}' (${quality})`)
  } else {
    summaryParts.push('no template found')
  }

  if (scenario) {
    summaryParts.push(`scenario '${scenario.slug}' [${scenario.stage}]`)
  } else {
    summaryParts.push('no scenario matched')
  }

  summaryParts.push(
    rules.length
      ? `${rules.length} rule(s) applied (${rules.filter(r => r.isHard).length} hard)`
      : 'no AI rules',
  )

  summaryParts.push(
    followup
      ? `followup '${followup.slug}'`
      : 'no followup sequence',
  )

  summaryParts.push(`confidence ${score}/100`)

  return {
    summary:        summaryParts.join(' | '),
    steps:          input.steps,
    scoreBreakdown,
  }
}

// ─── Step factories (used by selectors / engine) ──────────────────────────────

/** Build an empty/failed step for a given dimension. */
export function failedStep(
  dimension: DecisionStep['dimension'],
  reason:    string,
): DecisionStep {
  return { dimension, selected: '—', reason, rawScore: 0, alternatives: [] }
}

/** Build a successful step. */
export function successStep(
  dimension:     DecisionStep['dimension'],
  selected:      string,
  reason:        string,
  rawScore:      number,
  fallbackLevel: number,
  alternatives:  string[],
): DecisionStep {
  return { dimension, selected, reason, rawScore, fallbackLevel, alternatives }
}
