// ─── Smart Intelligence Capability Engine — Lifecycle (K49) ────────────────
// REGISTERED -> ACTIVE -> DEPRECATED/DISABLED. Activation requires every
// dependency to already be ACTIVE — a capability can't go live ahead of
// what it depends on.

import { getCapability, getCapabilityStatus, setCapabilityStatus } from './CapabilityRegistry'

export function activateCapability(id: string): void {
  const def = getCapability(id)
  if (!def) throw new Error(`Intelligence: capability "${id}" is not registered`)

  const notActive = (def.dependsOn ?? []).filter(dep => getCapabilityStatus(dep) !== 'ACTIVE')
  if (notActive.length > 0) {
    throw new Error(`Intelligence: cannot activate "${id}" — dependencies not ACTIVE: ${notActive.join(', ')}`)
  }

  setCapabilityStatus(id, 'ACTIVE')
}

export function deprecateCapability(id: string): void {
  setCapabilityStatus(id, 'DEPRECATED')
}

export function disableCapability(id: string): void {
  setCapabilityStatus(id, 'DISABLED')
}
