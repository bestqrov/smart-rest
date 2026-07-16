// ─── Billing Platform — Subscription Lifecycle Automation ─────────────────
// Trial reminders, expiration, grace-period expiration and auto-renewal.
//
// COMPATIBILITY LAYER (Sprint K2.2): this file preserves the original
// function names/signatures consumed by src/cron/subscriptionLifecycle.ts
// and re-exported from src/billing/index.ts, but delegates every state
// mutation to the new BillingSubscription engine
// (src/billing/subscriptions/SubscriptionService.ts) instead of the old
// TenantProfile-based lifecycle. No TenantProfile fields are read or
// written here anymore.
//
// TODO(scheduler-sprint): this adapter exists only to keep the existing
// cron entry point stable across the K2 migration. A future
// Infrastructure/Scheduler sprint should fold this logic directly into
// src/cron/subscriptionLifecycle.ts (or a dedicated scheduler module) and
// remove this compatibility layer.

import { emitTrialEnding }      from '../events/BillingEvents'
import * as Subscriptions       from '../subscriptions/SubscriptionService'
import { getDefaultAutoRenew }  from '../settings/BillingSettingsService'
import logger                   from '../../logger'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

const DEFAULT_MODULE = 'RESTAURANT'

// ─── 1. Trial ending reminders ─────────────────────────────────────────────
// Warns TRIAL subscriptions within `warnDays` of trialEndsAt. Idempotent: skips
// tenants already warned today (a TRIAL_ENDING event already logged today).
// Notification delivery goes through BillingEventNotificationHub (the single
// source of truth for billing notifications) via the emitted event — this
// function does not call NotificationService directly.
export async function runTrialEndingReminders(warnDays = 3): Promise<number> {
  const prisma     = await getPrisma()
  const now         = new Date()
  const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const candidates  = await Subscriptions.findTrialsEndingWithin(warnDays)

  let sent = 0
  for (const sub of candidates) {
    const alreadyWarned = await (prisma as any).billingEventLog.findFirst({
      where: { tenantId: sub.tenantId, type: 'TRIAL_ENDING', createdAt: { gte: startOfDay } },
    })
    if (alreadyWarned) continue

    const daysLeft = Math.max(0, Math.ceil(((sub.trialEndsAt?.getTime() ?? now.getTime()) - now.getTime()) / 86400000))
    await emitTrialEnding({
      tenantId: sub.tenantId, module: DEFAULT_MODULE, plan: sub.planCode,
      metadata: { subscriptionId: sub.id, daysLeft },
    })
    sent++
  }
  return sent
}

// ─── 2. Subscription expiration ────────────────────────────────────────────
// TRIAL subscriptions whose trial has ended without conversion → EXPIRED.
// Idempotent: once expired the subscription no longer matches status: 'TRIAL'.
export async function runSubscriptionExpirationCheck(): Promise<string[]> {
  const expired = await Subscriptions.findExpiredTrials()

  const cancelled: string[] = []
  for (const sub of expired) {
    try {
      await Subscriptions.expire(sub.id)
      cancelled.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] expiration skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return cancelled
}

// ─── 3. Grace period expiration ────────────────────────────────────────────
// GRACE_PERIOD subscriptions past graceEndsAt → SUSPENDED.
// Idempotent: once suspended the subscription no longer matches status: 'GRACE_PERIOD'.
export async function runGracePeriodExpirationCheck(): Promise<string[]> {
  const expired = await Subscriptions.findExpiredGracePeriods()

  const suspended: string[] = []
  for (const sub of expired) {
    try {
      await Subscriptions.suspend(sub.id, 'Grace period expired', 'system')
      suspended.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] grace-period suspend skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return suspended
}

// ─── 4. Automatic renewal checks ───────────────────────────────────────────
// GRACE_PERIOD / SUSPENDED subscriptions with a recently paid invoice → ACTIVE.
// Skipped entirely when the "billing.default_auto_renew" setting is off.
// Idempotent: once renewed (status ACTIVE) the subscription no longer matches the filter.
export async function runAutomaticRenewalChecks(lookbackHours = 24): Promise<string[]> {
  if (!(await getDefaultAutoRenew())) return []

  const prisma = await getPrisma()
  const since  = new Date(Date.now() - lookbackHours * 3600000)

  const recentlyPaid = await (prisma as any).billingPlatformInvoice.findMany({
    where:  { status: 'PAID', paidAt: { gte: since } },
    select: { tenantId: true },
  })
  const tenantIds = [...new Set(recentlyPaid.map((i: any) => i.tenantId))] as string[]
  if (tenantIds.length === 0) return []

  const pending = await Subscriptions.findRenewalCandidates(tenantIds)

  const renewed: string[] = []
  for (const sub of pending) {
    try {
      await Subscriptions.renew(sub.id, 'system')
      renewed.push(sub.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] auto-renewal skipped', tenantId: sub.tenantId, subscriptionId: sub.id, err: err.message })
    }
  }
  return renewed
}

export async function runSubscriptionLifecycleSweep(): Promise<{
  remindersSent: number
  cancelled:     string[]
  suspended:     string[]
  renewed:       string[]
}> {
  const remindersSent = await runTrialEndingReminders()
  const cancelled       = await runSubscriptionExpirationCheck()
  const suspended       = await runGracePeriodExpirationCheck()
  const renewed         = await runAutomaticRenewalChecks()
  return { remindersSent, cancelled, suspended, renewed }
}
