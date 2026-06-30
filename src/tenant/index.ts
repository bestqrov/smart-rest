// ─── Tenant Lifecycle Engine — Public API ────────────────────────────────────
// Platform-wide. No Restaurant logic. Reusable by any SaaS module.

// Types
export * from './types'

// Plan definitions
export { PLAN_DEFINITIONS, getPlan, listPlans, PLAN_NAMES } from './plans'

// Provisioning
export {
  provision,
  getProfile,
  ensureProfile,
  listProfiles,
} from './provisioning/ProvisioningService'

// Lifecycle transitions
export {
  activate,
  startTrial,
  assignPlan,
  enterGracePeriod,
  cancel,
  archive,
  setFeatureOverride,
  addPromotion,
} from './lifecycle/LifecycleService'

// Suspension
export {
  suspend,
  reactivate,
  getSuspensionLogs,
} from './suspension/SuspensionService'

// Usage
export {
  increment,
  syncCounts,
  getUsageSummary,
  checkLimit,
  getUsageHistory,
} from './usage/UsageService'

// Feature resolution
export {
  resolveFeatures,
  isFeatureAvailable,
  isModuleAccessible,
  canPerformAction,
} from './services/FeatureResolutionService'

// Activation / cron helpers
export {
  notifyExpiringTrials,
  expireTrials,
  expireGracePeriods,
  cleanupExpiredPromotions,
} from './activation/ActivationService'

// ─── Engine Init ──────────────────────────────────────────────────────────────
// Called once at server startup.
// Sets up any subscriptions; schedules are handled by the nightly cron.

export async function initTenantEngine(): Promise<void> {
  try {
    const { eventBus } = await import('../core')

    // Auto-provision a TenantProfile when a new Cafe (restaurant) is created
    // This ensures every tenant has a profile from day one.
    eventBus.subscribe('CafeCreated', async (event: any) => {
      try {
        const { cafeId, language, currency, country } = event.payload as Record<string, any>
        if (!cafeId) return
        const { provision } = await import('./provisioning/ProvisioningService')
        await provision({
          tenantId:        String(cafeId),
          tenantType:      'RESTAURANT',
          startTrial:      true,
          defaultLanguage: language ?? 'ar',
          defaultCurrency: currency ?? 'MAD',
          country:         country ?? 'MA',
        })
      } catch {}
    })
  } catch {}
}
