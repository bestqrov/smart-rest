// ─── Smart Intelligence Data Hub — Unified Data Provider (K32) ─────────────
// The single entry point future AI agents pull tenant metrics from. Calls
// every registered adapter (each a thin wrapper over an existing domain
// service — no new storage anywhere in this module) and returns one
// normalized, validated list. No AI/prediction logic — pure retrieval and
// reshaping.

import logger from '../../logger'
import { getAllDataAdapters, getDataAdapter } from './DataAdapterRegistry'
import { isValidMetric, assertTenantId } from './DataValidation'
import { getDataCache } from './DataCache'
import type { NormalizedMetric } from './types'

const CACHE_TTL_MS = 60_000

async function fetchModule(module: string, tenantId: string): Promise<NormalizedMetric[]> {
  const adapter = getDataAdapter(module)
  if (!adapter) return []

  try {
    const metrics = await adapter.fetch(tenantId)
    return metrics.filter(isValidMetric)
  } catch (err) {
    logger.error({ msg: '[Intelligence DataHub] adapter fetch failed', module, tenantId, err })
    return []
  }
}

// ─── Tenant-aware unified access ───────────────────────────────────────────
export async function getTenantMetrics(tenantId: string, modules?: string[]): Promise<NormalizedMetric[]> {
  assertTenantId(tenantId)

  const cacheKey = `intel:metrics:${tenantId}:${modules?.join(',') ?? 'all'}`
  const cache    = getDataCache()
  const cached   = cache.get<NormalizedMetric[]>(cacheKey)
  if (cached) return cached

  const adapters = modules
    ? modules.map(m => getDataAdapter(m)).filter((a): a is NonNullable<typeof a> => !!a)
    : getAllDataAdapters()

  const results = await Promise.all(adapters.map(a => fetchModule(a.module, tenantId)))
  const metrics = results.flat()

  cache.set(cacheKey, metrics, CACHE_TTL_MS)
  return metrics
}

export async function getTenantModuleMetrics(tenantId: string, module: string): Promise<NormalizedMetric[]> {
  assertTenantId(tenantId)
  return fetchModule(module, tenantId)
}

// ─── Feature extraction pipeline ───────────────────────────────────────────
// Reshapes normalized metrics into a flat key -> value map — the shape a
// future ML/agent consumer would want. Pure data transformation, no scoring
// or inference.
export type FeatureVector = Record<string, number | string | boolean | null>

export function extractFeatureVector(metrics: NormalizedMetric[]): FeatureVector {
  const vector: FeatureVector = {}
  for (const m of metrics) {
    vector[m.key] = m.value
  }
  return vector
}

export async function getTenantFeatureVector(tenantId: string, modules?: string[]): Promise<FeatureVector> {
  const metrics = await getTenantMetrics(tenantId, modules)
  return extractFeatureVector(metrics)
}
