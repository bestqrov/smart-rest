// ─── Smart Intelligence Skill System — Registry (K47) ──────────────────────
// Same compound-key + "current" pointer idiom as K42's ModelRegistry
// (provider:modelId + isDefault) applied to id:version, plus a colocated
// health Map — the same pairing K40's AgentFrameworkRegistry uses for
// definitions+health. One registry, not two.

import type { SkillDefinition, SkillHealth, SkillMetadata, SkillStatus } from './types'

const definitions    = new Map<string, SkillDefinition>()   // key: `${id}@${version}`
const currentVersion = new Map<string, string>()             // id -> version
const health          = new Map<string, SkillHealth>()        // id -> health (reflects the current version's usage)

function key(id: string, version: string): string {
  return `${id}@${version}`
}

function initialHealth(): SkillHealth {
  return { status: 'REGISTERED', invocationCount: 0, errorCount: 0 }
}

export function registerSkill(def: SkillDefinition, opts: { setAsCurrent?: boolean } = {}): void {
  const k = key(def.id, def.version)
  if (definitions.has(k)) {
    throw new Error(`Intelligence: skill "${k}" is already registered`)
  }
  definitions.set(k, def)
  if (opts.setAsCurrent !== false) currentVersion.set(def.id, def.version)
  if (!health.has(def.id)) health.set(def.id, initialHealth())
}

export function getSkill(id: string, version?: string): SkillDefinition | undefined {
  const v = version ?? currentVersion.get(id)
  if (!v) return undefined
  return definitions.get(key(id, v))
}

function toMetadata(def: SkillDefinition): SkillMetadata {
  const { id, name, version, description, module, permission } = def
  return { id, name, version, description, module, permission }
}

export function getSkillMetadata(id: string, version?: string): SkillMetadata | undefined {
  const def = getSkill(id, version)
  return def ? toMetadata(def) : undefined
}

export function getAllSkillVersions(id: string): SkillDefinition[] {
  return [...definitions.values()].filter(d => d.id === id)
}

export function listSkillIds(): string[] {
  return [...currentVersion.keys()]
}

export function listCurrentSkills(): SkillMetadata[] {
  return listSkillIds()
    .map(id => getSkillMetadata(id))
    .filter((m): m is SkillMetadata => m !== undefined)
}

export function setCurrentSkillVersion(id: string, version: string): void {
  if (!definitions.has(key(id, version))) {
    throw new Error(`Intelligence: skill "${id}" has no registered version "${version}"`)
  }
  currentVersion.set(id, version)
}

export function getCurrentSkillVersion(id: string): string | undefined {
  return currentVersion.get(id)
}

// ─── Health/status ──────────────────────────────────────────────────────────
export function getSkillHealth(id: string): SkillHealth | undefined {
  return health.get(id)
}

export function setSkillStatus(id: string, status: SkillStatus): void {
  const h = health.get(id)
  if (!h) throw new Error(`Intelligence: skill "${id}" is not registered`)
  h.status = status
}

export function recordSkillInvocation(id: string, outcome: { success: boolean; error?: string }): void {
  const h = health.get(id)
  if (!h) return
  h.invocationCount += 1
  h.lastInvokedAt = new Date()
  if (outcome.success) {
    if (h.status === 'REGISTERED') h.status = 'ACTIVE'
  } else {
    h.errorCount += 1
    h.lastError = outcome.error
    h.status = 'ERROR'
  }
}

// for testing only
export function _resetSkillRegistry(): void {
  definitions.clear()
  currentVersion.clear()
  health.clear()
}
