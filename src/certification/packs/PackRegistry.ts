import logger from '../../logger'
import { eventBus, AuditService } from '../../core'
import type { RulePack, PackUsageStat, RuleCoverage } from '../types'

// ─── In-memory pack registry ──────────────────────────────────────────────────

const registry    = new Map<string, RulePack>()
const packUsage   = new Map<string, Set<string>>()   // packId → Set<profileId>

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPack(pack: RulePack): void {
  if (registry.has(pack.id)) {
    throw new Error(`RulePack "${pack.id}" is already registered`)
  }
  registry.set(pack.id, pack)

  eventBus.publish('RulePackRegistered' as any, {
    packId: pack.id, ruleCount: pack.rules.length, version: pack.version,
  }, 'certification')

  AuditService.createAudit({
    module:      'certification',
    entity:      'RulePack',
    entityId:    pack.id,
    action:      'PACK_REGISTERED',
    performedBy: 'system',
    metadata:    { name: pack.name, version: pack.version, ruleCount: pack.rules.length, tags: pack.tags },
  }).catch(err => logger.warn({ msg: '[PackRegistry] audit write failed', err }))
}

export function updatePack(id: string, patch: Partial<Omit<RulePack, 'id'>>): void {
  const existing = getPack(id)
  const updated  = { ...existing, ...patch, id }
  registry.set(id, updated)

  eventBus.publish('RulePackUpdated' as any, { packId: id }, 'certification')
  AuditService.createAudit({
    module: 'certification', entity: 'RulePack', entityId: id,
    action: 'PACK_UPDATED', performedBy: 'system', metadata: { patch },
  }).catch(() => {})
}

export function removePack(id: string): void {
  if (!registry.has(id)) return
  registry.delete(id)
  packUsage.delete(id)

  eventBus.publish('RulePackRemoved' as any, { packId: id }, 'certification')
  AuditService.createAudit({
    module: 'certification', entity: 'RulePack', entityId: id,
    action: 'PACK_REMOVED', performedBy: 'system', metadata: {},
  }).catch(() => {})
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getPack(id: string): RulePack {
  const p = registry.get(id)
  if (!p) throw new Error(`RulePack "${id}" not found`)
  return p
}

export function getAllPacks(): RulePack[] {
  return Array.from(registry.values())
}

export function hasPack(id: string): boolean {
  return registry.has(id)
}

// ─── Dependency resolution ────────────────────────────────────────────────────
//
// Returns a topologically sorted list of pack IDs (dependencies first).
// Deduplicates automatically — each pack appears only once.
// Throws on circular dependency.

export function resolveDependencies(packIds: string[]): string[] {
  const sorted   = new Array<string>()
  const visited  = new Set<string>()
  const visiting = new Set<string>()     // cycle detection

  function visit(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected: pack "${id}" references itself`)
    }

    visiting.add(id)
    const pack = getPack(id)

    for (const depId of pack.dependencies) {
      visit(depId)
    }

    visiting.delete(id)
    visited.add(id)
    sorted.push(id)
  }

  for (const id of packIds) visit(id)

  return sorted
}

// ─── Usage tracking ───────────────────────────────────────────────────────────

export function recordPackUsage(packId: string, profileId: string): void {
  if (!packUsage.has(packId)) packUsage.set(packId, new Set())
  packUsage.get(packId)!.add(profileId)
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function getPackUsage(): PackUsageStat[] {
  return Array.from(registry.values()).map(pack => ({
    packId:    pack.id,
    packName:  pack.name,
    profiles:  Array.from(packUsage.get(pack.id) ?? []),
    ruleCount: pack.rules.length,
  }))
}

export function getProfilesUsingPack(packId: string): string[] {
  return Array.from(packUsage.get(packId) ?? [])
}

export function getUnusedPacks(): RulePack[] {
  return Array.from(registry.values()).filter(
    p => !packUsage.has(p.id) || packUsage.get(p.id)!.size === 0,
  )
}

export function getRuleCoverage(): RuleCoverage {
  const byPack:    Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  let totalRules = 0

  for (const pack of registry.values()) {
    byPack[pack.id] = pack.rules.length
    totalRules += pack.rules.length
    for (const rule of pack.rules) {
      byCategory[rule.category] = (byCategory[rule.category] ?? 0) + 1
    }
  }

  return { totalRules, totalPacks: registry.size, byPack, byCategory }
}

// ─── Testing helper ───────────────────────────────────────────────────────────

export function _reset(): void {
  registry.clear()
  packUsage.clear()
}
