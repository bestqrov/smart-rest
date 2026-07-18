// ─── Billing Subscriptions — Service (Sprint K2: DB-backed) ──────────────

import * as Repo       from './SubscriptionRepository'
import * as Lifecycle  from './SubscriptionLifecycle'
import * as Validation from './SubscriptionValidation'
import * as Events     from './SubscriptionEvents'
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
  await audit('CREATE_ACTIVE', sub.id, by, { planCode: plan.code })
  return sub
}

// ─── Lifecycle transitions ────────────────────────────────────────────────────

export async function activate(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.activate(sub, by)
  await audit('ACTIVATE', id, by)
  return updated
}

export async function renew(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.renew(sub, by)
  await audit('RENEW', id, by)
  return updated
}

export async function suspend(id: string, reason: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.suspend(sub, reason)
  await audit('SUSPEND', id, by, { reason })
  return updated
}

export async function enterGracePeriod(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.enterGracePeriod(sub)
  await audit('ENTER_GRACE_PERIOD', id, by)
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

// ─── Access control (Tenant Access Migration, Phase 1) ─────────────────────
// BillingSubscription is becoming the authority for platform access. This is
// an ADDITIVE gate for now — see isCafeAccessAllowed below, which combines it
// with the existing Cafe.isActive check rather than replacing it. Phase 2
// will migrate the remaining Cafe.isActive/billingStatus write sites and
// eventually retire those fields; see docs/architecture/billing-platform.md
// § Access Control (Phase 1) and § Phase 2 (not yet built).

const ACCESS_ALLOWED_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'GRACE_PERIOD']

// SECURITY: fail-open by design. A tenant with no BillingSubscription row at
// all (pre-backfill, or a race right after CafeCreated) is NOT blocked — see
// docs/architecture/billing-platform.md § Access Control (Phase 1) for why
// this default was chosen (nothing should lock a tenant out until the
// backfill has actually run and been verified). A tenant whose latest row IS
// terminal (CANCELLED/EXPIRED) is correctly blocked, which is why this uses
// findLatestByTenant (sees terminal rows) and not findActiveByTenant (which
// would silently treat a cancelled tenant the same as a never-provisioned one).
export async function isAccessAllowed(tenantId: string): Promise<boolean> {
  const sub = await Repo.findLatestByTenant(tenantId)
  if (!sub) return true
  return ACCESS_ALLOWED_STATUSES.includes(sub.status)
}

// Combines the new BillingSubscription gate with the existing Cafe.isActive
// gate: blocked if EITHER says blocked. cafeIsActive is a required argument
// (not re-fetched here) so callers can't accidentally drop the existing
// check when adding this one. Before backfill has run for a given tenant,
// this degrades to today's exact behavior (cafeIsActive alone), since
// isAccessAllowed fails open on a missing row.
export async function isCafeAccessAllowed(cafeId: string, cafeIsActive: boolean): Promise<boolean> {
  if (!cafeIsActive) return false
  return isAccessAllowed(cafeId)
}
