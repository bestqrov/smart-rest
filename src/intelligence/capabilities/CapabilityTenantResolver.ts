// ─── Smart Intelligence Capability Engine — Tenant Resolution (K49) ────────
// Scope check only (CapabilityScope.tenantIds), no plan/billing lookup —
// keeps this module's reuse surface to what RULES named for this sprint.

import { getAllCapabilities, getCapabilityMetadata } from './CapabilityRegistry'
import type { CapabilityMetadata } from './types'

export function resolveCapabilitiesForTenant(tenantId?: string): CapabilityMetadata[] {
  return getAllCapabilities().filter(c => {
    if (c.status !== 'ACTIVE') return false
    if (!c.scope?.tenantIds) return true
    return tenantId ? c.scope.tenantIds.includes(tenantId) : false
  })
}

export function isCapabilityAvailableForTenant(id: string, tenantId?: string): boolean {
  const meta = getCapabilityMetadata(id)
  if (!meta || meta.status !== 'ACTIVE') return false
  if (!meta.scope?.tenantIds) return true
  return tenantId ? meta.scope.tenantIds.includes(tenantId) : false
}
