import { Language }      from '../models/Language'
import { Country }       from '../models/Country'
import { BusinessType }  from '../models/BusinessType'
import { Persona }       from '../models/Persona'
import { Scenario }      from '../models/Scenario'
import { Objection }     from '../models/Objection'
import type { IPersona }   from '../models/Persona'
import type { IScenario }  from '../models/Scenario'
import type { Channel }    from '../models/MessageTemplate'

import type { DecisionContext, ResolvedDecisionContext } from './DecisionContext'
import type { DecisionResult, DecisionStep } from './DecisionResult'
import { validateDecisionContext }    from '../validators/DecisionValidator'
import { selectScenario }             from '../selectors/ScenarioSelector'
import { selectTemplate }             from '../selectors/TemplateSelector'
import { selectRules }                from '../selectors/AIRuleSelector'
import { selectFollowup }             from '../selectors/FollowupSelector'
import { selectVariables }            from '../selectors/VariableSelector'
import {
  scoreTemplate,
  scoreVariables,
  scoreRules,
  scoreScenario,
  buildScoreBreakdown,
  buildReasoningTrail,
  failedStep,
  successStep,
} from './ConfidenceScore'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * The Decision Engine entry point.
 *
 * Given a DecisionContext, deterministically produce a DecisionResult:
 *   1. Validate the context
 *   2. Resolve string identifiers → ObjectIds + full documents (DB phase 1)
 *   3. Infer persona when not provided (DB phase 2)
 *   4. Run scenario, template, rule, follow-up selectors in parallel (DB phase 3)
 *   5. Resolve variables (needs template — runs after phase 3)
 *   6. Compute confidence score and reasoning trail (pure)
 *   7. Return DecisionResult
 *
 * Guarantees:
 *   - Never throws. All errors are surfaced in DecisionResult.errors.
 *   - Same input → same output (deterministic scoring + stable sort everywhere).
 *   - No AI calls.
 */
export async function decide(context: DecisionContext): Promise<DecisionResult> {
  // 1. Validate
  const validationErrors = validateDecisionContext(context)
  if (validationErrors.length) {
    return emptyResult(validationErrors)
  }

  // 2. Resolve context
  let ctx: ResolvedDecisionContext
  try {
    ctx = await resolveContext(context)
  } catch (err) {
    return emptyResult([`Context resolution failed: ${(err as Error).message}`])
  }

  // 3. Run selectors in parallel (scenario, template, rules, followup don't need each other)
  const [scenarioResult, templateResult, rulesResult, followupResult] = await Promise.all([
    selectScenario(ctx.trigger),
    selectTemplate(ctx),
    selectRules(ctx),
    selectFollowup(ctx),
  ])

  // 4. Resolve variables (needs the selected template)
  const varsResult = await selectVariables(context, templateResult.selected)

  // 5. Build persona step (inferred during context resolution, not a selector)
  const personaStep = buildPersonaStep(ctx)

  // 6. Compute per-dimension scores
  const tScore = scoreTemplate(
    templateResult.selected,
    templateResult.fallbackLevel,
    templateResult.countryMatch,
    templateResult.bizTypeMatch,
  )
  const vScore = scoreVariables(varsResult.resolved, varsResult.requiredKeys)
  const rScore = scoreRules(rulesResult.selected)
  const sScore = scoreScenario(scenarioResult.selected)

  const scoreBreakdown = buildScoreBreakdown(tScore, vScore, rScore, sScore)

  // 7. Assemble reasoning trail
  const steps: DecisionStep[] = [
    scenarioResult.step,
    personaStep,
    templateResult.step,
    rulesResult.step,
    followupResult.step,
    varsResult.step,
  ]

  const reasoning = buildReasoningTrail({
    steps,
    scoreBreakdown,
    template: templateResult.selected,
    scenario: scenarioResult.selected,
    rules:    rulesResult.selected,
    followup: followupResult.selected,
  })

  // 8. Aggregate warnings and errors
  const warnings: string[] = [...varsResult.warnings]
  const errors:   string[] = [...varsResult.errors]

  if (!templateResult.selected) {
    warnings.push(
      `No template found for trigger="${context.scenario}", ` +
      `language="${context.language}", channel="${ctx.channel}". ` +
      'Checked all 4 fallback levels.',
    )
  }

  if (templateResult.fallbackLevel > 0 && templateResult.selected) {
    warnings.push(
      `Template selected via level-${templateResult.fallbackLevel} fallback. ` +
      `Consider adding a template for scenario="${context.scenario}" + ` +
      `language="${context.language}" + persona="${ctx.personaSlug ?? 'any'}".`,
    )
  }

  return {
    selectedTemplate:         templateResult.selected,
    selectedAIRules:          rulesResult.selected,
    selectedVariables:        varsResult.resolved,
    selectedScenario:         scenarioResult.selected,
    selectedFollowupSequence: followupResult.selected,
    confidenceScore:          scoreBreakdown.total,
    reasoning,
    warnings,
    errors,
  }
}

// ─── Context resolution ───────────────────────────────────────────────────────

