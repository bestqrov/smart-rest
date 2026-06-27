import { AIRule } from '../models/AIRule'
import type { IAIRule } from '../models/AIRule'
import type { ResolvedDecisionContext } from '../decision-engine/DecisionContext'
import type { DecisionStep } from '../decision-engine/DecisionResult'
import { filterApplicableRules, mergeRuleConstraints } from '../decision-engine/RuleEvaluator'
import type { MergedConstraints } from '../decision-engine/RuleEvaluator'
import { scoreRules, failedStep, successStep } from '../decision-engine/ConfidenceScore'

// ─── Result type ──────────────────────────────────────────────────────────────

export interface AIRuleSelectorResult {
  selected:     IAIRule[]
  constraints:  MergedConstraints
  step:         DecisionStep
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all active AIRules and filter to those that apply to this context.
 *
 * Result is sorted deterministically:
 *   1. Hard rules first
 *   2. Higher priority first
 *   3. Slug ascending (stable tiebreak)
 *
 * Also pre-computes the merged quantitative constraints (maxChars, etc.)
 * so callers don't need to re-scan the list.
 */
export async function selectRules(
  ctx: ResolvedDecisionContext,
): Promise<AIRuleSelectorResult> {
  const allRules = await AIRule
    .find({ isActive: true })
    .sort({ isHard: -1, priority: -1, slug: 1 })
    .lean<IAIRule[]>()

  const selected    = filterApplicableRules(allRules, ctx)
  const constraints = mergeRuleConstraints(selected)
  const dimScore    = scoreRules(selected)

  if (!selected.length) {
    return {
      selected,
      constraints,
      step: failedStep(
        'AI_RULES',
        `No AI rules matched this context (channel=${ctx.channel}, ` +
        `country=${ctx.countryCode}, language=${ctx.languageCode}). ` +
        `Output will not have AI-enforced constraints. ` +
        `Confidence contribution: ${dimScore}/20.`,
      ),
    }
  }

  const hardCount = selected.filter(r => r.isHard).length
  const softCount = selected.length - hardCount

  const constraintDesc: string[] = []
  if (constraints.maxChars !== null) constraintDesc.push(`maxChars=${constraints.maxChars}`)
  if (constraints.maxLines !== null) constraintDesc.push(`maxLines=${constraints.maxLines}`)
  if (constraints.maxWords !== null) constraintDesc.push(`maxWords=${constraints.maxWords}`)
  if (constraints.forbiddenPatterns.length) {
    constraintDesc.push(`forbidden: ${constraints.forbiddenPatterns.slice(0, 3).join(', ')}${constraints.forbiddenPatterns.length > 3 ? '...' : ''}`)
  }

  const step = successStep(
    'AI_RULES',
    `${selected.length} rule(s)`,
    `Applied ${selected.length} rules: ${hardCount} hard, ${softCount} soft. ` +
    (constraintDesc.length ? `Constraints: ${constraintDesc.join(' | ')}. ` : '') +
    `Rules: [${selected.map(r => r.slug).join(', ')}]. ` +
    `Confidence contribution: ${dimScore}/20.`,
    dimScore,
    undefined,   // no fallback concept for rules
    [],
  )

  return { selected, constraints, step }
}
