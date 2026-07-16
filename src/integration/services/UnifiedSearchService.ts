// ─── SmartSuite OS — Unified Search ──────────────────────────────────────────
// Aggregates search results from all registered modules that expose a search provider.
// Future modules register via IntegrationRegistry — no code changes needed here.

import { getModulesByCapability }               from '../registry/IntegrationRegistry'
import type { SearchResult, SearchProvider }    from '../registry/IntegrationRegistry'

export type { SearchResult }

// ─── Cross-module search ──────────────────────────────────────────────────────
export async function search(
  query:     string,
  options?: {
    modules?:  string[]    // filter to specific module IDs
    tenantId?: string
    limit?:    number
  },
): Promise<{ results: SearchResult[]; byModule: Record<string, SearchResult[]> }> {
  if (!query || query.trim().length < 2) {
    return { results: [], byModule: {} }
  }

  const mods      = getModulesByCapability('search')
  const filtered  = options?.modules
    ? mods.filter(m => options.modules!.includes(m.id))
    : mods

  const searchJobs = filtered.flatMap(mod =>
    (mod.searchProviders ?? []).map(async (provider: SearchProvider) => {
      try {
        const hits = await Promise.race([
          provider.search(query.trim(), options?.tenantId),
          new Promise<SearchResult[]>(resolve => setTimeout(() => resolve([]), 2000)),
        ])
        return hits.map(h => ({ ...h, moduleId: mod.id }))
      } catch {
        return []
      }
    })
  )

  const allResults  = (await Promise.all(searchJobs)).flat()
  const limit       = options?.limit ?? 50
  const limited     = allResults.slice(0, limit)

  const byModule: Record<string, SearchResult[]> = {}
  for (const r of limited) {
    byModule[r.moduleId] = byModule[r.moduleId] ?? []
    byModule[r.moduleId].push(r)
  }

  return { results: limited, byModule }
}

// ─── Quick search per entity type (for typeahead) ────────────────────────────
export async function quickSearch(
  query:      string,
  entityType: string,
  tenantId?:  string,
): Promise<SearchResult[]> {
  const { results } = await search(query, { tenantId, limit: 10 })
  return results.filter(r => r.entityType === entityType)
}
