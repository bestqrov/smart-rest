// ─── Billing Subscriptions — Lifecycle State Machine ──────────────────────

import * as Repo       from './SubscriptionRepository'
import * as Validation from './SubscriptionValidation'
import * as Events     from './SubscriptionEvents'
import type { BillingSubscription, SubscriptionStatus } from './SubscriptionTypes'

// Helper: add months to a date
function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export async function activate(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'ACTIVE')
  const renewalDate = addMonths(new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status: 'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionActivated(updated)
  return updated
}

export async function renew(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertNotTerminal(sub)
  const renewalDate = addMonths(sub.renewalDate ?? new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status:      'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionRenewed(updated)
  return updated
}

// TODO(scheduler-sprint): not called anywhere yet — automatic TRIAL/ACTIVE → GRACE_PERIOD
// transition is intentionally deferred to a future Infrastructure/Scheduler sprint. See
// docs/architecture/billing-platform.md § Subscription Engine → Deferred Automatic Lifecycle.
export async function enterGracePeriod(sub: BillingSubscription, graceDays = 7): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'GRACE_PERIOD')
  const graceEndsAt = new Date()
  graceEndsAt.setDate(graceEndsAt.getDate() + graceDays)
  const updated = await Repo.update(sub.id, { status: 'GRACE_PERIOD', graceEndsAt })
  return updated
}

export async function suspend(sub: BillingSubscription, reason: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'SUSPENDED')
  const updated = await Repo.update(sub.id, { status: 'SUSPENDED' })
  Events.emitSubscriptionSuspended(updated, reason)
  return updated
}

export async function resume(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'ACTIVE')
  const renewalDate = addMonths(new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status: 'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionActivated(updated)
  return updated
}

export async function cancel(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'CANCELLED')
  const updated = await Repo.update(sub.id, {
    status:      'CANCELLED',
    cancelledAt: new Date(),
  })
  Events.emitSubscriptionCancelled(updated)
  return updated
}

// TODO(scheduler-sprint): not called anywhere yet — automatic GRACE_PERIOD → EXPIRED
// transition (or direct expiry on renewalDate/trialEndsAt lapse) is intentionally deferred
// to a future Infrastructure/Scheduler sprint. See
// docs/architecture/billing-platform.md § Subscription Engine → Deferred Automatic Lifecycle.
export async function expire(sub: BillingSubscription): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'EXPIRED')
  const updated = await Repo.update(sub.id, {
    status:     'EXPIRED',
    cancelledAt: new Date(),
  })
  Events.emitSubscriptionExpired(updated)
  return updated
}

export async function changePlan(
  sub:         BillingSubscription,
  newPlanId:   string,
  newPlanCode: string,
  newPlanName: string,
  by:          string,
): Promise<BillingSubscription> {
  Validation.assertNotTerminal(sub)
  const previousCode = sub.planCode
  const updated = await Repo.update(sub.id, {
    planId:   newPlanId,
    planCode: newPlanCode,
    planName: newPlanName,
  })
  Events.emitPlanChanged(updated, previousCode)
  return updated
}
