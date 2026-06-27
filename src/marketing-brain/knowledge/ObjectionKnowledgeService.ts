import { Objection }   from '../models/Objection'
import type { IObjection, ObjectionCategory, ObjectionFrequency } from '../models/Objection'
import type { ObjectionKnowledge } from './types'
import { OBJECTION_PROFILES, type ObjectionEnrichment } from './profiles/objection'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up a single objection by slug. */
export async function getBySlug(slug: string): Promise<ObjectionKnowledge | null> {
  const doc = await Objection.findOne({ slug, isActive: true }).lean<IObjection>()
  return doc ? enrich(doc) : null
}

/** Look up by MongoDB ObjectId. */
export async function getById(id: string): Promise<ObjectionKnowledge | null> {
  const doc = await Objection.findById(id).lean<IObjection>()
  return doc ? enrich(doc) : null
}

/** All objections of a given category, sorted by frequency (most common first). */
export async function getByCategory(
  category: ObjectionCategory,
): Promise<ObjectionKnowledge[]> {
  const order: ObjectionFrequency[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW']
  const docs = await Objection.find({ category, isActive: true }).lean<IObjection[]>()
  const enriched = docs.map(enrich)
  enriched.sort((a, b) => order.indexOf(a.frequency) - order.indexOf(b.frequency))
  return enriched
}

/**
 * Batch lookup by slugs — returns map keyed by slug.
 * Useful when the caller already knows which objections to load
 * (e.g. from a persona's likelyObjections list).
 */
export async function getBySlugs(slugs: string[]): Promise<Record<string, ObjectionKnowledge>> {
  if (!slugs.length) return {}
  const docs = await Objection.find({ slug: { $in: slugs }, isActive: true }).lean<IObjection[]>()
  return Object.fromEntries(docs.map(d => [d.slug, enrich(d)]))
}

/**
 * All objections that a given persona is likely to raise.
 * Uses the persona ObjectId to filter — returns ordered by frequency.
 */
export async function getForPersona(personaId: string): Promise<ObjectionKnowledge[]> {
  const order: ObjectionFrequency[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW']
  const docs = await Objection
    .find({ personas: personaId, isActive: true })
    .lean<IObjection[]>()
  const enriched = docs.map(enrich)
  enriched.sort((a, b) => order.indexOf(a.frequency) - order.indexOf(b.frequency))
  return enriched
}

/**
 * Return the handling playbook for a given category without hitting the DB.
 * Pure — safe to call in tests or build-time tooling.
 */
export function getPlaybookForCategory(
  category: ObjectionCategory,
): ObjectionEnrichment {
  return OBJECTION_PROFILES[category]
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrich(doc: IObjection): ObjectionKnowledge {
  const profile = OBJECTION_PROFILES[doc.category] ?? OBJECTION_PROFILES['OTHER']
  return {
    // From DB
    slug:         doc.slug,
    category:     doc.category,
    frequency:    doc.frequency,
    translations: doc.translations,
    // From profile
    ...profile,
  }
}

// ─── Pure helper ──────────────────────────────────────────────────────────────

/** Enrich from plain object — no DB call. For unit testing. */
export function enrichSync(doc: Pick<IObjection,
  'slug' | 'category' | 'frequency' | 'translations'
>): ObjectionKnowledge {
  return enrich(doc as IObjection)
}