async function resolveContext(context: DecisionContext): Promise<ResolvedDecisionContext> {
  const channel = (context.channel ?? 'WHATSAPP') as Channel

  // Phase 1: all independent lookups run in parallel
  const [language, country, businessType, scenario, objection] = await Promise.all([
    Language    .findOne({ code: context.language,     isActive: true }).select('_id code').lean(),
    Country     .findOne({ code: context.country,      isActive: true }).select('_id code').lean(),
    BusinessType.findOne({ slug: context.businessType, isActive: true }).select('_id slug').lean(),
    Scenario    .findOne({ trigger: context.scenario,  isActive: true })
                .sort({ priority: -1, slug: 1 })
                .select('_id slug stage trigger')
                .lean<Pick<IScenario, '_id' | 'slug' | 'stage' | 'trigger'>>(),
    context.objection
      ? Objection.findOne({ slug: context.objection, isActive: true }).select('_id slug').lean()
      : Promise.resolve(null),
  ])

  if (!language) {
    throw new Error(
      `Language code "${context.language}" not found. ` +
      'Seed the Language collection or check the language code.',
    )
  }

  // Phase 2: persona (may depend on businessType + country from phase 1)
  const personaDoc = context.persona
    ? await Persona
        .findOne({ slug: context.persona, isActive: true })
        .select('_id slug')
        .lean<Pick<IPersona, '_id' | 'slug'>>()
    : await inferPersona(
        businessType?._id as any,
        country?._id     as any,
      )

  return {
    context,
    channel,
    languageId:       language._id as any,
    languageCode:     context.language,
    countryId:        country      ? (country._id      as any) : null,
    countryCode:      context.country,
    businessTypeId:   businessType ? (businessType._id as any) : null,
    businessTypeSlug: context.businessType,
    personaId:        personaDoc   ? (personaDoc._id   as any) : null,
    personaSlug:      personaDoc?.slug ?? null,
    scenarioId:       scenario     ? (scenario._id     as any) : null,
    scenarioStage:    scenario?.stage    ?? null,
    trigger:          context.scenario,
    scenarioDoc:      null,   // full document is returned by ScenarioSelector separately
    objectionId:      objection    ? (objection._id    as any) : null,
    objectionSlug:    (objection as any)?.slug ?? null,
  }
}

// ─── Persona inference ────────────────────────────────────────────────────────

/**
 * Infer the most relevant persona for a given business type + country.
 *
 * Matching priority (most to least specific):
 *   1. businessType AND country both match
 *   2. businessType match only
 *   3. country match only
 *   4. Any active persona (global fallback)
 */
async function inferPersona(
  businessTypeId: any,
  countryId:      any,
): Promise<Pick<IPersona, '_id' | 'slug'> | null> {
  type Result = Pick<IPersona, '_id' | 'slug'>
  const sel = '_id slug'

  if (businessTypeId && countryId) {
    const p = await Persona
      .findOne({ businessTypes: businessTypeId, countries: countryId, isActive: true })
      .sort({ sortOrder: 1, slug: 1 })
      .select(sel)
      .lean<Result>()
    if (p) return p
  }

  if (businessTypeId) {
    const p = await Persona
      .findOne({ businessTypes: businessTypeId, isActive: true })
      .sort({ sortOrder: 1, slug: 1 })
      .select(sel)
      .lean<Result>()
    if (p) return p
  }

  if (countryId) {
    const p = await Persona
      .findOne({ countries: countryId, isActive: true })
      .sort({ sortOrder: 1, slug: 1 })
      .select(sel)
      .lean<Result>()
    if (p) return p
  }

  return Persona
    .findOne({ isActive: true })
    .sort({ sortOrder: 1, slug: 1 })
    .select(sel)
    .lean<Result>()
}

// ─── Persona step builder ─────────────────────────────────────────────────────

function buildPersonaStep(ctx: ResolvedDecisionContext): DecisionStep {
  if (!ctx.personaId) {
    return failedStep(
      'PERSONA',
      'No persona resolved. Template and rule selection will proceed without persona targeting.',
    )
  }

  const wasExplicit = Boolean(ctx.context.persona)
  const reason = wasExplicit
    ? `Explicitly provided: persona='${ctx.personaSlug}'.`
    : `Inferred for businessType='${ctx.businessTypeSlug}' + country='${ctx.countryCode}': ` +
      `persona='${ctx.personaSlug}'.`

  return successStep('PERSONA', ctx.personaSlug!, reason, -1, 0, [])
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function emptyResult(errors: string[]): DecisionResult {
  const breakdown = buildScoreBreakdown(0, 0, 0, 0)
  return {
    selectedTemplate:         null,
    selectedAIRules:          [],
    selectedVariables:        {},
    selectedScenario:         null,
    selectedFollowupSequence: null,
    confidenceScore:          0,
    reasoning: {
      summary:        `Decision failed: ${errors[0]}`,
      steps:          [failedStep('SCENARIO', errors.join('; '))],
      scoreBreakdown: breakdown,
    },
    warnings: [],
    errors,
  }
}
