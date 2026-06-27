/**
 * Marketing Brain — Seed runner
 *
 * Idempotent: safe to run multiple times.
 * Each collection uses upsert (updateOne with upsert:true) so re-running
 * only updates changed fields without creating duplicates.
 *
 * Order matters — later collections reference earlier ones:
 *   Language → Country → BusinessType → Persona → Scenario → Objection
 *   → MessageTemplate → FollowupSequence
 *
 * Usage:
 *   ts-node src/marketing-brain/seed/index.ts
 *   — or call seedMarketingBrain() programmatically from server startup.
 */

import { connect, disconnect } from '../connection'
import {
  Language, Country, BusinessType, Persona,
  Scenario, Objection, MessageTemplate, FollowupSequence,
} from '../models'

import { LANGUAGES }           from './languages'
import { COUNTRIES }           from './countries'
import { BUSINESS_TYPES }      from './businessTypes'
import { PERSONAS }            from './personas'
import { SCENARIOS }           from './scenarios'
import { OBJECTIONS }          from './objections'
import { MESSAGE_TEMPLATES }   from './messageTemplates'
import { FOLLOWUP_SEQUENCES }  from './followupSequences'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve an array of language codes to ObjectIds. */
async function langIds(codes: string[]) {
  if (!codes.length) return []
  const docs = await Language.find({ code: { $in: codes } }).select('_id code').lean()
  return docs.map(d => d._id)
}

/** Resolve an array of country codes to ObjectIds. */
async function countryIds(codes: string[]) {
  if (!codes.length) return []
  const docs = await Country.find({ code: { $in: codes } }).select('_id code').lean()
  return docs.map(d => d._id)
}

/** Resolve an array of business type slugs to ObjectIds. */
async function btIds(slugs: string[]) {
  if (!slugs.length) return []
  const docs = await BusinessType.find({ slug: { $in: slugs } }).select('_id slug').lean()
  return docs.map(d => d._id)
}

/** Resolve an array of persona slugs to ObjectIds. */
async function personaIds(slugs: string[]) {
  if (!slugs.length) return []
  const docs = await Persona.find({ slug: { $in: slugs } }).select('_id slug').lean()
  return docs.map(d => d._id)
}

/** Resolve a single slug to ObjectId or throw. */
async function requireScenarioId(slug: string) {
  const doc = await Scenario.findOne({ slug }).select('_id').lean()
  if (!doc) throw new Error(`Scenario not found: ${slug}`)
  return doc._id
}

async function requirePersonaId(slug: string) {
  const doc = await Persona.findOne({ slug }).select('_id').lean()
  if (!doc) throw new Error(`Persona not found: ${slug}`)
  return doc._id
}

async function requireLanguageId(code: string) {
  const doc = await Language.findOne({ code }).select('_id').lean()
  if (!doc) throw new Error(`Language not found: ${code}`)
  return doc._id
}

async function optionalBusinessTypeId(slug: string | null) {
  if (!slug) return null
  const doc = await BusinessType.findOne({ slug }).select('_id').lean()
  return doc ? doc._id : null
}

async function optionalCountryId(code: string | null) {
  if (!code) return null
  const doc = await Country.findOne({ code }).select('_id').lean()
  return doc ? doc._id : null
}

async function requireTemplateId(slug: string) {
  const doc = await MessageTemplate.findOne({ slug }).select('_id').lean()
  if (!doc) throw new Error(`MessageTemplate not found: ${slug}`)
  return doc._id
}

// ─── Seed steps ───────────────────────────────────────────────────────────────

async function seedLanguages() {
  let count = 0
  for (const item of LANGUAGES) {
    await Language.updateOne({ code: item.code }, { $set: item }, { upsert: true })
    count++
  }
  console.log(`[MB Seed] Languages: ${count} upserted`)
}

