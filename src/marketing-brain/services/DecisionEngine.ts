import { Language }     from '../models/Language'
import { Country }      from '../models/Country'
import { BusinessType } from '../models/BusinessType'
import { Persona }      from '../models/Persona'
import { Scenario }     from '../models/Scenario'
import type { IPersona }      from '../models/Persona'
import type { Channel }       from '../models/MessageTemplate'
import type { LeadProfile, ResolvedContext, DecisionResult } from '../types'
import { validateLeadProfile } from './Validators'
import * as TemplateSelector   from './TemplateSelector'
import * as AIRuleResolver     from './AIRuleResolver'
import * as VariableResolver   from './VariableResolver'
import * as FollowupPlanner    from './FollowupPlanner'
import * as PromptBuilder      from './PromptBuilder'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given a LeadProfile, deterministically decide:
 *   1. The best matching template
 *   2. The applicable AI rules
 *   3. Resolved variable values
 *   4. The best follow-up sequence
 *   5. A provider-agnostic AI prompt
 *
 * The engine makes no AI calls — it only reads from the database
 * and applies scoring algorithms.  The caller decides what to do
 * with the resulting DecisionResult.
 *
 * Never throws.  Errors are surfaced in DecisionResult.errors.
 */
export async function decide(profile: LeadProfile): Promise<DecisionResult> {
  // 1. Validate input
  const inputErrors = validateLeadProfile(profile)
  if (inputErrors.length) {
    return emptyResult(inputErrors)
  }

  // 2. Resolve codes/slugs → ObjectIds (one DB round-trip per dimension, in parallel)
  let ctx: ResolvedContext
  try {
    ctx = await resolveContext(profile)
  } catch (err) {
    return emptyResult([`Context resolution failed: ${(err as Error).message}`])
  }

  // 3. Run selector + rule resolver + sequence planner in parallel
  //    (all three only need ctx, not each other's output)
  const [templateMatch, aiRules, sequenceMatch] = await Promise.all([
    TemplateSelector.select(ctx),
    AIRuleResolver.resolve(ctx),
    FollowupPlanner.plan(ctx),
  ])

  // 4. Resolve variables (needs the chosen template)
  const warnings: string[] = []

  let resolvedVariables: Record<string, string> = {}
  let variableErrors:    string[]               = []

  if (templateMatch) {
    const varResult = await VariableResolver.resolve(profile, templateMatch.template)
    resolvedVariables = varResult.resolved
    variableErrors    = varResult.errors
    warnings.push(...varResult.warnings)
  } else {
    warnings.push(
      `No template found for trigger="${profile.trigger}", ` +
      `language="${profile.languageCode}", channel="${ctx.channel}". ` +
      `Checked 4 fallback levels.`,
    )
  }

  // 5. Build prompt (needs template + variables + rules)
  let prompt: DecisionResult['prompt'] = null

  if (templateMatch) {
    const built = PromptBuilder.build({
      template:          templateMatch.template,
      resolvedVariables,
      aiRules,
      ctx,
    })
    const { promptWarnings, ...builtPrompt } = built
    prompt = builtPrompt
    warnings.push(...promptWarnings)
  }

  return {
    template:          templateMatch?.template    ?? null,
    followupSequence:  sequenceMatch?.sequence    ?? null,
    resolvedVariables,
    aiRules,
    prompt,
    templateScore:     templateMatch?.score       ?? 0,
    warnings,
    errors:            variableErrors,
  }
}

// ─── Context resolution ───────────────────────────────────────────────────────

async function resolveContext(profile: LeadProfile): Promise<ResolvedContext> {
  const channel = (profile.channel ?? 'WHATSAPP') as Channel

  // Phase 1: all independent lookups in parallel
  const [language, country, businessType, scenario] = await Promise.all([
    Language    .findOne({ code: profile.languageCode,     isActive: true }).select('_id').lean(),
    Country     .findOne({ code: profile.countryCode,      isActive: true }).select('_id').lean(),
    BusinessType.findOne({ slug: profile.businessTypeSlug, isActive: true }).select('_id slug').lean(),
    Scenario    .findOne({ trigger: profile.trigger,       isActive: true })
                .sort({ priority: -1 })
                .select('_id slug stage')
                .lean(),
  ])

  if (!language) {
    throw new Error(`Language "${profile.languageCode}" not found in database`)
  }

  // Phase 2: persona inference (may depend on businessType + country)
  let personaDoc: { _id: unknown; slug: string } | null = null

  if (profile.personaSlug) {
    personaDoc = await Persona
      .findOne({ slug: profile.personaSlug, isActive: true })
      .select('_id slug')
      .lean() as { _id: unknown; slug: string } | null
  } else {
    personaDoc = await inferPersona(
      businessType?._id as any,
      country?._id as any,
    )
  }

  return {
    profile,
    channel,
    languageId:       language._id as any,
    languageCode:     profile.languageCode,
    countryId:        country     ? (country._id as any)       : null,
    countryCode:      profile.countryCode,
    businessTypeId:   businessType ? (businessType._id as any) : null,
    businessTypeSlug: profile.businessTypeSlug,
    personaId:        personaDoc   ? (personaDoc._id as any)   : null,
    personaSlug:      personaDoc?.slug   ?? null,
    scenarioId:       scenario     ? (scenario._id as any)     : null,
    scenarioStage:    (scenario as any)?.stage ?? null,
    trigger:          profile.trigger,
  }
}

/**
 * Infers the most likely persona for a given business type + country.
 *
 * Matching order (most to least specific):
 *   1. businessType AND country both match
 *   2. businessType matches only
 *   3. country matches only
 *   4. Any active persona (fallback)
 */
async function inferPersona(
  businessTypeId: any,
  countryId:      any,
): Promise<Pick<IPersona, '_id' | 'slug'> | null> {
  type Result = Pick<IPersona, '_id' | 'slug'>

  const select = '_id slug'

  // 1. Both dimensions
  if (businessTypeId && countryId) {
    const p = await Persona
      .findOne({ businessTypes: businessTypeId, countries: countryId, isActive: true })
      .sort({ sortOrder: 1 })
      .select(select)
      .lean<Result>()
    if (p) return p
  }

  // 2. Business type only
  if (businessTypeId) {
    const p = await Persona
      .findOne({ businessTypes: businessTypeId, isActive: true })
      .sort({ sortOrder: 1 })
      .select(select)
      .lean<Result>()
    if (p) return p
  }

  // 3. Country only
  if (countryId) {
    const p = await Persona
      .findOne({ countries: countryId, isActive: true })
      .sort({ sortOrder: 1 })
      .select(select)
      .lean<Result>()
    if (p) return p
  }

  // 4. Any active persona
  return Persona
    .findOne({ isActive: true })
    .sort({ sortOrder: 1 })
    .select(select)
    .lean<Result>()
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function emptyResult(errors: string[]): DecisionResult {
  return {
    template:          null,
    followupSequence:  null,
    resolvedVariables: {},
    aiRules:           [],
    prompt:            null,
    templateScore:     0,
    warnings:          [],
    errors,
  }
}
