// ─── Tenant Lifecycle Engine — Suspension ────────────────────────────────────
// Handles all suspension modes. Never deletes data.
// Writes an audit log on every suspend/reactivate.

import type { TenantProfile, SuspendInput } from '../types'
import { parseProfile }                     from '../provisioning/ProvisioningService'
import { eventBus, NotificationService }    from '../../core'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export async function suspend(tenantId: string, input: SuspendInput): Promise<TenantProfile> {
  const prisma = await getPrisma()
  const raw    = await (prisma as any).tenantProfile.findUnique({ where: { tenantId } })
  if (!raw) throw new Error(`Tenant not found: ${tenantId}`)
  if (raw.state === 'ARCHIVED') throw new Error('Archived tenants cannot be suspended')

  // Optionally enter grace period first
  let nextState = 'SUSPENDED'
  let gracePeriodEndsAt: Date | null = null

  if (input.gracePeriodDays && input.gracePeriodDays > 0) {
    nextState = 'GRACE_PERIOD'
    gracePeriodEndsAt = new Date(Date.now() + input.gracePeriodDays * 86400000)
  }

  const updated = await (prisma as any).tenantProfile.update({
    where: { tenantId },
    data: {
      state:            nextState,
      suspendedAt:      nextState === 'SUSPENDED' ? new Date() : raw.suspendedAt,
      suspensionType:   input.type,
      suspensionReason: input.reason,
      gracePeriodEndsAt,
    },
  })

  // Audit log (non-critical — swallow errors)
  ;(prisma as any).tenantSuspensionLog.create({
    data: {
      tenantId,
      type:        input.type,
      reason:      input.reason,
      suspendedBy: input.suspendedBy ?? 'system',
    },
  }).catch(() => undefined)

  const profile = parseProfile(updated)

  eventBus.publish('TenantSuspended', {
    tenantId,
    type:   input.type,
    reason: input.reason,
    state:  nextState,
  }, 'SuspensionService')

  const suspensionMessages: Record<string, string> = {
    MANUAL:      'تم إيقاف حسابك يدوياً من قِبَل الإدارة.',
    AUTOMATIC:   'تم إيقاف حسابك تلقائياً. يرجى التواصل مع الدعم.',
    BILLING:     'تم إيقاف حسابك بسبب مشكلة في الفاتورة. يرجى تسوية المدفوعات.',
    SECURITY:    'تم إيقاف حسابك لأسباب أمنية. يرجى التواصل مع الدعم.',
    MAINTENANCE: 'حسابك موقف مؤقتاً للصيانة. سيعود قريباً.',
  }

  NotificationService.createNotification({
    level:    'ERROR',
    title:    'تم إيقاف حسابك',
    message:  suspensionMessages[input.type] ?? 'تم إيقاف حسابك.',
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

export async function reactivate(tenantId: string, reactivatedBy?: string): Promise<TenantProfile> {
  const prisma = await getPrisma()
  const raw    = await (prisma as any).tenantProfile.findUnique({ where: { tenantId } })
  if (!raw) throw new Error(`Tenant not found: ${tenantId}`)

  const allowedFrom = ['SUSPENDED', 'GRACE_PERIOD', 'CANCELLED']
  if (!allowedFrom.includes(raw.state)) {
    throw new Error(`Cannot reactivate from state: ${raw.state}`)
  }

  const updated = await (prisma as any).tenantProfile.update({
    where: { tenantId },
    data: {
      state:            'ACTIVE',
      suspendedAt:      null,
      suspensionType:   null,
      suspensionReason: null,
      gracePeriodEndsAt:null,
      activatedAt:      new Date(),
    },
  })

  // Resolve the latest open suspension log (non-critical)
  ;(prisma as any).tenantSuspensionLog.updateMany({
    where: { tenantId, resolvedAt: null },
    data:  { resolvedAt: new Date(), resolvedBy: reactivatedBy ?? 'system' },
  }).catch(() => undefined)

  const profile = parseProfile(updated)

  eventBus.publish('TenantReactivated', { tenantId, reactivatedBy }, 'SuspensionService')

  NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تفعيل حسابك',
    message:  'تم إعادة تفعيل حسابك على SmartSuite OS بنجاح.',
    module:   'TENANT',
    entityId: tenantId,
    targetId: tenantId,
  }).catch(() => undefined)

  return profile
}

export async function getSuspensionLogs(tenantId: string) {
  const prisma = await getPrisma()
  const logs   = await (prisma as any).tenantSuspensionLog.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
  })
  return logs
}
