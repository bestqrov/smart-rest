// ─── Billing Platform — Billing Notifications ─────────────────────────────

import { NotificationService } from '../../core'

export async function notifyTrialEnding(tenantId: string, daysLeft: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'WARNING',
    title:    daysLeft <= 1 ? 'تنتهي فترة التجربة غداً' : `تنتهي فترة التجربة خلال ${daysLeft} أيام`,
    message:  'قم بترقية خطتك لمواصلة استخدام SmartSuite OS بدون انقطاع.',
    module:   'BILLING',
    targetId: tenantId,
  })
}

export async function notifyInvoiceGenerated(tenantId: string, invoiceNumber: string, total: number, currency: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'INFO',
    title:    `فاتورة جديدة: ${invoiceNumber}`,
    message:  `تم إنشاء فاتورة بمبلغ ${total.toLocaleString()} ${currency}. يرجى المراجعة والدفع قبل تاريخ الاستحقاق.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber, total, currency },
  })
}

export async function notifyInvoicePaid(tenantId: string, invoiceNumber: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    `تم استلام الدفع — ${invoiceNumber}`,
    message:  'شكراً! تم تأكيد دفع الفاتورة بنجاح.',
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber },
  })
}

export async function notifyQuotaExceeded(tenantId: string, field: string, current: number, limit: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    `تجاوزت الحد المسموح: ${field}`,
    message:  `الاستخدام الحالي (${current}) تجاوز الحد المحدد في خطتك (${limit}). قم بالترقية أو تخفيض الاستهلاك.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { field, current, limit },
  })
}

export async function notifySubscriptionSuspended(tenantId: string, reason: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    'تم تعليق الاشتراك',
    message:  `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { reason },
  })
}

export async function notifySubscriptionRenewed(tenantId: string, plan: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تجديد الاشتراك',
    message:  `تم تجديد اشتراكك في خطة ${plan} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { plan },
  })
}
