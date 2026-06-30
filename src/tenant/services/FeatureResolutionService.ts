// ─── Tenant Lifecycle Engine — Feature Resolution ────────────────────────────
// Computes the final effective feature set for a tenant.
//
// Resolution order (highest → lowest priority):
//   1. Temporary Promotions (time-limited overrides)
//   2. Tenant Feature Overrides (permanent SA overrides)
//   3. Plan Definition
//   4. Global Feature Flags (from FeatureFlagService)

import type { ResolvedFeatures, Plan, TempPromotion, PlanFeatures, PlanLimits } from '../types'
import { getPlan }                 from '../plans'
import { getProfile }              from '../provisioning/ProvisioningService'
import { FeatureFlagService }      from '../../core'

// ─── Resolve features for a tenant ───────────────────────────────────────────
export async function resolveFeatures(tenantId: string): Promise<ResolvedFeatures> {
  const profile = await getProfile(tenantId)

  const plan:          Plan          = (profile?.plan ?? 'FREE') as Plan
  const state                        = profile?.state ?? 'PENDING'
  const def                          = getPlan(plan)
  const featureOverrides             = profile?.featureOverrides ?? {}
  const allPromos: TempPromotion[]   = profile?.tempPromotions ?? []
  const customLimits                 = profile?.customLimits ?? {}

  // 1. Filter active (non-expired) promotions
  const now          = new Date()
  const activePromos = allPromos.filter(p => new Date(p.expiresAt) > now)

  // 2. Build resolved features from plan
  let resolvedFeatures: PlanFeatures = { ...def.features }
  let resolvedModules: string[]      = [...def.modules]
  let resolvedLimits: PlanLimits     = { ...def.limits, ...customLimits }

  // 3. Apply global feature flags
  // FeatureFlag uses status: 'enabled'|'disabled'|'beta'|'comingSoon'
  try {
    const flags = await FeatureFlagService.getAllFlags()
    for (const flag of flags) {
      const isEnabled = flag.status === 'enabled' || flag.status === 'beta'
      // If a global flag disables marketplace entirely, respect that
      if (flag.key === 'marketplace' && !isEnabled) {
        (resolvedFeatures as any).marketplace = false
      }
    }
  } catch {}

  // 4. Apply tenant-level overrides
  for (const [feature, value] of Object.entries(featureOverrides)) {
    if (feature in resolvedFeatures) {
      (resolvedFeatures as any)[feature] = value
    }
  }

  // 5. Apply temporary promotions (highest priority)
  for (const promo of activePromos) {
    if (promo.feature in resolvedFeatures) {
      (resolvedFeatures as any)[promo.feature] = promo.value
    }
  }

  return {
    modules:      resolvedModules,
    limits:       resolvedLimits,
    features:     resolvedFeatures,
    overrides:    featureOverrides,
    activePromos,
    resolvedAt:   now.toISOString(),
    plan,
    state:        state as any,
  }
}

// ─── Check if a specific feature is available ─────────────────────────────────
export async function isFeatureAvailable(
  tenantId: string,
  feature:  keyof PlanFeatures,
): Promise<boolean> {
  const resolved = await resolveFeatures(tenantId)
  return resolved.features[feature] ?? false
}

// ─── Check if a module is accessible ─────────────────────────────────────────
export async function isModuleAccessible(tenantId: string, module: string): Promise<boolean> {
  const resolved = await resolveFeatures(tenantId)
  return resolved.modules.includes('ALL') || resolved.modules.includes(module)
}

// ─── Check if tenant can perform an action (state-aware) ─────────────────────
export async function canPerformAction(
  tenantId: string,
  action: 'read' | 'write' | 'marketplace' | 'automation',
): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getProfile(tenantId)
  if (!profile) return { allowed: false, reason: 'Tenant not found' }

  const { state } = profile

  if (state === 'ARCHIVED' || state === 'CANCELLED') {
    return { allowed: false, reason: `Tenant is ${state}` }
  }

  if (state === 'SUSPENDED') {
    if (action === 'read') return { allowed: false, reason: 'Suspended: read disabled' }
    return { allowed: false, reason: `Suspended: ${profile.suspensionReason ?? 'unknown reason'}` }
  }

  if (state === 'GRACE_PERIOD') {
    if (action === 'read') return { allowed: true }
    if (action === 'write') return { allowed: false, reason: 'Grace period: write disabled' }
    if (action === 'marketplace') return { allowed: false, reason: 'Grace period: marketplace disabled' }
    if (action === 'automation') return { allowed: false, reason: 'Grace period: automation disabled' }
  }

  // PENDING, TRIAL, ACTIVE — check features
  if (action === 'marketplace') {
    const ok = await isFeatureAvailable(tenantId, 'marketplace')
    return ok ? { allowed: true } : { allowed: false, reason: 'Marketplace not in current plan' }
  }
  if (action === 'automation') {
    const ok = await isFeatureAvailable(tenantId, 'automation')
    return ok ? { allowed: true } : { allowed: false, reason: 'Automation not in current plan' }
  }

  return { allowed: true }
}
