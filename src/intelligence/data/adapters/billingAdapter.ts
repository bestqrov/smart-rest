// Reuses SubscriptionService.getSubscription (K2, via the billing barrel) —
// the tenant-scoped billing state; no new storage. (getRevenueDashboard is
// platform-wide, not per-tenant, so it doesn't fit a tenant-aware adapter.)
import { getSubscription } from '../../../billing'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const profile = await getSubscription(tenantId)
  const computedAt = new Date()
  if (!profile) return []

  return [
    { key: 'billing.plan',  module: 'billing', value: profile.plan,  tenantId, computedAt },
    { key: 'billing.state', module: 'billing', value: profile.state, tenantId, computedAt },
    { key: 'billing.trialEndsAt', module: 'billing', value: profile.trialEndsAt ?? null, tenantId, computedAt },
  ]
}

export const billingAdapter: DataAdapterDefinition = { module: 'billing', name: 'Billing Subscription State', fetch }
