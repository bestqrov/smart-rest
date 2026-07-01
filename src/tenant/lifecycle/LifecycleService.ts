// ─── Tenant Lifecycle Engine — Lifecycle Transitions ─────────────────────────
// Manages all state transitions for a tenant.
// All transitions are validated against the state machine.

import type { TenantProfile, TenantState, Plan, AssignPlanInput } from '../types'
import { parseProfile }           from '../provisioning/ProvisioningService'
import { getPlan }                from '../plans'
import { eventBus, NotificationService } from '../../core'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

// ─── Valid transitions ────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<TenantState, TenantState[]> = {
  PENDING:      ['TRIAL', 'ACTIVE', 'CANCELLED'],
  TRIAL:        ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  ACTIVE:       ['GRACE_PERIOD', 'SUSPENDED', 'CANCELLED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED:    ['ACTIVE', 'CANCELLED', 'ARCHIVED'],
  CANCELLED:    ['ARCHIVED'],
  ARCHIVED:     [],
}

function assertTransition(from: TenantState, to: TenantState) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`)
  }
}

async function rawUpdate(tenantId: string, data: Record<string, any>): Promise<TenantProfile> {
  const prisma = await getPrisma()
  const raw    = await (prisma as any).tenantProfile.update({ where: { tenantId }, data })
  return parseProfile(raw)
}

async function rawGet(tenantId: string): Promise<any> {
  const prisma = await getPrisma()
  const raw    = await (prisma as any).tenantProfile.findUnique({ where: { tenantId } })
  if (!raw) throw new Error(`Tenant not found: ${tenantId}`)
  return raw
}

// ─── Activate ─────────────────────────────────────────────────────────────────
export async function activate(tenantId: string, activatedBy?: string): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  assertTransition(raw.state as TenantState, 'ACTIVE')

  const profile = await rawUpdate(tenantId, {
    state:             'ACTIVE',
    activatedAt:       new Date(),
    suspendedAt:       null,
    suspensionType:    null,
    suspensionReason:  null,
    gracePeriodEndsAt: null,
  })

  eventBus.publish('TenantActivated', { tenantId, activatedBy }, 'TenantLifecycle')

  NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'حسابك نشط الآن',
    message:  'تم تفعيل اشتراكك في SmartSuite OS بنجاح.',
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

// ─── Start Trial ──────────────────────────────────────────────────────────────
export async function startTrial(tenantId: string, plan: Plan = 'STARTER', trialDays?: number): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  assertTransition(raw.state as TenantState, 'TRIAL')

  const def         = getPlan(plan)
  const days        = trialDays ?? def.trialDays
  const trialEndsAt = new Date(Date.now() + days * 86400000)

  const profile = await rawUpdate(tenantId, {
    state: 'TRIAL',
    plan,
    trialEndsAt,
    activatedAt: new Date(),
  })

  eventBus.publish('TenantTrialStarted', { tenantId, plan, trialEndsAt: trialEndsAt.toISOString() }, 'TenantLifecycle')

  NotificationService.createNotification({
    level:    'INFO',
    title:    `تجربة ${days} يوماً مجاناً`,
    message:  `تمت بدء تجربتك المجانية على خطة ${plan}. تنتهي في ${trialEndsAt.toLocaleDateString('ar-MA')}.`,
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

// ─── Assign Plan ──────────────────────────────────────────────────────────────
export async function assignPlan(tenantId: string, input: AssignPlanInput): Promise<TenantProfile> {
  const raw     = await rawGet(tenantId)
  const oldPlan = raw.plan as Plan
  const newPlan = input.plan

  const updateData: Record<string, any> = {
    plan: newPlan,
    customLimits: input.customLimits ? JSON.stringify(input.customLimits) : null,
  }

  const profile = await rawUpdate(tenantId, updateData)

  eventBus.publish('TenantPlanChanged', {
    tenantId, oldPlan, newPlan, changedBy: input.changedBy,
  }, 'TenantLifecycle')

  const upgraded = ['FREE','STARTER','PROFESSIONAL','ENTERPRISE'].indexOf(newPlan) >
                   ['FREE','STARTER','PROFESSIONAL','ENTERPRISE'].indexOf(oldPlan)

  NotificationService.createNotification({
    level:    upgraded ? 'SUCCESS' : 'INFO',
    title:    upgraded ? 'تمت ترقية خطتك' : 'تغيير خطة الاشتراك',
    message:  `تحولت من ${oldPlan} إلى ${newPlan}.`,
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

// ─── Grace Period ─────────────────────────────────────────────────────────────
export async function enterGracePeriod(tenantId: string, durationDays = 7): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  assertTransition(raw.state as TenantState, 'GRACE_PERIOD')

  const gracePeriodEndsAt = new Date(Date.now() + durationDays * 86400000)

  const profile = await rawUpdate(tenantId, {
    state: 'GRACE_PERIOD',
    gracePeriodEndsAt,
  })

  eventBus.publish('TenantGracePeriodStarted', {
    tenantId, gracePeriodEndsAt: gracePeriodEndsAt.toISOString(), durationDays,
  }, 'TenantLifecycle')

  NotificationService.createNotification({
    level:    'WARNING',
    title:    'فترة السماح',
    message:  `حسابك في فترة سماح. تنتهي في ${gracePeriodEndsAt.toLocaleDateString('ar-MA')}. يرجى تجديد اشتراكك لتجنب الإيقاف.`,
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function cancel(tenantId: string, _cancelledBy?: string): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  assertTransition(raw.state as TenantState, 'CANCELLED')

  return rawUpdate(tenantId, { state: 'CANCELLED', cancelledAt: new Date() })
}

// ─── Archive ──────────────────────────────────────────────────────────────────
export async function archive(tenantId: string, archivedBy?: string): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  assertTransition(raw.state as TenantState, 'ARCHIVED')

  const profile = await rawUpdate(tenantId, { state: 'ARCHIVED', archivedAt: new Date() })

  eventBus.publish('TenantArchived', { tenantId, archivedBy }, 'TenantLifecycle')

  return profile
}

// ─── Set Feature Override ─────────────────────────────────────────────────────
export async function setFeatureOverride(
  tenantId: string,
  feature: string,
  value: boolean,
): Promise<TenantProfile> {
  const raw = await rawGet(tenantId)
  const overrides = raw.featureOverrides ? JSON.parse(raw.featureOverrides) : {}
  overrides[feature] = value
  return rawUpdate(tenantId, { featureOverrides: JSON.stringify(overrides) })
}

// ─── Add Temporary Promotion ──────────────────────────────────────────────────
export async function addPromotion(
  tenantId:  string,
  feature:   string,
  value:     boolean,
  expiresAt: Date,
  reason:    string,
): Promise<TenantProfile> {
  const raw    = await rawGet(tenantId)
  const promos = raw.tempPromotions ? JSON.parse(raw.tempPromotions) : []
  promos.push({ id: Date.now().toString(), feature, value, expiresAt: expiresAt.toISOString(), reason })
  return rawUpdate(tenantId, { tempPromotions: JSON.stringify(promos) })
}
