'use client'
/**
 * Wraps admin pages whose feature depends on the subscription plan
 * (lib/gulfPlans.ts, enforced server-side in src/billing/planAccess.ts).
 * Trial / legacy venues have every feature, so this renders children.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { useLang } from './lang-context'

type Feature = 'loyalty' | 'coupons' | 'whatsappMarketing' | 'aiMarketing' | 'multiBranch' | 'onlinePayment' | 'aiVideo'

const PLAN_NAME: Record<string, Record<string, string>> = {
  PRO:        { ar: 'الباقة الاحترافية', fr: 'l’offre Pro', en: 'the Pro plan', es: 'el plan Pro' },
  ENTERPRISE: { ar: 'باقة الأعمال',     fr: 'l’offre Entreprise', en: 'the Enterprise plan', es: 'el plan Empresa' },
}
const FEATURE_NAME: Record<Feature, Record<string, string>> = {
  loyalty:           { ar: 'برنامج الولاء', fr: 'Le programme fidélité', en: 'The loyalty program', es: 'El programa de fidelidad' },
  coupons:           { ar: 'كوبونات الخصم', fr: 'Les codes promo', en: 'Discount coupons', es: 'Los cupones' },
  whatsappMarketing: { ar: 'رسائل واتساب التسويقية', fr: 'Le marketing WhatsApp', en: 'WhatsApp marketing', es: 'El marketing por WhatsApp' },
  aiMarketing:       { ar: 'التسويق بالذكاء الاصطناعي', fr: 'Le marketing IA', en: 'AI marketing', es: 'El marketing con IA' },
  multiBranch:       { ar: 'إدارة الفروع', fr: 'La gestion multi-sites', en: 'Multi-branch management', es: 'La gestión multi-sucursal' },
  onlinePayment:     { ar: 'الدفع الإلكتروني', fr: 'Le paiement en ligne', en: 'Online payment', es: 'El pago en línea' },
  aiVideo:           { ar: 'فيديوهات الذكاء الاصطناعي', fr: 'Les vidéos IA', en: 'AI videos', es: 'Los vídeos con IA' },
}
const T = {
  ar: { avail: (f: string, p: string) => `${f} متاح في ${p}.`, addon: (f: string) => `${f} إضافة مدفوعة (29$ شهرياً — 5 فيديوهات).`, cta: 'عرض الباقات' },
  fr: { avail: (f: string, p: string) => `${f} est inclus dans ${p}.`, addon: (f: string) => `${f} : option payante (29 $/mois — 5 vidéos).`, cta: 'Voir les offres' },
  en: { avail: (f: string, p: string) => `${f} is included in ${p}.`, addon: (f: string) => `${f} is a paid add-on ($29/month — 5 videos).`, cta: 'See plans' },
  es: { avail: (f: string, p: string) => `${f} está incluido en ${p}.`, addon: (f: string) => `${f} es un complemento de pago (29 $/mes — 5 vídeos).`, cta: 'Ver planes' },
} as const

const REQUIRED: Record<Feature, string> = {
  loyalty: 'PRO', coupons: 'PRO', whatsappMarketing: 'PRO', aiMarketing: 'PRO', onlinePayment: 'PRO', multiBranch: 'ENTERPRISE', aiVideo: 'ADDON',
}

export default function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { lang, isRTL } = useLang()
  const L = (lang in T ? lang : 'en') as keyof typeof T
  const [state, setState] = useState<'loading' | 'ok' | 'locked'>('loading')

  useEffect(() => {
    fetch('/api/admin/plan-access', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setState(!d || d.features?.[feature] !== false ? 'ok' : 'locked'))
      .catch(() => setState('ok')) // can't tell — the server still enforces
  }, [feature])

  if (state === 'ok') return <>{children}</>
  if (state === 'loading') return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  const fname = FEATURE_NAME[feature][L] ?? FEATURE_NAME[feature].en
  const req = REQUIRED[feature]
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-lg mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-violet-500" />
        </div>
        <p className="text-base font-bold text-gray-900">
          {req === 'ADDON' ? T[L].addon(fname) : T[L].avail(fname, PLAN_NAME[req][L] ?? PLAN_NAME[req].en)}
        </p>
        <a href="/landing#pricing" target="_blank" rel="noreferrer"
          className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold">
          {T[L].cta}
        </a>
      </div>
    </div>
  )
}
