// ─── Smart Intelligence Capability Engine — Registry (K49) ─────────────────
// Same registry-of-definitions + colocated status idiom used throughout
// this module (K40 AgentFrameworkRegistry, K47 SkillRegistry). dependsOn
// and conflictsWith must reference already-registered ids — same
// fail-fast rule K46's AdvisorRegistry uses for its capability checks.

import type { CapabilityDefinition, CapabilityLifecycleStatus, CapabilityMetadata } from './types'

const definitions = new Map<string, CapabilityDefinition>()
const status      = new Map<string, CapabilityLifecycleStatus>()

export function registerCapability(def: CapabilityDefinition): void {
  if (definitions.has(def.id)) {
    throw new Error(`Intelligence: capability "${def.id}" is already registered`)
  }
  for (const dep of [...(def.dependsOn ?? []), ...(def.conflictsWith ?? [])]) {
    if (!definitions.has(dep)) {
      throw new Error(`Intelligence: capability "${def.id}" references unregistered capability "${dep}"`)
    }
  }
  definitions.set(def.id, def)
  status.set(def.id, 'REGISTERED')
}

export function getCapability(id: string): CapabilityDefinition | undefined {
  return definitions.get(id)
}

export function hasCapabilityRegistered(id: string): boolean {
  return definitions.has(id)
}

export function getCapabilityMetadata(id: string): CapabilityMetadata | undefined {
  const def = definitions.get(id)
  const s   = status.get(id)
  if (!def || !s) return undefined
  return { ...def, status: s }
}

export function getAllCapabilities(): CapabilityMetadata[] {
  return [...definitions.keys()]
    .map(id => getCapabilityMetadata(id))
    .filter((m): m is CapabilityMetadata => m !== undefined)
}

export function getCapabilityStatus(id: string): CapabilityLifecycleStatus | undefined {
  return status.get(id)
}

export function setCapabilityStatus(id: string, next: CapabilityLifecycleStatus): void {
  if (!definitions.has(id)) throw new Error(`Intelligence: capability "${id}" is not registered`)
  status.set(id, next)
}

// for testing only
export function _resetCapabilityRegistry(): void {
  definitions.clear()
  status.clear()
}
