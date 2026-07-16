// ─── Smart Intelligence Dashboard Integration — Tenant/Branch Filtering (K57) ─
// Reuses K33's Context Engine (BranchContext) — no new branch lookup.

import { getContextForTenant } from '../context'

// A branch cafe rolls its dashboard up to its parent by default — the same
// tenant scoping every widget's underlying function already expects a
// single cafeId for, so this just picks the right one, it never fans out
// to multiple tenantIds.
export async function resolveDashboardTenantId(cafeId: string, includeParentRollup = true): Promise<string> {
  if (!includeParentRollup) return cafeId

  const context = await getContextForTenant(cafeId)
  if (context.branch.isBranch && context.branch.parentCafeId) {
    return context.branch.parentCafeId
  }
  return cafeId
}