async function seedCountries() {
  let count = 0
  for (const item of COUNTRIES) {
    // Resolve language refs from country's language list (all countries support all seeded langs for now)
    const allLangIds = await Language.find({ isActive: true }).select('_id').lean()
    await Country.updateOne(
      { code: item.code },
      { $set: { ...item, supportedLanguages: allLangIds.map(l => l._id) } },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] Countries: ${count} upserted`)
}

async function seedBusinessTypes() {
  let count = 0
  for (const item of BUSINESS_TYPES) {
    await BusinessType.updateOne({ slug: item.slug }, { $set: item }, { upsert: true })
    count++
  }
  console.log(`[MB Seed] BusinessTypes: ${count} upserted`)
}

async function seedPersonas() {
  let count = 0
  for (const item of PERSONAS) {
    const { businessTypeSlugs, countryCodes, ...rest } = item as any
    const [btObjectIds, countryObjectIds] = await Promise.all([
      btIds(businessTypeSlugs ?? []),
      countryIds(countryCodes ?? []),
    ])
    await Persona.updateOne(
      { slug: rest.slug },
      { $set: { ...rest, businessTypes: btObjectIds, countries: countryObjectIds } },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] Personas: ${count} upserted`)
}

async function seedScenarios() {
  let count = 0
  for (const item of SCENARIOS) {
    const { personaSlugs, businessTypeSlugs, ...rest } = item as any
    const [pIds, btObjectIds] = await Promise.all([
      personaIds(personaSlugs ?? []),
      btIds(businessTypeSlugs ?? []),
    ])
    await Scenario.updateOne(
      { slug: rest.slug },
      { $set: { ...rest, personas: pIds, businessTypes: btObjectIds } },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] Scenarios: ${count} upserted`)
}

async function seedObjections() {
  let count = 0
  for (const item of OBJECTIONS) {
    const { personaSlugs, ...rest } = item as any
    const pIds = await personaIds(personaSlugs ?? [])
    await Objection.updateOne(
      { slug: rest.slug },
      { $set: { ...rest, personas: pIds, responseTemplates: [] } },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] Objections: ${count} upserted`)
}

async function seedMessageTemplates() {
  let count = 0
  for (const item of MESSAGE_TEMPLATES) {
    const { scenarioSlug, personaSlug, languageCode, countryCode, businessTypeSlug, ...rest } = item as any
    const [scenarioId, personaId, languageId, countryId, btId] = await Promise.all([
      requireScenarioId(scenarioSlug),
      requirePersonaId(personaSlug),
      requireLanguageId(languageCode),
      optionalCountryId(countryCode),
      optionalBusinessTypeId(businessTypeSlug),
    ])
    await MessageTemplate.updateOne(
      { slug: rest.slug },
      {
        $set: {
          ...rest,
          scenario:     scenarioId,
          persona:      personaId,
          language:     languageId,
          country:      countryId,
          businessType: btId,
          // Preserve existing stats on re-seed — only set on insert
        },
        $setOnInsert: { stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, converted: 0, bounced: 0 } },
      },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] MessageTemplates: ${count} upserted`)
}

async function seedFollowupSequences() {
  let count = 0
  for (const item of FOLLOWUP_SEQUENCES) {
    const { scenarioSlug, personaSlug, languageCode, countryCode, businessTypeSlug, steps, ...rest } = item as any

    const [scenarioId, personaId, languageId, countryId, btId] = await Promise.all([
      requireScenarioId(scenarioSlug),
      requirePersonaId(personaSlug),
      requireLanguageId(languageCode),
      optionalCountryId(countryCode),
      optionalBusinessTypeId(businessTypeSlug),
    ])

    // Resolve template slugs within steps
    const resolvedSteps = await Promise.all(
      steps.map(async (step: any) => {
        const { templateSlug, ...stepRest } = step
        const templateId = await requireTemplateId(templateSlug)
        return { ...stepRest, template: templateId }
      }),
    )

    await FollowupSequence.updateOne(
      { slug: rest.slug },
      {
        $set: {
          ...rest,
          scenario:     scenarioId,
          persona:      personaId,
          language:     languageId,
          country:      countryId,
          businessType: btId,
          steps:        resolvedSteps,
        },
      },
      { upsert: true },
    )
    count++
  }
  console.log(`[MB Seed] FollowupSequences: ${count} upserted`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function seedMarketingBrain(): Promise<void> {
  await seedLanguages()
  await seedCountries()
  await seedBusinessTypes()
  await seedPersonas()
  await seedScenarios()
  await seedObjections()
  await seedMessageTemplates()
  await seedFollowupSequences()
}

// Allow direct execution: ts-node src/marketing-brain/seed/index.ts
if (require.main === module) {
  ;(async () => {
    try {
      await connect()
      await seedMarketingBrain()
      console.log('[MB Seed] Done ✅')
    } catch (err) {
      console.error('[MB Seed] Failed:', err)
      process.exit(1)
    } finally {
      await disconnect()
    }
  })()
}
