// ─── Tenant Lifecycle Engine — Activation ────────────────────────────────────
// Handles trial expiration checks and grace period promotion.
// Called by the nightly cron to process expired trials.

import type { TenantProfile } from '../types'
import { parseProfile }        from '../provisioning/ProvisioningService'
import { NotificationService } from '../../core'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

// Check for trials expiring within `warnDays` days and send notifications
export async function notifyExpiringTrials(warnDays = 3): Promise<number> {
  const prisma     = await getPrisma()
  const threshold  = new Date(Date.now() + warnDays * 86400000)
  const expiring   = await (prisma as any).tenantProfile.findMany({
    where: { state: 'TRIAL', trialEndsAt: { lte: threshold, gte: new Date() } },
    select: { tenantId: true, trialEndsAt: true, plan: true },
  })

  for (const t of expiring) {
    const daysLeft = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000)
    NotificationService.createNotification({
      level:    'WARNING',
      title:    `تجربتك تنتهي خلال ${daysLeft} أيام`,
      message:  `ستنتهي تجربتك المجانية على خطة ${t.plan} خلال ${daysLeft} أيام. قم بترقية اشتراكك الآن.`,
      module:   'TENANT',
      entityId: t.tenantId,
      targetId: t.tenantId,
    }).catch(() => undefined)
  }

  return expiring.length
}

// Expire trials that have passed their end date → enter grace period
export async function expireTrials(gracePeriodDays = 7): Promise<TenantProfile[]> {
  const prisma  = await getPrisma()
  const expired = await (prisma as any).tenantProfile.findMany({
    where: { state: 'TRIAL', trialEndsAt: { lt: new Date() } },
  })

  const results: TenantProfile[] = []
  for (const raw of expired) {
    const gracePeriodEndsAt = new Date(Date.now() + gracePeriodDays * 86400000)
    const updated = await (prisma as any).tenantProfile.update({
      where: { id: raw.id },
      data:  { state: 'GRACE_PERIOD', gracePeriodEndsAt },
    })
    results.push(parseProfile(updated))

    NotificationService.createNotification({
      level:    'WARNING',
      title:    'انتهت تجربتك المجانية',
      message:  `دخل حسابك فترة سماح لمدة ${gracePeriodDays} أيام. قم بترقية اشتراكك لتفادي الإيقاف.`,
      module:   'TENANT',
      entityId: raw.tenantId,
      targetId: raw.tenantId,
    }).catch(() => undefined)
  }

  return results
}

// Expire grace periods that have passed → suspend
export async function expireGracePeriods(): Promise<TenantProfile[]> {
  const prisma  = await getPrisma()
  const expired = await (prisma as any).tenantProfile.findMany({
    where: { state: 'GRACE_PERIOD', gracePeriodEndsAt: { lt: new Date() } },
  })

  const results: TenantProfile[] = []
  for (const raw of expired) {
    const updated = await (prisma as any).tenantProfile.update({
      where: { id: raw.id },
      data:  {
        state:            'SUSPENDED',
        suspendedAt:      new Date(),
        suspensionType:   'AUTOMATIC',
        suspensionReason: 'Grace period expired',
        gracePeriodEndsAt:null,
      },
    })
    results.push(parseProfile(updated))

    NotificationService.createNotification({
      level:    'ERROR',
      title:    'تم إيقاف حسابك',
      message:  'انتهت فترة السماح. تم إيقاف حسابك. تواصل مع الدعم لإعادة التفعيل.',
      module:   'TENANT',
      entityId: raw.tenantId,
      targetId: raw.tenantId,
    }).catch(() => undefined)
  }

  return results
}

// Clean up expired temporary promotions
export async function cleanupExpiredPromotions(): Promise<number> {
  const prisma  = await getPrisma()
  const now     = new Date().toISOString()
  const tenants = await (prisma as any).tenantProfile.findMany({
    where:  { tempPromotions: { not: null } },
    select: { id: true, tenantId: true, tempPromotions: true },
  })

  let count = 0
  for (const t of tenants) {
    try {
      const promos    = JSON.parse(t.tempPromotions)
      const filtered  = promos.filter((p: any) => p.expiresAt > now)
      if (filtered.length !== promos.length) {
        await (prisma as any).tenantProfile.update({
          where: { id: t.id },
          data:  { tempPromotions: filtered.length > 0 ? JSON.stringify(filtered) : null },
        })
        count += promos.length - filtered.length
      }
    } catch {}
  }

  return count
}
