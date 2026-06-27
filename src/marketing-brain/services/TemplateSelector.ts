import { Types }          from 'mongoose'
import { MessageTemplate } from '../models/MessageTemplate'
import type { IMessageTemplate } from '../models/MessageTemplate'
import type { ResolvedContext, TemplateMatch } from '../types'

// ─── Scoring weights ──────────────────────────────────────────────────────────
// Kept as constants so they're easy to tune without touching the algorithm.

const SCORE_BASE             = 100
const SCORE_COUNTRY_MATCH    =  20   // explicit country match: more targeted
const SCORE_COUNTRY_ABSENT   =  -5   // template has no country (less specific)
const SCORE_BIZ_TYPE_MATCH   =  10   // explicit business type match
const SCORE_BIZ_TYPE_ABSENT  =  -3   // template has no business type
const SCORE_CONVERSION_MAX   =  10   // max bonus from historical conversion rate
const SCORE_FALLBACK_PENALTY =  30   // penalty per fallback level

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Selects the best matching MessageTemplate for a given context.
 *
 * Progressive relaxation strategy:
 *   Level 0 — exact:  channel + language + scenario + persona  (uses compound index)
 *   Level 1 — relax:  channel + language + scenario (any persona)
 *   Level 2 — relax:  channel + language (any scenario, any persona)
 *   Level 3 — relax:  channel only (any language)
 *
 * At each level, all candidates are scored and the highest scorer wins.
 * Scores decrease with each fallback level (SCORE_FALLBACK_PENALTY per level).
 */
export async function select(ctx: ResolvedContext): Promise<TemplateMatch | null> {
  // Level 0: full match
  if (ctx.scenarioId && ctx.personaId) {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      scenario: ctx.scenarioId,
      persona:  ctx.personaId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 0)
    if (best) return best
  }

  // Level 1: any persona
  if (ctx.scenarioId) {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      scenario: ctx.scenarioId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 1)
    if (best) return best
  }

  // Level 2: any scenario + any persona
  {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 2)
    if (best) return best
  }

  // Level 3: any language (last resort — will need translation by AI)
  {
    const candidates = await query({
      channel:  ctx.channel,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 3)
    if (best) return best
  }

  return null
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function score(template: IMessageTemplate, ctx: ResolvedContext, fallbackLevel: number): number {
  let s = SCORE_BASE - (fallbackLevel * SCORE_FALLBACK_PENALTY)

  // Country dimension
  if (template.country) {
    s += ctx.countryId && (template.country as Types.ObjectId).equals(ctx.countryId)
      ? SCORE_COUNTRY_MATCH
      : -Infinity   // template targets a different country — disqualify
  } else {
    s += SCORE_COUNTRY_ABSENT   // less specific but not wrong
  }

  // Business type dimension
  if (template.businessType) {
    s += ctx.businessTypeId && (template.businessType as Types.ObjectId).equals(ctx.businessTypeId)
      ? SCORE_BIZ_TYPE_MATCH
      : -Infinity   // template targets a different business type — disqualify
  } else {
    s += SCORE_BIZ_TYPE_ABSENT
  }

  // Historical performance bonus
  const { sent = 0, converted = 0 } = template.stats ?? {}
  if (sent > 0) {
    const conversionRate = (converted / sent) * 100
    s += Math.min(conversionRate * (SCORE_CONVERSION_MAX / 10), SCORE_CONVERSION_MAX)
  }

  return s
}

function pickBest(
  candidates:    IMessageTemplate[],
  ctx:           ResolvedContext,
  fallbackLevel: number,
): TemplateMatch | null {
  let best: TemplateMatch | null = null

  for (const t of candidates) {
    const s = score(t, ctx, fallbackLevel)
    if (s === -Infinity) continue              // disqualified (wrong country/bt)
    if (!best || s > best.score) {
      best = { template: t, score: s, fallbackLevel }
    }
  }

  return best
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function query(filter: Record<string, unknown>): Promise<IMessageTemplate[]> {
  return MessageTemplate.find(filter).lean<IMessageTemplate[]>()
}
