import { Types }  from 'mongoose'
import { AIRule }  from '../models/AIRule'
import type { IAIRule }        from '../models/AIRule'
import type { Channel }        from '../models/MessageTemplate'
import type { ResolvedContext } from '../types'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all active AIRules and return the subset that applies to this context.
 *
 * Matching logic: for every non-empty targeting dimension on the rule,
 * the context value must be present in that array.
 * Empty array = "universal" (matches any context value for that dimension).
 *
 * Result is sorted: hard rules first, then by priority descending.
 * This order is preserved in PromptBuilder so the AI sees the most
 * critical constraints at the top of the system prompt.
 */
export async function resolve(ctx: ResolvedContext): Promise<IAIRule[]> {
  const allRules = await AIRule
    .find({ isActive: true })
    .sort({ isHard: -1, priority: -1 })
    .lean<IAIRule[]>()

  return allRules.filter(rule => applies(rule, ctx))
}

// ─── Matching logic ───────────────────────────────────────────────────────────

function applies(rule: IAIRule, ctx: ResolvedContext): boolean {
  const a = rule.appliesTo

  // Channel check (string comparison — not an ObjectId)
  if (a.channels?.length && !a.channels.includes(ctx.channel as Channel)) return false

  // ObjectId dimension checks: empty = universal, non-empty = must include
  if (!matchIds(a.personas,      ctx.personaId))      return false
  if (!matchIds(a.scenarios,     ctx.scenarioId))      return false
  if (!matchIds(a.countries,     ctx.countryId))       return false
  if (!matchIds(a.languages,     ctx.languageId))      return false
  if (!matchIds(a.businessTypes, ctx.businessTypeId))  return false

  return true
}

/**
 * Returns true when:
 * - The rule has no constraint on this dimension (empty array), OR
 * - The context's ID is present in the rule's array.
 *
 * If the context ID is null (entity not found), a non-empty rule array
 * cannot be satisfied, so returns false.
 */
function matchIds(
  ruleIds:   Types.ObjectId[],
  contextId: Types.ObjectId | null | undefined,
): boolean {
  if (!ruleIds?.length) return true          // universal
  if (!contextId)       return false         // rule has constraints, context has none
  return ruleIds.some(id => id.equals(contextId))
}

// ─── Helpers for PromptBuilder ────────────────────────────────────────────────

/**
 * Merge quantitative constraints (maxChars, maxLines, maxWords) from a set of rules.
 * When multiple rules set the same constraint, the STRICTEST (lowest) value wins,
 * but hard-rule constraints override soft-rule constraints unconditionally.
 */
export function mergeConstraints(rules: IAIRule[]): {
  maxChars:          number | null
  maxLines:          number | null
  maxWords:          number | null
  forbiddenPatterns: string[]
  requiredTokens:    string[]
} {
  let maxChars: number | null = null
  let maxLines: number | null = null
  let maxWords: number | null = null
  const forbidden = new Set<string>()
  const required  = new Set<string>()

  // Process hard rules first so they anchor the minimums
  const ordered = [...rules].sort((a, b) => (b.isHard ? 1 : 0) - (a.isHard ? 1 : 0))

  for (const rule of ordered) {
    const r = rule.rule
    if (r.maxChars !== null) maxChars = maxChars === null ? r.maxChars : Math.min(maxChars, r.maxChars)
    if (r.maxLines !== null) maxLines = maxLines === null ? r.maxLines : Math.min(maxLines, r.maxLines)
    if (r.maxWords !== null) maxWords = maxWords === null ? r.maxWords : Math.min(maxWords, r.maxWords)
    r.forbiddenPatterns?.forEach(p => forbidden.add(p))
    r.requiredTokens?.forEach(t => required.add(t))
  }

  return {
    maxChars,
    maxLines,
    maxWords,
    forbiddenPatterns: [...forbidden],
    requiredTokens:    [...required],
  }
}
