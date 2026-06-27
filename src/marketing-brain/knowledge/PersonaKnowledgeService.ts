import { Persona }   from '../models/Persona'
import type { IPersona } from '../models/Persona'
import type { PersonaKnowledge } from './types'
import {
  PERSONA_PROFILES,
  DEFAULT_PERSONA_ENRICHMENT,
  type PersonaEnrichment,
} from './profiles/persona'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up by slug (e.g. "traditional_owner"). */
export async function getBySlug(slug: string): Promise<PersonaKnowledge | null> {
  const doc = await Persona.findOne({ slug, isActive: true }).lean<IPersona>()
  return doc ? enrich(doc) : null
}

/** Look up by MongoDB ObjectId. */
export async function getById(id: string): Promise<PersonaKnowledge | null> {
  const doc = await Persona.findById(id).lean<IPersona>()
  return doc ? enrich(doc) : null
}

/** Batch lookup by slugs — returns map keyed by slug. */
export async function getBySlugs(slugs: string[]): Promise<Record<string, PersonaKnowledge>> {
  if (!slugs.length) return {}
  const docs = await Persona.find({ slug: { $in: slugs }, isActive: true }).lean<IPersona[]>()
  return Object.fromEntries(docs.map(d => [d.slug, enrich(d)]))
}

/** All active personas, sorted by sortOrder. */
export async function getAll(): Promise<PersonaKnowledge[]> {
  const docs = await Persona.find({ isActive: true }).sort({ sortOrder: 1 }).lean<IPersona[]>()
  return docs.map(enrich)
}

/**
 * Infer the most relevant persona for a given business type and country.
 * Returns the first persona that matches both dimensions; falls back to
 * business-type-only, then country-only, then the lowest-sortOrder active persona.
 */
export async function inferForContext(
  businessTypeId: string | null,
  countryId:      string | null,
): Promise<PersonaKnowledge | null> {
  const base = { isActive: true }

  if (businessTypeId && countryId) {
    const doc = await Persona.findOne({
      ...base,
      businessTypes: businessTypeId,
      countries:     countryId,
    }).sort({ sortOrder: 1 }).lean<IPersona>()
    if (doc) return enrich(doc)
  }

  if (businessTypeId) {
    const doc = await Persona.findOne({ ...base, businessTypes: businessTypeId })
      .sort({ sortOrder: 1 }).lean<IPersona>()
    if (doc) return enrich(doc)
  }

  if (countryId) {
    const doc = await Persona.findOne({ ...base, countries: countryId })
      .sort({ sortOrder: 1 }).lean<IPersona>()
    if (doc) return enrich(doc)
  }

  const fallback = await Persona.findOne(base).sort({ sortOrder: 1 }).lean<IPersona>()
  return fallback ? enrich(fallback) : null
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrich(doc: IPersona): PersonaKnowledge {
  const profile = resolveProfile(doc.slug)
  return {
    // From DB
    slug:              doc.slug,
    nameEn:            doc.nameEn,
    nameAr:            doc.nameAr,
    nameFr:            doc.nameFr,
    ageRange:          doc.demographic.ageRange,
    painPoints:        doc.painPoints,
    goals:             doc.goals,
    preferredChannels: doc.demographic.preferredChannels,
    // From profile
    ...profile,
  }
}

function resolveProfile(slug: string): PersonaEnrichment {
  return PERSONA_PROFILES[slug] ?? DEFAULT_PERSONA_ENRICHMENT
}

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function enrichSync(doc: Pick<IPersona,
  'slug' | 'nameEn' | 'nameAr' | 'nameFr' | 'painPoints' | 'goals' | 'demographic'
>): PersonaKnowledge {
  return enrich(doc as IPersona)
}
