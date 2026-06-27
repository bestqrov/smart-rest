import { BusinessType }   from '../models/BusinessType'
import type { IBusinessType } from '../models/BusinessType'
import type { BusinessTypeKnowledge } from './types'
import {
  BUSINESS_TYPE_PROFILES,
  DEFAULT_BUSINESS_TYPE_ENRICHMENT,
  type BusinessTypeEnrichment,
} from './profiles/businessType'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up by slug (e.g. "restaurant", "cafe"). */
export async function getBySlug(slug: string): Promise<BusinessTypeKnowledge | null> {
  const doc = await BusinessType.findOne({ slug, isActive: true }).lean<IBusinessType>()
  return doc ? enrich(doc) : null
}

/** Look up by MongoDB ObjectId. */
export async function getById(id: string): Promise<BusinessTypeKnowledge | null> {
  const doc = await BusinessType.findById(id).lean<IBusinessType>()
  return doc ? enrich(doc) : null
}

/** Batch lookup by slugs — returns map keyed by slug. */
export async function getBySlugs(slugs: string[]): Promise<Record<string, BusinessTypeKnowledge>> {
  if (!slugs.length) return {}
  const docs = await BusinessType
    .find({ slug: { $in: slugs }, isActive: true })
    .lean<IBusinessType[]>()
  return Object.fromEntries(docs.map(d => [d.slug, enrich(d)]))
}

/** All active business types, sorted by sortOrder. */
export async function getAll(): Promise<BusinessTypeKnowledge[]> {
  const docs = await BusinessType
    .find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean<IBusinessType[]>()
  return docs.map(enrich)
}

/**
 * All business types available in a specific country.
 * Returns unrestricted types + types explicitly restricted to that country.
 */
export async function getForCountry(countryId: string): Promise<BusinessTypeKnowledge[]> {
  const docs = await BusinessType.find({
    isActive: true,
    $or: [
      { restrictedToCountries: { $size: 0 } },
      { restrictedToCountries: countryId },
    ],
  }).sort({ sortOrder: 1 }).lean<IBusinessType[]>()
  return docs.map(enrich)
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrich(doc: IBusinessType): BusinessTypeKnowledge {
  const profile = resolveProfile(doc.slug)
  return {
    // From DB
    slug:      doc.slug,
    nameEn:    doc.nameEn,
    nameAr:    doc.nameAr,
    nameFr:    doc.nameFr,
    icon:      doc.icon,
    sortOrder: doc.sortOrder,
    // From profile
    ...profile,
  }
}

function resolveProfile(slug: string): BusinessTypeEnrichment {
  return BUSINESS_TYPE_PROFILES[slug] ?? DEFAULT_BUSINESS_TYPE_ENRICHMENT
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Enrich from plain object — no DB call. For unit testing. */
export function enrichSync(doc: Pick<IBusinessType,
  'slug' | 'nameEn' | 'nameAr' | 'nameFr' | 'icon' | 'sortOrder'
>): BusinessTypeKnowledge {
  return enrich(doc as IBusinessType)
}

/**
 * Determine the best contact window given a business type's peak hours.
 * Pure utility — no DB needed.
 */
export function bestContactWindowForSlug(slug: string): string[] {
  const profile = resolveProfile(slug)
  return profile.bestContactHours
}
