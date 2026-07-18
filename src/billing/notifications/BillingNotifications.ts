// ─── Billing Platform — Billing Notifications ─────────────────────────────
// All messages previously hardcoded Arabic regardless of the tenant's own
// language preference — flagged in docs/project/full-product-audit-2026-07-18.md
// Part 1 §7 as a known recurring bug class in this codebase (also seen on
// admin pages that skip one of the 4 supported languages). Fixed by reading
// TenantProfile.defaultLanguage (src/tenant/) and routing every message
// through a 4-language table, matching the T[lang] convention used
// throughout app/admin/**.

import { NotificationService } from '../../core'

type Lang = 'ar' | 'en' | 'fr' | 'es'

async function getLang(tenantId: string): Promise<Lang> {
  try {
    const { getProfile } = await import('../../tenant')
    const profile = await getProfile(tenantId)
    const lang = profile?.defaultLanguage as Lang | undefined
    return lang && ['ar', 'en', 'fr', 'es'].includes(lang) ? lang : 'ar'
  } catch {
    return 'ar'
  }
}

export async function notifyTrialEnding(tenantId: string, daysLeft: number): Promise<void> {
  const lang = await getLang(tenantId)
  const T = {
    ar: {
      title:   daysLeft <= 1 ? 'تنتهي فترة التجربة غداً' : `تنتهي فترة التجربة خلال ${daysLeft} أيام`,
      message: 'قم بترقية خطتك لمواصلة استخدام SmartSuite OS بدون انقطاع.',
    },
    en: {
      title:   daysLeft <= 1 ? 'Your trial ends tomorrow' : `Your trial ends in ${daysLeft} days`,
      message: 'Upgrade your plan to keep using SmartSuite OS without interruption.',
    },
    fr: {
      title:   daysLeft <= 1 ? "Votre essai se termine demain" : `Votre essai se termine dans ${daysLeft} jours`,
      message: 'Passez à un forfait supérieur pour continuer à utiliser SmartSuite OS sans interruption.',
    },
    es: {
      title:   daysLeft <= 1 ? 'Tu prueba termina mañana' : `Tu prueba termina en ${daysLeft} días`,
      message: 'Actualiza tu plan para seguir usando SmartSuite OS sin interrupciones.',
    },
  }[lang]

  await NotificationService.createNotification({
    level:    'WARNING',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
  })
}

export async function notifyInvoiceGenerated(tenantId: string, invoiceNumber: string, total: number, currency: string): Promise<void> {
  const lang = await getLang(tenantId)
  const amount = total.toLocaleString()
  const T = {
    ar: { title: `فاتورة جديدة: ${invoiceNumber}`, message: `تم إنشاء فاتورة بمبلغ ${amount} ${currency}. يرجى المراجعة والدفع قبل تاريخ الاستحقاق.` },
    en: { title: `New invoice: ${invoiceNumber}`,   message: `An invoice for ${amount} ${currency} has been generated. Please review and pay before the due date.` },
    fr: { title: `Nouvelle facture : ${invoiceNumber}`, message: `Une facture de ${amount} ${currency} a été générée. Merci de la consulter et de la régler avant l'échéance.` },
    es: { title: `Nueva factura: ${invoiceNumber}`, message: `Se generó una factura por ${amount} ${currency}. Revísala y págala antes de la fecha de vencimiento.` },
  }[lang]

  await NotificationService.createNotification({
    level:    'INFO',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber, total, currency },
  })
}

export async function notifyInvoicePaid(tenantId: string, invoiceNumber: string): Promise<void> {
  const lang = await getLang(tenantId)
  const T = {
    ar: { title: `تم استلام الدفع — ${invoiceNumber}`, message: 'شكراً! تم تأكيد دفع الفاتورة بنجاح.' },
    en: { title: `Payment received — ${invoiceNumber}`, message: 'Thank you! Your invoice payment has been confirmed.' },
    fr: { title: `Paiement reçu — ${invoiceNumber}`, message: 'Merci ! Le paiement de votre facture a été confirmé.' },
    es: { title: `Pago recibido — ${invoiceNumber}`, message: '¡Gracias! El pago de tu factura ha sido confirmado.' },
  }[lang]

  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber },
  })
}

export async function notifyQuotaExceeded(tenantId: string, field: string, current: number, limit: number): Promise<void> {
  const lang = await getLang(tenantId)
  const T = {
    ar: { title: `تجاوزت الحد المسموح: ${field}`, message: `الاستخدام الحالي (${current}) تجاوز الحد المحدد في خطتك (${limit}). قم بالترقية أو تخفيض الاستهلاك.` },
    en: { title: `Quota exceeded: ${field}`, message: `Current usage (${current}) has exceeded your plan's limit (${limit}). Upgrade your plan or reduce usage.` },
    fr: { title: `Quota dépassé : ${field}`, message: `L'utilisation actuelle (${current}) dépasse la limite de votre forfait (${limit}). Passez à un forfait supérieur ou réduisez votre consommation.` },
    es: { title: `Cuota excedida: ${field}`, message: `El uso actual (${current}) superó el límite de tu plan (${limit}). Actualiza tu plan o reduce el consumo.` },
  }[lang]

  await NotificationService.createNotification({
    level:    'ERROR',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { field, current, limit },
  })
}

export async function notifySubscriptionSuspended(tenantId: string, reason: string): Promise<void> {
  const lang = await getLang(tenantId)
  const T = {
    ar: { title: 'تم تعليق الاشتراك', message: `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.` },
    en: { title: 'Subscription suspended', message: `Your subscription has been suspended. Reason: ${reason}. Contact support to reactivate.` },
    fr: { title: 'Abonnement suspendu', message: `Votre abonnement a été suspendu. Raison : ${reason}. Contactez le support pour le réactiver.` },
    es: { title: 'Suscripción suspendida', message: `Tu suscripción ha sido suspendida. Motivo: ${reason}. Contacta con soporte para reactivarla.` },
  }[lang]

  await NotificationService.createNotification({
    level:    'ERROR',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { reason },
  })
}

export async function notifySubscriptionRenewed(tenantId: string, plan: string): Promise<void> {
  const lang = await getLang(tenantId)
  const T = {
    ar: { title: 'تم تجديد الاشتراك', message: `تم تجديد اشتراكك في خطة ${plan} بنجاح.` },
    en: { title: 'Subscription renewed', message: `Your subscription on the ${plan} plan has been renewed successfully.` },
    fr: { title: 'Abonnement renouvelé', message: `Votre abonnement au forfait ${plan} a été renouvelé avec succès.` },
    es: { title: 'Suscripción renovada', message: `Tu suscripción al plan ${plan} se ha renovado correctamente.` },
  }[lang]

  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    T.title,
    message:  T.message,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { plan },
  })
}
