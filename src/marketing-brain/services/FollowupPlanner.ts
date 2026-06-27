import { Types }          from 'mongoose'
import { FollowupSequence } from '../models/FollowupSequence'
import type { IFollowupSequence } from '../models/FollowupSequence'
import type { ResolvedContext, SequenceMatch } from '../types'

// ─── Scoring weights ──────────────────────────────────────────────────────────

const SCORE_BASE             = 100
const SCORE_COUNTRY_MATCH    =  20
const SCORE_COUNTRY_ABSENT   =  -5
const SCORE_BIZ_TYPE_MATCH   =  10
const SCORE_BIZ_TYPE_ABSENT  =  -3
const SCORE_FALLBACK_PENALTY =  30

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Selects the best follow-up sequence for a given context.
 *
 * Progressive relaxation:
 *   Level 0 — scenario + persona + language  (exact targeting)
 *   Level 1 — scenario + language (any persona)
 *   Level 2 — scenario only (any language, any persona)
 *
 * Returns null when no active sequence exists for this scenario at any level.
 * Callers should treat null as "send template only, no follow-up".
 */
export async function plan(ctx: ResolvedContext): Promise<SequenceMatch | null> {
  if (!ctx.scenarioId) return null

  // Level 0: exact targeting
  if (ctx.personaId) {
    const candidates = await query({
      scenario: ctx.scenarioId,
      persona:  ctx.personaId,
      language: ctx.languageId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 0)
    if (best) return best
  }

  // Level 1: any persona
  {
    const candidates = await query({
      scenario: ctx.scenarioId,
      language: ctx.languageId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 1)
    if (best) return best
  }

  // Level 2: any persona + any language
  {
    const candidates = await query({
      scenario: ctx.scenarioId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 2)
    if (best) return best
  }

  return null
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function score(
  seq:           IFollowupSequence,
  ctx:           ResolvedContext,
  fallbackLevel: number,
): number {
  let s = SCORE_BASE - (fallbackLevel * SCORE_FALLBACK_PENALTY)

  // Country
  if (seq.country) {
    s += ctx.countryId && (seq.country as Types.ObjectId).equals(ctx.countryId)
      ? SCORE_COUNTRY_MATCH
      : -Infinity
  } else {
    s += SCORE_COUNTRY_ABSENT
  }

  // Business type
  if (seq.businessType) {
    s += ctx.businessTypeId && (seq.businessType as Types.ObjectId).equals(ctx.businessTypeId)
      ? SCORE_BIZ_TYPE_MATCH
      : -Infinity
  } else {
    s += SCORE_BIZ_TYPE_ABSENT
  }

  // Prefer shorter sequences (less friction) when scores are otherwise equal
  // Small tiebreaker: subtract 0.1 per extra step beyond 1
  s -= Math.max(0, (seq.totalSteps - 1) * 0.1)

  return s
}

function pickBest(
  candidates:    IFollowupSequence[],
  ctx:           ResolvedContext,
  fallbackLevel: number,
): SequenceMatch | null {
  let best: SequenceMatch | null = null

  for (const seq of candidates) {
    const s = score(seq, ctx, fallbackLevel)
    if (s === -Infinity) continue
    if (!best || s > best.score) {
      best = { sequence: seq, score: s, fallbackLevel }
    }
  }

  return best
}

// ─── DB helper ────────────────────────────────────────────────────────────────

async function query(filter: Record<string, unknown>): Promise<IFollowupSequence[]> {
  return FollowupSequence.find(filter).lean<IFollowupSequence[]>()
}
