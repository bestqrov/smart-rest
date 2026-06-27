import { Country }   from '../models/Country'
import type { ICountry, Region } from '../models/Country'
import type { CountryKnowledge }  from './types'
import {
  COUNTRY_PROFILES,
  REGION_PROFILES,
  DEFAULT_COUNTRY_ENRICHMENT,
  type CountryEnrichment,
} from './profiles/country'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up by ISO 3166-1 alpha-2 code (e.g. "MA", "SA"). */
export async function getByCode(code: string): Promise<CountryKnowledge | null> {
  const doc = await Country.findOne({ code: code.toUpperCase(), isActive: true }).lean<ICountry>()
  return doc ? enrich(doc) : null
}

/** Look up by MongoDB ObjectId. */
export async function getById(id: string): Promise<CountryKnowledge | null> {
  const doc = await Country.findById(id).lean<ICountry>()
  return doc ? enrich(doc) : null
}

/** Batch lookup — returns a map keyed by country code. */
export async function getByCodes(codes: string[]): Promise<Record<string, CountryKnowledge>> {
  if (!codes.length) return {}
  const upper = codes.map(c => c.toUpperCase())
  const docs = await Country.find({ code: { $in: upper }, isActive: true }).lean<ICountry[]>()
  return Object.fromEntries(docs.map(d => [d.code, enrich(d)]))
}

/** All active countries, grouped by region. */
export async function getAllByRegion(): Promise<Record<Region, CountryKnowledge[]>> {
  const docs = await Country.find({ isActive: true }).sort({ code: 1 }).lean<ICountry[]>()
  const result = {} as Record<Region, CountryKnowledge[]>
  for (const doc of docs) {
    const knowledge = enrich(doc)
    if (!result[doc.region]) result[doc.region] = []
    result[doc.region].push(knowledge)
  }
  return result
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrich(doc: ICountry): CountryKnowledge {
  const profile = resolveProfile(doc.code, doc.region)
  return {
    // From DB
    code:        doc.code,
    nameEn:      doc.nameEn,
    nameAr:      doc.nameAr,
    nameFr:      doc.nameFr,
    region:      doc.region,
    currency:    doc.currency,
    phonePrefix: doc.phonePrefix,
    // From profile (hardcoded expertise)
    ...profile,
  }
}

/**
 * Resolution priority:
 *   1. Exact country code profile
 *   2. Region-level defaults (partial merge)
 *   3. Global default
 */
function resolveProfile(code: string, region: Region): CountryEnrichment {
  const exact = COUNTRY_PROFILES[code]
  if (exact) return exact

  const regionDefaults = REGION_PROFILES[region] ?? {}

  return {
    ...DEFAULT_COUNTRY_ENRICHMENT,
    ...regionDefaults,
    // These fields need full arrays — fall back to default when region doesn't specify
    trustBuilding:   DEFAULT_COUNTRY_ENRICHMENT.trustBuilding,
    culturalNotes:   DEFAULT_COUNTRY_ENRICHMENT.culturalNotes,
    businessCulture: DEFAULT_COUNTRY_ENRICHMENT.businessCulture,
    keyPainPoints:   DEFAULT_COUNTRY_ENRICHMENT.keyPainPoints,
  }
}

// ─── Pure helpers (for unit testing without DB) ───────────────────────────────

/** Build a CountryKnowledge from a plain object — no DB call.
 *  Useful in tests: pass a mock ICountry and verify enrichment logic. */
export function enrichSync(doc: Pick<ICountry,
  'code' | 'nameEn' | 'nameAr' | 'nameFr' | 'region' | 'currency' | 'phonePrefix'
>): CountryKnowledge {
  return enrich(doc as ICountry)
}
