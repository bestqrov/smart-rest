// ─── Billing Event Notification Hub ────────────────────────────────────────
// Subscribes to platform events and notifies via NotificationService only.

export function initBillingEventNotifications(): void {
  import('../../core').then(({ eventBus, NotificationService }) => {
    eventBus.subscribe('SubscriptionCreated', async (event: any) => {
      const { tenantId, subscriptionId, planCode } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'INFO', title: 'تم إنشاء الاشتراك',
        message: `تم إنشاء اشتراك جديد (${planCode ?? ''}).`,
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('PaymentSucceeded', async (event: any) => {
      const { tenantId, txId, amount, currency } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'SUCCESS', title: 'تم الدفع بنجاح',
        message: `تم استلام دفعة بمبلغ ${amount ?? ''} ${currency ?? ''}.`,
        module: 'BILLING', targetId: tenantId, entityId: txId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('PaymentFailed', async (event: any) => {
      const { tenantId, txId, reason } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'ERROR', title: 'فشل الدفع',
        message: reason ? `فشلت عملية الدفع: ${reason}` : 'فشلت عملية الدفع.',
        module: 'BILLING', targetId: tenantId, entityId: txId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('TrialEnding', async (event: any) => {
      const { tenantId, subscriptionId, daysLeft } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'WARNING', title: 'اقتراب انتهاء الاشتراك',
        message: daysLeft != null
          ? `ينتهي اشتراكك خلال ${daysLeft} أيام.`
          : 'اشتراكك على وشك الانتهاء.',
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })
  }).catch(() => undefined)
}
