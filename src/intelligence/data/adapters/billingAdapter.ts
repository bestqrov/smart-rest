// Reuses SubscriptionService.getSubscriptionByTenant (K2, via the billing
// barrel) — the tenant-scoped billing state; no new storage.
// (getRevenueDashboard is platform-wide, not per-tenant, so it doesn't fit a
// tenant-aware adapter.)
import { getSubscriptionByTenant } from '../../../billing'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const sub = await getSubscriptionByTenant(tenantId)
  const computedAt = new Date()
  if (!sub) return []

  return [
    { key: 'billing.plan',  module: 'billing', value: sub.planCode, tenantId, computedAt },
    { key: 'billing.state', module: 'billing', value: sub.status,   tenantId, computedAt },
    { key: 'billing.trialEndsAt', module: 'billing', value: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null, tenantId, computedAt },
  ]
}

export const billingAdapter: DataAdapterDefinition = { module: 'billing', name: 'Billing Subscription State', fetch }
