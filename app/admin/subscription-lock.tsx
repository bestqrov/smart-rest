'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { AdminLang } from './lang-context'

const T: Record<AdminLang, { title: string; body: string; pay: string; contact: string }> = {
  ar: { title: 'لوحة التحكم موقوفة مؤقتاً', body: 'تم إيقاف لوحة التحكم مؤقتاً بسبب فاتورة غير مدفوعة. قائمة الطعام والطلبات لزبائنك ما زالت تعمل.', pay: 'ادفع الفاتورة الآن', contact: 'تواصل مع الدعم لإعادة التفعيل.' },
  fr: { title: 'Tableau de bord suspendu', body: 'Votre tableau de bord est temporairement suspendu en raison d’une facture impayée. Le menu et les commandes de vos clients continuent de fonctionner.', pay: 'Payer la facture', contact: 'Contactez le support pour réactiver.' },
  en: { title: 'Dashboard suspended', body: 'Your dashboard is temporarily suspended because of an unpaid invoice. Your guest menu and orders keep working.', pay: 'Pay the invoice now', contact: 'Contact support to reactivate.' },
  es: { title: 'Panel suspendido', body: 'Tu panel está suspendido temporalmente por una factura impaga. El menú y los pedidos de tus clientes siguen funcionando.', pay: 'Pagar la factura', contact: 'Contacta con soporte para reactivar.' },
}

export default function SubscriptionLock({ lang, payToken }: { lang: AdminLang; payToken: string | null }) {
  const t = T[lang] ?? T.ar
  return (
    <div className="min-h-full flex items-center justify-center p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center">
          <Lock className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
        <p className="text-gray-600 text-sm leading-relaxed">{t.body}</p>
        {payToken
          ? <Link href={`/billing/pay/${payToken}`} className="inline-block w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3">{t.pay}</Link>
          : <p className="text-sm text-gray-500">{t.contact}</p>}
      </div>
    </div>
  )
}
