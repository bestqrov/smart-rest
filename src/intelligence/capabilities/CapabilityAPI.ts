// ─── Smart Intelligence Capability Engine — Public API (K49) ───────────────
// Thin consumer-facing surface over the registry/discovery/graph/
// compatibility/lifecycle/tenant-resolution modules.

import { registerCapability, getCapability, getCapabilityMetadata } from './CapabilityRegistry'
import { listCapabilities, findCapabilitiesByModule, searchCapabilities } from './CapabilityDiscovery'
import { resolveCapabilityOrder, getTransitiveDependencies } from './CapabilityDependencyGraph'
import { validateCapabilitySet } from './CapabilityCompatibility'
import { activateCapability, deprecateCapability, disableCapability } from './CapabilityLifecycle'
import { resolveCapabilitiesForTenant, isCapabilityAvailableForTenant } from './CapabilityTenantResolver'

export {
  registerCapability, getCapability, getCapabilityMetadata,
  listCapabilities, findCapabilitiesByModule, searchCapabilities,
  resolveCapabilityOrder, getTransitiveDependencies,
  validateCapabilitySet,
  activateCapability, deprecateCapability, disableCapability,
  resolveCapabilitiesForTenant, isCapabilityAvailableForTenant,
}
