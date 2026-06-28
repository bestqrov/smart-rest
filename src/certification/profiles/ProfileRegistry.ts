import logger from '../../logger'
import { eventBus, AuditService } from '../../core'
import { getPack, resolveDependencies, recordPackUsage } from '../packs/PackRegistry'
import { registerRules } from '../rules/RuleRegistry'
import type { ProfileDefinition, ProfileConfig, RuleEvaluatorMap } from '../types'

// ─── In-memory profile registry ───────────────────────────────────────────────

const registry = new Map<string, ProfileDefinition>()

// ─── Profile creation from pack config ───────────────────────────────────────
//
// Resolves pack dependencies, merges evaluators, returns a ProfileDefinition
// ready to be passed to registerProfile().

export function createProfile(config: ProfileConfig): ProfileDefinition {
  const resolvedPackIds = resolveDependencies(config.packs)
  const ruleEvaluators: RuleEvaluatorMap = {}

  for (const packId of resolvedPackIds) {
    const pack = getPack(packId)
    if (!pack.enabled) continue
    // Later packs (higher in the config.packs list after dep resolution) win on conflict
    Object.assign(ruleEvaluators, pack.evaluators)
  }

  // Profile-level overrides take final priority
  if (config.evaluatorOverrides) {
    Object.assign(ruleEvaluators, config.evaluatorOverrides)
  }

  return {
    id:                config.id,
    name:              config.name,
    description:       config.description,
    version:           config.version,
    enabled:           config.enabled,
    certificateLevels: config.certificateLevels,
    validityDays:      config.validityDays,
    dataFetcher:       config.dataFetcher,
    ruleEvaluators,
    resolvedPacks:     resolvedPackIds,
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerProfile(profile: ProfileDefinition): void {
  if (registry.has(profile.id)) {
    throw new Error(`CertificationProfile "${profile.id}" is already registered`)
  }

  // Bind pack rules to this profile and register them
  for (const packId of profile.resolvedPacks ?? []) {
    const pack = getPack(packId)
    if (!pack.enabled || pack.rules.length === 0) continue

    const boundRules = pack.rules.map(r => ({ ...r, profile: profile.id }))
    registerRules(boundRules)
    recordPackUsage(packId, profile.id)
  }

  registry.set(profile.id, profile)

  eventBus.publish('ProfileUpdated' as any, {
    profileId: profile.id, version: profile.version, packs: profile.resolvedPacks ?? [],
  }, 'certification')

  AuditService.createAudit({
    module:      'certification',
    entity:      'CertificationProfile',
    entityId:    profile.id,
    action:      'PROFILE_REGISTERED',
    performedBy: 'system',
    metadata:    { version: profile.version, packs: profile.resolvedPacks ?? [] },
  }).catch(err => logger.warn({ msg: '[ProfileRegistry] audit failed', err }))
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

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

// ─── Testing helper ───────────────────────────────────────────────────────────

export function _reset(): void {
  registry.clear()
}
