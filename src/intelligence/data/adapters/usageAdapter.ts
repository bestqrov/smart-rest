// Reuses UsageLimitService.getAllRemainingQuotas (K9, via the billing barrel)
// — no new storage.
import { getAllRemainingQuotas } from '../../../billing'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const quotas = await getAllRemainingQuotas(tenantId)
  const computedAt = new Date()

  return Object.values(quotas).map(q => ({
    key: `usage.${q.field}.remaining`, module: 'usage', value: q.remaining, tenantId, computedAt,
  }))
}

export const usageAdapter: DataAdapterDefinition = { module: 'usage', name: 'Plan Usage Remaining', fetch }
