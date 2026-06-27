import { Types }            from 'mongoose'
import { FollowupSequence }  from '../models/FollowupSequence'
import type { IFollowupSequence } from '../models/FollowupSequence'
import type { ResolvedDecisionContext } from '../decision-engine/DecisionContext'
import type { DecisionStep } from '../decision-engine/DecisionResult'
import { failedStep, successStep } from '../decision-engine/ConfidenceScore'

// ─── Scoring weights ──────────────────────────────────────────────────────────

const SCORE_BASE            = 100
const SCORE_COUNTRY_MATCH   =  20
const SCORE_COUNTRY_ABSENT  =  -5
const SCORE_BIZ_TYPE_MATCH  =  10
const SCORE_BIZ_TYPE_ABSENT =  -3
const SCORE_FALLBACK_PENALTY=  30

// ─── Result type ──────────────────────────────────────────────────────────────

export interface FollowupSelectorResult {
  selected:      IFollowupSequence | null
  step:          DecisionStep
  rawScore:      number
  fallbackLevel: number
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Selects the best follow-up sequence for the given context.
 *
 * Progressive relaxation:
 *   Level 0 — scenario + persona + language (exact)
 *   Level 1 — scenario + language (any persona)
 *   Level 2 — scenario only (any language, any persona)
 *
 * Returns null when no scenario is in context or no sequence exists.
 * Null means "send template only — no follow-up series".
 */
export async function selectFollowup(
  ctx: ResolvedDecisionContext,
): Promise<FollowupSelectorResult> {
  if (!ctx.scenarioId) {
    return {
      selected:      null,
      rawScore:      0,
      fallbackLevel: -1,
      step: failedStep(
        'FOLLOWUP',
        'No scenario resolved — follow-up sequence selection skipped.',
      ),
    }
  }

  // Level 0: exact targeting
  if (ctx.personaId) {
    const candidates = await query({
      scenario: ctx.scenarioId,
      persona:  ctx.personaId,
      language: ctx.languageId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 0)
    if (best) return buildResult(best, ctx)
  }

  // Level 1: any persona
  {
    const candidates = await query({
      scenario: ctx.scenarioId,
      language: ctx.languageId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 1)
    if (best) return buildResult(best, ctx)
  }

  // Level 2: any language + any persona
  {
    const candidates = await query({
      scenario: ctx.scenarioId,
      isActive: true,
    })
    const best = pickBest(candidates, ctx, 2)
    if (best) return buildResult(best, ctx)
  }

  return {
    selected:      null,
    rawScore:      0,
    fallbackLevel: -1,
    step: failedStep(
      'FOLLOWUP',
      `No follow-up sequence found for scenario '${ctx.scenarioStage ?? ctx.trigger}'. ` +
      'Template will be sent standalone with no follow-up.',
    ),
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Candidate {
  sequence:      IFollowupSequence
  rawScore:      number
  fallbackLevel: number
}

function scoreSeq(
  seq:           IFollowupSequence,
  ctx:           ResolvedDecisionContext,
  fallbackLevel: number,
): number {
  let s = SCORE_BASE - (fallbackLevel * SCORE_FALLBACK_PENALTY)

  if (seq.country) {
    s += ctx.countryId && (seq.country as Types.ObjectId).equals(ctx.countryId)
      ? SCORE_COUNTRY_MATCH
      : -Infinity
  } else {
    s += SCORE_COUNTRY_ABSENT
  }

  if (seq.businessType) {
    s += ctx.businessTypeId && (seq.businessType as Types.ObjectId).equals(ctx.businessTypeId)
      ? SCORE_BIZ_TYPE_MATCH
      : -Infinity
  } else {
    s += SCORE_BIZ_TYPE_ABSENT
  }

  // Prefer shorter sequences (less friction) — tiebreaker only
  s -= Math.max(0, (seq.totalSteps - 1) * 0.1)

  return s
}

function pickBest(
  candidates:    IFollowupSequence[],
  ctx:           ResolvedDecisionContext,
  fallbackLevel: number,
): Candidate | null {
  let best: Candidate | null = null

  // Stable slug sort before scoring for determinism
  const sorted = [...candidates].sort((a, b) => a.slug.localeCompare(b.slug))

  for (const seq of sorted) {
    const s = scoreSeq(seq, ctx, fallbackLevel)
    if (s === -Infinity) continue
    if (!best || s > best.rawScore) {
      best = { sequence: seq, rawScore: s, fallbackLevel }
    }
  }

  return best
}

function buildResult(candidate: Candidate, ctx: ResolvedDecisionContext): FollowupSelectorResult {
  const { sequence, rawScore: rs, fallbackLevel } = candidate

  const levelLabels = ['exact match', 'any persona', 'any language+persona']
  const levelLabel  = levelLabels[fallbackLevel] ?? `level-${fallbackLevel}`

  const step = successStep(
    'FOLLOWUP',
    sequence.slug,
    `Selected follow-up '${sequence.slug}' at ${levelLabel}. ` +
    `${sequence.totalSteps} step(s), ${sequence.durationDays} day(s) total. ` +
    (sequence.country ? `country-specific. ` : 'universal. ') +
    `Raw score: ${rs.toFixed(1)}.`,
    rs,
    fallbackLevel,
    [],
  )

  return { selected: sequence, step, rawScore: rs, fallbackLevel }
}

// ─── DB helper ────────────────────────────────────────────────────────────────

async function query(filter: Record<string, unknown>): Promise<IFollowupSequence[]> {
  return FollowupSequence.find(filter).lean<IFollowupSequence[]>()
}
