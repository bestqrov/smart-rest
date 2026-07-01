// ─── Billing Platform — Subscription Lifecycle Automation ─────────────────
// Trial reminders, expiration, grace-period expiration and auto-renewal.
// State mutations go exclusively through SubscriptionService; every action
// is idempotent (re-running a job never double-applies a transition).

import { notifyTrialEnding }                              from '../notifications/BillingNotifications'
import { emitTrialEnding }                                 from '../events/BillingEvents'
import { cancelSubscription, suspendSubscription, renewSubscription } from '../subscriptions/SubscriptionService'
import { getDefaultAutoRenew }                             from '../settings/BillingSettingsService'
import logger                                              from '../../logger'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

const DEFAULT_MODULE = 'RESTAURANT'

// ─── 1. Trial ending reminders ─────────────────────────────────────────────
// Warns TRIAL tenants within `warnDays` of trialEndsAt. Idempotent: skips
// tenants already warned today (a TRIAL_ENDING event already logged today).
export async function runTrialEndingReminders(warnDays = 3): Promise<number> {
  const prisma    = await getPrisma()
  const now       = new Date()
  const threshold = new Date(now.getTime() + warnDays * 86400000)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const candidates = await (prisma as any).tenantProfile.findMany({
    where:  { state: 'TRIAL', trialEndsAt: { gte: now, lte: threshold } },
    select: { tenantId: true, trialEndsAt: true, plan: true },
  })

  let sent = 0
  for (const t of candidates) {
    const alreadyWarned = await (prisma as any).billingEventLog.findFirst({
      where: { tenantId: t.tenantId, type: 'TRIAL_ENDING', createdAt: { gte: startOfDay } },
    })
    if (alreadyWarned) continue

    const daysLeft = Math.max(0, Math.ceil((new Date(t.trialEndsAt).getTime() - now.getTime()) / 86400000))
    await notifyTrialEnding(t.tenantId, daysLeft).catch(() => undefined)
    await emitTrialEnding({ tenantId: t.tenantId, module: DEFAULT_MODULE, plan: t.plan, metadata: { daysLeft } })
    sent++
  }
  return sent
}

// ─── 2. Subscription expiration ────────────────────────────────────────────
// TRIAL tenants whose trial has ended without conversion → cancelled.
// Idempotent: once cancelled the tenant no longer matches state: 'TRIAL'.
export async function runSubscriptionExpirationCheck(module = DEFAULT_MODULE): Promise<string[]> {
  const prisma = await getPrisma()
  const expired = await (prisma as any).tenantProfile.findMany({
    where:  { state: 'TRIAL', trialEndsAt: { lt: new Date() } },
    select: { tenantId: true },
  })

  const cancelled: string[] = []
  for (const t of expired) {
    try {
      await cancelSubscription(t.tenantId, module, 'EXPIRED')
      cancelled.push(t.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] expiration cancel skipped', tenantId: t.tenantId, err: err.message })
    }
  }
  return cancelled
}

// ─── 3. Grace period expiration ────────────────────────────────────────────
// GRACE_PERIOD tenants past gracePeriodEndsAt → suspended.
// Idempotent: once suspended the tenant no longer matches state: 'GRACE_PERIOD'.
export async function runGracePeriodExpirationCheck(module = DEFAULT_MODULE): Promise<string[]> {
  const prisma = await getPrisma()
  const expired = await (prisma as any).tenantProfile.findMany({
    where:  { state: 'GRACE_PERIOD', gracePeriodEndsAt: { lt: new Date() } },
    select: { tenantId: true },
  })

  const suspended: string[] = []
  for (const t of expired) {
    try {
      await suspendSubscription(t.tenantId, module, 'Grace period expired', 'system')
      suspended.push(t.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] grace-period suspend skipped', tenantId: t.tenantId, err: err.message })
    }
  }
  return suspended
}

// ─── 4. Automatic renewal checks ───────────────────────────────────────────
// GRACE_PERIOD / SUSPENDED tenants with a recently paid invoice → reactivated.
// Skipped entirely when the "billing.default_auto_renew" setting is off.
// Idempotent: once renewed (state ACTIVE) the tenant no longer matches the filter.
export async function runAutomaticRenewalChecks(module = DEFAULT_MODULE, lookbackHours = 24): Promise<string[]> {
  if (!(await getDefaultAutoRenew())) return []

  const prisma = await getPrisma()
  const since  = new Date(Date.now() - lookbackHours * 3600000)

  const recentlyPaid = await (prisma as any).billingPlatformInvoice.findMany({
    where:  { status: 'PAID', paidAt: { gte: since } },
    select: { tenantId: true },
  })
  const tenantIds = [...new Set(recentlyPaid.map((i: any) => i.tenantId))]
  if (tenantIds.length === 0) return []

  const pending = await (prisma as any).tenantProfile.findMany({
    where:  { tenantId: { in: tenantIds }, state: { in: ['GRACE_PERIOD', 'SUSPENDED'] } },
    select: { tenantId: true },
  })

  const renewed: string[] = []
  for (const t of pending) {
    try {
      await renewSubscription(t.tenantId, module)
      renewed.push(t.tenantId)
    } catch (err: any) {
      logger.warn({ msg: '[BillingLifecycle] auto-renewal skipped', tenantId: t.tenantId, err: err.message })
    }
  }
  return renewed
}

export async function runSubscriptionLifecycleSweep(module = DEFAULT_MODULE): Promise<{
  remindersSent: number
  cancelled:     string[]
  suspended:     string[]
  renewed:       string[]
}> {
  const remindersSent = await runTrialEndingReminders()
  const cancelled      = await runSubscriptionExpirationCheck(module)
  const suspended      = await runGracePeriodExpirationCheck(module)
  const renewed        = await runAutomaticRenewalChecks(module)
  return { remindersSent, cancelled, suspended, renewed }
}
