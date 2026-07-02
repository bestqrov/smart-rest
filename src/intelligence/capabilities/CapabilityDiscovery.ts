// ─── Smart Intelligence Capability Engine — Discovery (K49) ────────────────

import { getAllCapabilities } from './CapabilityRegistry'
import type { CapabilityMetadata } from './types'

export function listCapabilities(): CapabilityMetadata[] {
  return getAllCapabilities()
}

export function findCapabilitiesByModule(module: string): CapabilityMetadata[] {
  return getAllCapabilities().filter(c => c.module === module)
}

export function searchCapabilities(query: string): CapabilityMetadata[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return getAllCapabilities().filter(
    c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  )
}

export function findDependentCapabilities(id: string): CapabilityMetadata[] {
  return getAllCapabilities().filter(c => (c.dependsOn ?? []).includes(id))
}
