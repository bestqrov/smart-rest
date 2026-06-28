import type { ProfileDefinition } from '../types'

// ─── In-memory profile registry ───────────────────────────────────────────────

const registry = new Map<string, ProfileDefinition>()

export function registerProfile(profile: ProfileDefinition): void {
  if (registry.has(profile.id)) {
    throw new Error(`CertificationProfile "${profile.id}" is already registered`)
  }
  registry.set(profile.id, profile)
}

export function getProfile(id: string): ProfileDefinition {
  const p = registry.get(id)
  if (!p) throw new Error(`CertificationProfile "${id}" not found`)
  return p
}

export function getAllProfiles(): ProfileDefinition[] {
  return Array.from(registry.values())
}

export function hasProfile(id: string): boolean {
  return registry.has(id)
}
