// ─── Billing Subscriptions — Service (Sprint K2: DB-backed) ──────────────

import * as Repo       from './SubscriptionRepository'
import * as Lifecycle  from './SubscriptionLifecycle'
import * as Validation from './SubscriptionValidation'
import * as Events     from './SubscriptionEvents'
import * as Notifs     from './SubscriptionNotifications'
import { AuditService } from '../../core'
import type { BillingSubscription, SubscriptionWithPlan, SubscriptionStatus } from './SubscriptionTypes'

async function getPlan(planId: string) {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingPlan.findUnique({ where: { id: planId } }).catch(() => null)
}

async function audit(action: string, entityId: string, by: string, meta?: Record<string, unknown>) {
  await AuditService.createAudit({
    module:      'BILLING_SUBSCRIPTIONS',
    entity:      'BillingSubscription',
    entityId,
    action,
    performedBy: by,
    metadata:    meta,
  }).catch(() => undefined)
}

// ─── Create (starts as TRIAL by default) ─────────────────────────────────────

export async function createTrialSubscription(
  tenantId: string,
  planId:   string,
  by:       string,
  opts?: { trialDays?: number; autoRenew?: boolean; notes?: string },
): Promise<BillingSubscription> {
  await Validation.assertOneActivePerTenant(tenantId)
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')

  const now        = new Date()
  const trialDays  = opts?.trialDays ?? 14
  const trialEndsAt = new Date(now)
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

  const sub = await Repo.create({
    tenantId, planId, planCode: plan.code, planName: plan.name,
    status:      'TRIAL',
    startDate:   now,
    trialEndsAt,
    autoRenew:   opts?.autoRenew ?? true,
    notes:       opts?.notes,
  })
  Events.emitSubscriptionCreated(sub)
  await audit('CREATE_TRIAL', sub.id, by, { planCode: plan.code, trialDays })
  return sub
}

export async function createActiveSubscription(
  tenantId: string,
  planId:   string,
  by:       string,
  opts?: { autoRenew?: boolean; notes?: string },
): Promise<BillingSubscription> {
  await Validation.assertOneActivePerTenant(tenantId)
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')

  const now         = new Date()
  const renewalDate = new Date(now)
  renewalDate.setMonth(renewalDate.getMonth() + 1)

  const sub = await Repo.create({
    tenantId, planId, planCode: plan.code, planName: plan.name,
    status:      'ACTIVE',
    startDate:   now,
    renewalDate,
    autoRenew:   opts?.autoRenew ?? true,
    notes:       opts?.notes,
  })
  Events.emitSubscriptionCreated(sub)
  Events.emitSubscriptionActivated(sub)
  await Notifs.notifyActivated(tenantId, plan.name).catch(() => undefined)
  await audit('CREATE_ACTIVE', sub.id, by, { planCode: plan.code })
  return sub
}

// ─── Lifecycle transitions ────────────────────────────────────────────────────

export async function activate(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.activate(sub, by)
  await Notifs.notifyActivated(sub.tenantId, sub.planName).catch(() => undefined)
  await audit('ACTIVATE', id, by)
  return updated
}

export async function renew(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.renew(sub, by)
  await Notifs.notifyRenewed(sub.tenantId, sub.planName, updated.renewalDate).catch(() => undefined)
  await audit('RENEW', id, by)
  return updated
}

export async function suspend(id: string, reason: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.suspend(sub, reason)
  await Notifs.notifySuspended(sub.tenantId, reason).catch(() => undefined)
  await audit('SUSPEND', id, by, { reason })
  return updated
}

export async function resume(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.resume(sub, by)
  await audit('RESUME', id, by)
  return updated
}

export async function cancel(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.cancel(sub, by)
  await Notifs.notifyCancelled(sub.tenantId).catch(() => undefined)
  await audit('CANCEL', id, by)
  return updated
}

export async function expire(id: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.expire(sub)
  await audit('EXPIRE', id, 'system')
  return updated
}

export async function changePlan(
  id:      string,
  planId:  string,
  by:      string,
): Promise<BillingSubscription> {
  const sub  = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')
  const updated = await Lifecycle.changePlan(sub, plan.id, plan.code, plan.name, by)
  await audit('CHANGE_PLAN', id, by, { newPlanCode: plan.code, previousPlanCode: sub.planCode })
  return updated
}

export async function updateNotes(id: string, notes: string | null, by: string): Promise<BillingSubscription> {
  const updated = await Repo.update(id, { notes })
  await audit('UPDATE_NOTES', id, by)
  return updated
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSubscription(id: string): Promise<BillingSubscription | null> {
  return Repo.findById(id)
}

export async function getSubscriptionByTenant(tenantId: string): Promise<BillingSubscription | null> {
  return Repo.findActiveByTenant(tenantId)
}

export async function getSubscriptionWithPlan(tenantId: string): Promise<SubscriptionWithPlan | null> {
  const sub = await Repo.findActiveByTenant(tenantId)
  if (!sub) return null
  return Repo.findWithPlan(sub.id)
}

export async function getHistory(tenantId: string): Promise<BillingSubscription[]> {
  return Repo.findAllByTenant(tenantId)
}

export async function listSubscriptions(filter: {
  status?:   SubscriptionStatus
  tenantId?: string
  planCode?: string
  page?:     number
  limit?:    number
}): Promise<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number }> {
  return Repo.findAll(filter)
}
