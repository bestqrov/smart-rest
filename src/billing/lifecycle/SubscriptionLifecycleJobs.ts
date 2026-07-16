// ─── Billing Platform — Legacy Subscription Lifecycle Automation ─────────
//
// DISABLED (Sprint K2.2 → K48 migration). This module previously drove the
// daily subscription-lifecycle cron (trial reminders, expiration,
// grace-period expiration, auto-renewal) against the old TenantProfile-based
// subscription model. That model has been replaced by the new
// BillingSubscription engine (src/billing/subscriptions/SubscriptionService.ts).
//
// Per PM decision: the platform has no production customers yet, so we are
// prioritizing architecture cleanliness over backward compatibility — this
// file is intentionally NOT adapted/shimmed to call the new
// BillingSubscription API. Its cron registration
// (startSubscriptionLifecycleCron() in src/server.ts) is commented out, and
// every function below is a no-op stub kept only so the existing import
// sites (src/cron/subscriptionLifecycle.ts, src/billing/index.ts) keep
// compiling until they're replaced outright.
//
// TODO(K48): Replace legacy TenantProfile scheduler with the new
// BillingSubscription Scheduler.
//
// Manual lifecycle operations (activate/suspend/resume/cancel/renew/
// change-plan) remain fully available in the meantime via
// SubscriptionService and the /api/superadmin/billing/subscriptions/:id/*
// routes — see docs/architecture/billing-platform.md § Subscription Engine
// → Deferred Automatic Lifecycle.

import logger from '../../logger'

function disabledNotice(fn: string) {
  logger.warn({ msg: `[BillingLifecycle] ${fn} is disabled pending K48 (legacy TenantProfile scheduler removed, BillingSubscription Scheduler not yet built)` })
}

export async function runTrialEndingReminders(): Promise<number> {
  disabledNotice('runTrialEndingReminders')
  return 0
}

export async function runSubscriptionExpirationCheck(): Promise<string[]> {
  disabledNotice('runSubscriptionExpirationCheck')
  return []
}

export async function runGracePeriodExpirationCheck(): Promise<string[]> {
  disabledNotice('runGracePeriodExpirationCheck')
  return []
}

export async function runAutomaticRenewalChecks(): Promise<string[]> {
  disabledNotice('runAutomaticRenewalChecks')
  return []
}

export async function runSubscriptionLifecycleSweep(): Promise<{
  remindersSent: number
  cancelled:     string[]
  suspended:     string[]
  renewed:       string[]
}> {
  disabledNotice('runSubscriptionLifecycleSweep')
  return { remindersSent: 0, cancelled: [], suspended: [], renewed: [] }
}
