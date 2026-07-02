// ─── Smart Intelligence Capability Engine — Compatibility (K49) ────────────
// requiresProvider checks reuse K42's getProvider directly instead of a
// second provider-health tracker.

import { getProvider } from '../ai'
import { getCapability, hasCapabilityRegistered } from './CapabilityRegistry'
import type { CapabilityValidationResult } from './types'

export function validateCapabilitySet(ids: string[]): CapabilityValidationResult {
  const errors: string[] = []
  const set = new Set(ids)

  for (const id of ids) {
    const def = getCapability(id)
    if (!def) {
      errors.push(`capability "${id}" is not registered`)
      continue
    }

    for (const dep of def.dependsOn ?? []) {
      if (!set.has(dep)) errors.push(`capability "${id}" requires "${dep}", which is not in the set`)
    }

    for (const conflict of def.conflictsWith ?? []) {
      if (set.has(conflict)) errors.push(`capability "${id}" conflicts with "${conflict}"`)
    }

    if (def.requiresProvider) {
      const provider = getProvider(def.requiresProvider)
      if (!provider || !provider.isActive) {
        errors.push(`capability "${id}" requires active AI provider "${def.requiresProvider}"`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function isCapabilityRegistered(id: string): boolean {
  return hasCapabilityRegistered(id)
}
