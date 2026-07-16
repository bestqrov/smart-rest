// ─── Smart Intelligence Skill System — Discovery (K47) ─────────────────────
// Metadata-only queries over the current version of each skill — never
// exposes the handle function.

import { listCurrentSkills } from './SkillRegistry'
import type { SkillMetadata } from './types'

export function discoverSkills(): SkillMetadata[] {
  return listCurrentSkills()
}

export function discoverSkillsByModule(module: string): SkillMetadata[] {
  return listCurrentSkills().filter(s => s.module === module)
}

export function discoverSkillsByCapability(capability: string): SkillMetadata[] {
  return listCurrentSkills().filter(s => s.permission.requiredCapabilities.includes(capability))
}

export function searchSkills(query: string): SkillMetadata[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return listCurrentSkills().filter(
    s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  )
}
