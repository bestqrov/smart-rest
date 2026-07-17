// ─── BillingSubscription Scheduler (K48) ───────────────────────────────────
// Automatic lifecycle sweeps for BillingSubscription — trial-ending
// reminders, TRIAL → EXPIRED, ACTIVE → GRACE_PERIOD (on renewal lapse), and
// GRACE_PERIOD → SUSPENDED. This is a real scheduler (not the old
// SubscriptionLifecycleJobs.ts compatibility stub, which has been deleted)
// — every function below calls real SubscriptionService/SubscriptionLifecycle
// transitions, each of which already fires its own event/audit/notification
// via the existing BillingEventNotificationHub. See
// docs/architecture/billing-platform.md § Subscription Engine → Automatic
// Lifecycle Scheduling.
//
// NOTE: GRACE_PERIOD is only reachable from ACTIVE in the state machine's
// VALID_TRANSITIONS table (SubscriptionValidation.ts) — TRIAL can only go to
// ACTIVE/CANCELLED/EXPIRED. An expired trial that was never converted
// therefore goes straight to EXPIRED, not through a grace period.
//
// Phase 1 scope only: no auto-cancel, no payment-triggered auto-renew
// (BillingPaymentService linking exists but isn't wired into this sweep
// yet) — see docs' § Phase 2 (not yet built).

import * as Repo    from '../subscriptions/SubscriptionRepository'
import * as Service from '../subscriptions/SubscriptionService'
import * as Events  from '../subscriptions/SubscriptionEvents'
import logger        from '../../logger'

const SYSTEM_ACTOR = 'system:scheduler'

// ─── 1. Trial ending reminders ─────────────────────────────────────────────
export async function runTrialEndingReminders(warnDays = 3): Promise<number> {
  const candidates = await Repo.findTrialsEndingWithin(warnDays)
  const now = new Date()

  let sent = 0
  for (const sub of candidates) {
    try {
      const daysLeft = Math.max(0, Math.ceil(((sub.trialEndsAt?.getTime() ?? now.getTime()) - now.getTime()) / 86400000))
      Events.emitTrialEnding(sub, daysLeft)
      sent++
    } catch (err: any) {
      logger.warn({ msg: '[BillingScheduler] trial-ending reminder failed', subscriptionId: sub.id, err: err.message })
    }
  }
  return sent
}

// ─── 2. Trial expiration → EXPIRED ─────────────────────────────────────────
// TRIAL can only transition to ACTIVE/CANCELLED/EXPIRED (not GRACE_PERIOD —
// see module header note), so an unconverted trial expires directly.
export async function runTrialExpirationCheck(): Promise<string[]> {
  const expired = await Repo.findExpiredTrials()

  const trialExpired: string[] = []
  for (const sub of expired) {
    try {
      await Service.expire(sub.id)
      trialExpired.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingScheduler] trial expiration skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return trialExpired
}

// ─── 3. Lapsed active subscriptions → GRACE_PERIOD ─────────────────────────
export async function runActiveLapseCheck(): Promise<string[]> {
  const lapsed = await Repo.findLapsedActive()

  const enteredGrace: string[] = []
  for (const sub of lapsed) {
    try {
      await Service.enterGracePeriod(sub.id, SYSTEM_ACTOR)
      enteredGrace.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingScheduler] active-lapse grace-period entry skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return enteredGrace
}

// ─── 4. Grace period expiration → SUSPENDED ────────────────────────────────
export async function runGracePeriodExpirationCheck(): Promise<string[]> {
  const expired = await Repo.findExpiredGracePeriods()

  const suspended: string[] = []
  for (const sub of expired) {
    try {
      await Service.suspend(sub.id, 'Grace period expired', SYSTEM_ACTOR)
      suspended.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingScheduler] grace-period suspend skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return suspended
}

export async function runSubscriptionLifecycleSweep(): Promise<{
  remindersSent: number
  trialExpired:  string[]
  enteredGrace:  string[]
  suspended:     string[]
}> {
  const remindersSent = await runTrialEndingReminders()
  const trialExpired   = await runTrialExpirationCheck()
  const enteredGrace   = await runActiveLapseCheck()
  const suspended      = await runGracePeriodExpirationCheck()
  return { remindersSent, trialExpired, enteredGrace, suspended }
}
