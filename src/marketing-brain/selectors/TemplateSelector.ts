import { Types }           from 'mongoose'
import { MessageTemplate }  from '../models/MessageTemplate'
import type { IMessageTemplate } from '../models/MessageTemplate'
import type { ResolvedDecisionContext } from '../decision-engine/DecisionContext'
import type { DecisionStep } from '../decision-engine/DecisionResult'
import { scoreTemplate, failedStep, successStep } from '../decision-engine/ConfidenceScore'

// ─── Scoring weights ──────────────────────────────────────────────────────────

const SCORE_BASE             = 100
const SCORE_COUNTRY_MATCH    =  20
const SCORE_COUNTRY_ABSENT   =  -5
const SCORE_BIZ_TYPE_MATCH   =  10
const SCORE_BIZ_TYPE_ABSENT  =  -3
const SCORE_CONVERSION_MAX   =  10
const SCORE_FALLBACK_PENALTY =  30

// ─── Result type ──────────────────────────────────────────────────────────────

export interface TemplateSelectorResult {
  selected:      IMessageTemplate | null
  step:          DecisionStep
  rawScore:      number
  fallbackLevel: number
  countryMatch:  boolean
  bizTypeMatch:  boolean
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Selects the best-matching MessageTemplate for a given resolved context.
 *
 * Progressive relaxation (4 levels):
 *   Level 0 — full exact: channel + language + scenario + persona
 *   Level 1 — relax persona: channel + language + scenario (any persona)
 *   Level 2 — relax scenario: channel + language (any scenario / persona)
 *   Level 3 — last resort: channel only (any language — AI will adapt)
 *
 * At each level all candidates are scored; highest scorer wins.
 * Same input → same output guaranteed by stable sort on slug.
 */
export async function selectTemplate(
  ctx: ResolvedDecisionContext,
): Promise<TemplateSelectorResult> {
  // Level 0: exact (best case)
  if (ctx.scenarioId && ctx.personaId) {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      scenario: ctx.scenarioId,
      persona:  ctx.personaId,
      isActive: true,
    })
    const result = pickBest(candidates, ctx, 0)
    if (result) return buildResult(result, ctx)
  }

  // Level 1: any persona
  if (ctx.scenarioId) {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      scenario: ctx.scenarioId,
      isActive: true,
    })
    const result = pickBest(candidates, ctx, 1)
    if (result) return buildResult(result, ctx)
  }

  // Level 2: any scenario + any persona
  {
    const candidates = await query({
      channel:  ctx.channel,
      language: ctx.languageId,
      isActive: true,
    })
    const result = pickBest(candidates, ctx, 2)
    if (result) return buildResult(result, ctx)
  }

  // Level 3: channel only (language mismatch — AI adaptation needed)
  {
    const candidates = await query({
      channel:  ctx.channel,
      isActive: true,
    })
    const result = pickBest(candidates, ctx, 3)
    if (result) return buildResult(result, ctx)
  }

  // Nothing found
  return {
    selected:      null,
    rawScore:      0,
    fallbackLevel: -1,
    countryMatch:  false,
    bizTypeMatch:  false,
    step: failedStep(
      'TEMPLATE',
      `No template found for channel=${ctx.channel}, language=${ctx.languageCode} ` +
      `after 4 fallback levels. Check that at least one template exists for this channel.`,
    ),
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Candidate {
  template:      IMessageTemplate
  rawScore:      number
  fallbackLevel: number
  countryMatch:  boolean
  bizTypeMatch:  boolean
}

function rawScore(
  template:      IMessageTemplate,
  ctx:           ResolvedDecisionContext,
  fallbackLevel: number,
): { score: number; countryMatch: boolean; bizTypeMatch: boolean } {
  let s = SCORE_BASE - (fallbackLevel * SCORE_FALLBACK_PENALTY)

  let countryMatch  = false
  let bizTypeMatch  = false

  // Country dimension
  if (template.country) {
    if (ctx.countryId && (template.country as Types.ObjectId).equals(ctx.countryId)) {
      s += SCORE_COUNTRY_MATCH
      countryMatch = true
    } else {
      s = -Infinity  // targets a different country — disqualify
    }
  } else {
    s += SCORE_COUNTRY_ABSENT
  }

  // Business type dimension
  if (template.businessType) {
    if (ctx.businessTypeId && (template.businessType as Types.ObjectId).equals(ctx.businessTypeId)) {
      s += SCORE_BIZ_TYPE_MATCH
      bizTypeMatch = true
    } else {
      s = -Infinity  // targets a different business type — disqualify
    }
  } else {
    s += SCORE_BIZ_TYPE_ABSENT
  }

  // Historical performance bonus
  const { sent = 0, converted = 0 } = template.stats ?? {}
  if (sent > 0) {
    const rate = (converted / sent) * 100
    s += Math.min(rate * (SCORE_CONVERSION_MAX / 10), SCORE_CONVERSION_MAX)
  }

  return { score: s, countryMatch, bizTypeMatch }
}

function pickBest(
  candidates:    IMessageTemplate[],
  ctx:           ResolvedDecisionContext,
  fallbackLevel: number,
): Candidate | null {
  let best: Candidate | null = null

  // Stable sort by slug so scoring tiebreaks are deterministic
  const sorted = [...candidates].sort((a, b) => a.slug.localeCompare(b.slug))

  for (const t of sorted) {
    const { score: s, countryMatch, bizTypeMatch } = rawScore(t, ctx, fallbackLevel)
    if (s === -Infinity) continue
    if (!best || s > best.rawScore) {
      best = { template: t, rawScore: s, fallbackLevel, countryMatch, bizTypeMatch }
    }
  }

  return best
}

function buildResult(candidate: Candidate, ctx: ResolvedDecisionContext): TemplateSelectorResult {
  const { template, rawScore: rs, fallbackLevel, countryMatch, bizTypeMatch } = candidate

  const levelLabels = ['exact match', 'any persona', 'any scenario', 'any language']
  const levelLabel  = levelLabels[fallbackLevel] ?? `level-${fallbackLevel}`

  const contextDesc = [
    `channel=${ctx.channel}`,
    `language=${ctx.languageCode}`,
    ctx.personaSlug    ? `persona=${ctx.personaSlug}`       : null,
    ctx.scenarioStage  ? `stage=${ctx.scenarioStage}`       : null,
    countryMatch       ? `country=${ctx.countryCode} ✓`     : null,
    bizTypeMatch       ? `bizType=${ctx.businessTypeSlug} ✓`: null,
  ].filter(Boolean).join(', ')

  // The confidence dimension score (0-40)
  const dimScore = scoreTemplate(template, fallbackLevel, countryMatch, bizTypeMatch)

  const step = successStep(
    'TEMPLATE',
    template.slug,
    `Selected '${template.slug}' at ${levelLabel} (${contextDesc}). ` +
    `Raw score: ${rs.toFixed(1)}. Confidence contribution: ${dimScore}/40.`,
    rs,
    fallbackLevel,
    [],   // alternatives not fetched (too expensive for regular runs)
  )

  return { selected: template, step, rawScore: rs, fallbackLevel, countryMatch, bizTypeMatch }
}

// ─── DB helper ────────────────────────────────────────────────────────────────

async function query(filter: Record<string, unknown>): Promise<IMessageTemplate[]> {
  return MessageTemplate.find(filter).lean<IMessageTemplate[]>()
}
