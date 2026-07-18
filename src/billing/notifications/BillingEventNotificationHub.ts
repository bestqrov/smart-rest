// ─── Billing Event Notification Hub ────────────────────────────────────────
// Single source of truth for billing/subscription notifications: subscribes
// to platform events and notifies via NotificationService only. Domain code
// (e.g. SubscriptionService) must emit events, not call NotificationService
// directly, so each lifecycle event produces exactly one notification here.

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

    // Sprint K2 subscription lifecycle events — single source of truth for
    // subscription notifications (do not duplicate these in SubscriptionService).
    eventBus.subscribe('SubscriptionActivated', async (event: any) => {
      const { tenantId, subscriptionId, planName } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'SUCCESS', title: 'تم تفعيل الاشتراك',
        message: `مرحباً! تم تفعيل اشتراكك في خطة ${planName ?? ''} بنجاح.`,
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('SubscriptionRenewed', async (event: any) => {
      const { tenantId, subscriptionId, planName } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'SUCCESS', title: 'تم تجديد الاشتراك',
        message: `تم تجديد اشتراكك في خطة ${planName ?? ''} بنجاح.`,
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('SubscriptionSuspended', async (event: any) => {
      const { tenantId, subscriptionId, reason } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'ERROR', title: 'تم تعليق اشتراكك',
        message: reason
          ? `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.`
          : 'تم تعليق اشتراكك. تواصل مع الدعم لإعادة التفعيل.',
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('SubscriptionCancelled', async (event: any) => {
      const { tenantId, subscriptionId } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'INFO', title: 'تم إلغاء الاشتراك',
        message: 'تم إلغاء اشتراكك. يمكنك إعادة الاشتراك في أي وقت.',
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('SubscriptionExpired', async (event: any) => {
      const { tenantId, subscriptionId, planName } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'ERROR', title: 'انتهى الاشتراك',
        message: `انتهت صلاحية اشتراكك${planName ? ` في خطة ${planName}` : ''}. جدّد الآن لمواصلة الاستخدام.`,
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })

    eventBus.subscribe('PlanChanged', async (event: any) => {
      const { tenantId, subscriptionId, planName, previousPlanCode } = event.payload as Record<string, any>
      if (!tenantId) return
      await NotificationService.createNotification({
        level: 'INFO', title: 'تم تغيير الخطة',
        message: `تم تغيير خطتك${previousPlanCode ? ` من ${previousPlanCode}` : ''} إلى ${planName ?? ''}.`,
        module: 'BILLING', targetId: tenantId, entityId: subscriptionId,
      }).catch(() => undefined)
    })
  }).catch(() => undefined)
}
