import { Types } from 'mongoose'
import type { IAIRule } from '../models/AIRule'
import type { Channel }  from '../models/MessageTemplate'
import type { ResolvedDecisionContext } from './DecisionContext'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determines whether an AIRule's targeting criteria are satisfied by the
 * given resolved context.
 *
 * Matching contract:
 *   - Empty array on any dimension → "universal" (matches any context value)
 *   - Non-empty array → context value MUST appear in it
 *   - Context value is null AND rule has a non-empty array → dimension fails
 *
 * Pure function: no DB access, no side effects. Safe to call in unit tests
 * with mocked IAIRule objects.
 */
export function evaluateRule(
  rule: IAIRule,
  ctx:  ResolvedDecisionContext,
): boolean {
  const a = rule.appliesTo

  // Channel is a string enum — compared directly, not as ObjectId
  if (a.channels?.length && !a.channels.includes(ctx.channel as Channel)) return false

  // All other dimensions are ObjectIds
  if (!matchIds(a.personas,      ctx.personaId))      return false
  if (!matchIds(a.scenarios,     ctx.scenarioId))      return false
  if (!matchIds(a.countries,     ctx.countryId))       return false
  if (!matchIds(a.languages,     ctx.languageId))      return false
  if (!matchIds(a.businessTypes, ctx.businessTypeId))  return false

  return true
}

/**
 * Filter a set of rules to only those that apply to the given context,
 * then sort them deterministically.
 *
 * Sort order:
 *   1. Hard rules first (isHard = true)
 *   2. Higher priority first (priority: 100 → 1)
 *   3. Slug ascending as a stable tiebreaker (ensures same input → same output)
 */
export function filterApplicableRules(
  rules: IAIRule[],
  ctx:   ResolvedDecisionContext,
): IAIRule[] {
  return rules
    .filter(r => evaluateRule(r, ctx))
    .sort((a, b) => {
      if (a.isHard !== b.isHard)         return b.isHard ? 1 : -1
      if (b.priority !== a.priority)     return b.priority - a.priority
      return a.slug.localeCompare(b.slug)   // stable tiebreak
    })
}

// ─── Constraint merging ───────────────────────────────────────────────────────

export interface MergedConstraints {
  maxChars:          number | null
  maxLines:          number | null
  maxWords:          number | null
  /** Sorted for deterministic output. */
  forbiddenPatterns: string[]
  /** Sorted for deterministic output. */
  requiredTokens:    string[]
}

/**
 * Merge quantitative constraints from a set of applicable rules.
 *
 * Collision resolution:
 *   - Hard-rule constraints are processed first so they anchor the limits
 *   - When multiple rules set the same constraint, the STRICTEST (lowest) value wins
 *   - forbiddenPatterns and requiredTokens are unioned (deduplicated)
 */
export function mergeRuleConstraints(rules: IAIRule[]): MergedConstraints {
  let maxChars: number | null = null
  let maxLines: number | null = null
  let maxWords: number | null = null
  const forbidden = new Set<string>()
  const required  = new Set<string>()

  // Hard rules processed first — they anchor the minimum limits
  const ordered = [...rules].sort((a, b) => (b.isHard ? 1 : 0) - (a.isHard ? 1 : 0))

  for (const rule of ordered) {
    const r = rule.rule
    if (r.maxChars != null) {
      maxChars = maxChars == null ? r.maxChars : Math.min(maxChars, r.maxChars)
    }
    if (r.maxLines != null) {
      maxLines = maxLines == null ? r.maxLines : Math.min(maxLines, r.maxLines)
    }
    if (r.maxWords != null) {
      maxWords = maxWords == null ? r.maxWords : Math.min(maxWords, r.maxWords)
    }
    r.forbiddenPatterns?.forEach(p => forbidden.add(p))
    r.requiredTokens?.forEach(t => required.add(t))
  }

  return {
    maxChars,
    maxLines,
    maxWords,
    forbiddenPatterns: [...forbidden].sort(),
    requiredTokens:    [...required].sort(),
  }
}

// ─── Introspection helpers ─────────────────────────────────────────────────────

/**
 * Describe why a rule does or does not match a context.
 * Returns a human-readable string — useful for building reasoning trails.
 */
export function explainRuleMatch(
  rule: IAIRule,
  ctx:  ResolvedDecisionContext,
): string {
  const a = rule.appliesTo
  const parts: string[] = []

  if (!a.channels?.length) {
    parts.push('channel: universal')
  } else if (a.channels.includes(ctx.channel as Channel)) {
    parts.push(`channel: ${ctx.channel} ✓`)
  } else {
    parts.push(`channel: ${ctx.channel} ✗ (wants ${a.channels.join('|')})`)
  }

  if (a.countries?.length) {
    parts.push(
      ctx.countryId && a.countries.some(id => id.equals(ctx.countryId as Types.ObjectId))
        ? `country: ${ctx.countryCode} ✓`
        : `country: ${ctx.countryCode} ✗`,
    )
  }

  if (a.personas?.length) {
    parts.push(
      ctx.personaId && a.personas.some(id => id.equals(ctx.personaId as Types.ObjectId))
        ? `persona: ${ctx.personaSlug} ✓`
        : `persona: ✗`,
    )
  }

  return parts.join(' | ')
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function matchIds(
  ruleIds:   Types.ObjectId[] | undefined,
  contextId: Types.ObjectId | null | undefined,
): boolean {
  if (!ruleIds?.length) return true     // universal
  if (!contextId)       return false    // rule has constraints, context has none
  return ruleIds.some(id => id.equals(contextId))
}
