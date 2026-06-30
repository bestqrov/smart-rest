// ─── Billing Subscriptions — Notifications ────────────────────────────────

import { NotificationService } from '../../core'

export async function notifyTrialEnding(tenantId: string, daysLeft: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'WARNING',
    title:    daysLeft <= 1 ? 'تنتهي فترة التجربة غداً' : `تنتهي فترة التجربة خلال ${daysLeft} أيام`,
    message:  'قم بترقية خطتك لمواصلة الاستخدام دون انقطاع.',
    module:   'BILLING',
    targetId: tenantId,
  })
}

export async function notifyActivated(tenantId: string, planName: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تفعيل الاشتراك',
    message:  `مرحباً! تم تفعيل اشتراكك في خطة ${planName} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { planName },
  })
}

export async function notifySuspended(tenantId: string, reason: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    'تم تعليق اشتراكك',
    message:  `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { reason },
  })
}

export async function notifyRenewed(tenantId: string, planName: string, renewalDate: Date | null): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تجديد الاشتراك',
    message:  `تم تجديد اشتراكك في خطة ${planName} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { planName, renewalDate },
  })
}

export async function notifyCancelled(tenantId: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'INFO',
    title:    'تم إلغاء الاشتراك',
    message:  'تم إلغاء اشتراكك. يمكنك إعادة الاشتراك في أي وقت.',
    module:   'BILLING',
    targetId: tenantId,
  })
}
