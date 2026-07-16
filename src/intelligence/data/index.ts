// ─── Smart Intelligence Data Hub — Public API (K32) ────────────────────────

export type { NormalizedMetric, DataAdapterDefinition } from './types'

export {
  registerDataAdapter,
  getDataAdapter,
  hasDataAdapter,
  getAllDataAdapters,
} from './DataAdapterRegistry'

export { registerBuiltinDataAdapters } from './adapters'

export { isValidMetric, assertTenantId } from './DataValidation'

export type { DataCache } from './DataCache'
export { getDataCache, setDataCache } from './DataCache'

export {
  getTenantMetrics,
  getTenantModuleMetrics,
  extractFeatureVector,
  getTenantFeatureVector,
} from './DataProvider'
export type { FeatureVector } from './DataProvider'
