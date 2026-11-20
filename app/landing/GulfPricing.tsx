'use client'
/**
 * Gulf pricing table — 3 plans, currency switch (USD/SAR/AED/OMR) and
 * monthly / yearly (2 months free). Prices come from lib/gulfPlans.ts.
 * Feature lines list ONLY what the product does today.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { GULF_PLANS, PLAN_CURRENCIES, type PlanCurrency, type PlanId } from '@/lib/gulfPlans'

type Lang = 'ar' | 'en' | 'fr'

const CUR_LABEL: Record<PlanCurrency, Record<Lang, string>> = {
  USD: { ar: '$ دولار', en: 'USD $', fr: 'USD $' },
  SAR: { ar: 'ر.س',    en: 'SAR',   fr: 'SAR' },
  AED: { ar: 'د.إ',    en: 'AED',   fr: 'AED' },
  OMR: { ar: 'ر.ع',    en: 'OMR',   fr: 'OMR' },
}

const T = {
  ar: {
    monthly: 'شهري', yearly: 'سنوي', yearlyBadge: 'شهران مجاناً',
    perMonth: '/ شهرياً', perYear: '/ سنوياً', popular: 'الأكثر طلباً',
    cta: 'ابدأ تجربتك المجانية', ctaEnt: 'تحدّث معنا',
    noSetup: 'بدون رسوم تأسيس · بدون عقد ملزم · ألغِ متى شئت',
    addon: 'إضافة اختيارية لكل الباقات: فيديوهات تسويقية لأطباقك بالذكاء الاصطناعي — 29$ شهرياً (5 فيديوهات)',
    names: { STARTER: 'الأساسية', PRO: 'الاحترافية', ENTERPRISE: 'الأعمال' } as Record<PlanId, string>,
    for: {
      STARTER: 'عربات الطعام والكافيهات الصغيرة والمطاعم الناشئة',
      PRO: 'المطاعم والكافيهات المزدحمة التي تريد أتمتة كاملة',
      ENTERPRISE: 'المطاعم الكبيرة والسلاسل متعددة الفروع',
    } as Record<PlanId, string>,
  },
  en: {
    monthly: 'Monthly', yearly: 'Yearly', yearlyBadge: '2 months free',
    perMonth: '/ month', perYear: '/ year', popular: 'Most popular',
    cta: 'Start free trial', ctaEnt: 'Talk to us',
    noSetup: 'No setup fee · No lock-in contract · Cancel anytime',
    addon: 'Optional add-on for every plan: AI promo videos of your dishes — $29/month (5 videos)',
    names: { STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' } as Record<PlanId, string>,
    for: {
      STARTER: 'Food trucks, small cafés and new restaurants',
      PRO: 'Busy restaurants and cafés that want full automation',
      ENTERPRISE: 'Large restaurants, chains and multi-branch groups',
    } as Record<PlanId, string>,
  },
  fr: {
    monthly: 'Mensuel', yearly: 'Annuel', yearlyBadge: '2 mois offerts',
    perMonth: '/ mois', perYear: '/ an', popular: 'Le plus choisi',
    cta: 'Essai gratuit', ctaEnt: 'Nous contacter',
    noSetup: 'Sans frais d’installation · Sans engagement · Résiliable à tout moment',
    addon: 'Option pour toutes les offres : vidéos promo IA de vos plats — 29 $/mois (5 vidéos)',
    names: { STARTER: 'Essentiel', PRO: 'Pro', ENTERPRISE: 'Entreprise' } as Record<PlanId, string>,
    for: {
      STARTER: 'Food trucks, petits cafés et restaurants qui démarrent',
      PRO: 'Restaurants et cafés très fréquentés, automatisation complète',
      ENTERPRISE: 'Grands restaurants, chaînes et groupes multi-sites',
    } as Record<PlanId, string>,
  },
} as const

// [text per lang, included per plan: STARTER, PRO, ENTERPRISE]
type Cell = boolean | Record<Lang, string>
type Row = { ar: string; en: string; fr: string; inc: [Cell, Cell, Cell] }
const ROWS: Row[] = [
  { ar: 'منيو QR والطلب من الطاولة', en: 'QR menu & table ordering', fr: 'Menu QR et commande à table',
    inc: [{ ar: 'حتى 15 طاولة', en: 'Up to 15 tables', fr: 'Jusqu’à 15 tables' }, true, true] },
  { ar: 'نقطة البيع (الكاشير) وشاشة المطبخ', en: 'POS (cashier) & kitchen display', fr: 'Caisse et écran cuisine', inc: [true, true, true] },
  { ar: 'الدفع الإلكتروني (مدى، Apple Pay، البطاقات) عبر حسابك', en: 'Online payment (mada, Apple Pay, cards) to your own account', fr: 'Paiement en ligne (mada, Apple Pay, cartes) sur votre compte',
    inc: [{ ar: 'إضافة 19$ / شهر', en: '+$19 / month add-on', fr: 'Option 19 $ / mois' }, true, true] },
  { ar: 'برنامج الولاء وكوبونات الخصم', en: 'Loyalty program & discount coupons', fr: 'Fidélité et codes promo', inc: [false, true, true] },
  { ar: 'رسائل واتساب للزبائن وطلب التقييمات', en: 'WhatsApp messages to guests & review requests', fr: 'Messages WhatsApp et demandes d’avis', inc: [false, true, true] },
  { ar: 'محتوى تسويقي بالذكاء الاصطناعي', en: 'AI marketing content', fr: 'Contenu marketing par IA', inc: [false, true, true] },
  { ar: 'إدخال المنيو لأول مرة', en: 'First-time menu setup', fr: 'Saisie initiale du menu',
    inc: [{ ar: 'ذاتي', en: 'Self-service', fr: 'En autonomie' },
          { ar: 'مجاناً — فريقنا يدخله', en: 'Free — done by our team', fr: 'Offerte — par notre équipe' },
          { ar: 'مجاناً + تصميم هوية المنيو', en: 'Free + menu branding', fr: 'Offerte + identité du menu' }] },
  { ar: 'إدارة عدة فروع', en: 'Multi-branch management', fr: 'Gestion multi-sites', inc: [false, false, true] },
  { ar: 'الدعم', en: 'Support', fr: 'Support',
    inc: [{ ar: 'واتساب وبريد', en: 'WhatsApp & email', fr: 'WhatsApp et e-mail' },
          { ar: 'أولوية عبر واتساب', en: 'Priority on WhatsApp', fr: 'Prioritaire sur WhatsApp' },
          { ar: 'مدير حساب مخصص', en: 'Dedicated account manager', fr: 'Gestionnaire de compte dédié' }] },
]

function fmt(n: number, cur: PlanCurrency) {
  return cur === 'USD' ? `$${n.toLocaleString('en-US')}` : `${n.toLocaleString('en-US')} ${cur}`
}

export default function GulfPricing({ lang, contactHref }: { lang: string; contactHref: string }) {
  const L = (lang in T ? lang : 'en') as Lang
  const t = T[L]
  const [cur, setCur]     = useState<PlanCurrency>('SAR')
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div dir={L === 'ar' ? 'rtl' : 'ltr'}>
      {/* Switchers */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
        <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {PLAN_CURRENCIES.map(c => (
            <button key={c} onClick={() => setCur(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${cur === c ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
              style={cur === c ? { background: 'var(--cp)' } : undefined}>
              {CUR_LABEL[c][L]}
            </button>
          ))}
        </div>
        <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {(['monthly', 'yearly'] as const).map(c => (
            <button key={c} onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${cycle === c ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
              {t[c]}
              {c === 'yearly' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{t.yearlyBadge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {GULF_PLANS.map((p, pi) => (
          <div key={p.id}
            className={`relative bg-white rounded-2xl p-6 flex flex-col ${p.popular ? 'border-2 shadow-xl md:-translate-y-2' : 'border border-gray-200 shadow-sm'}`}
            style={p.popular ? { borderColor: 'var(--cp)' } : undefined}>
            {p.popular && (
              <span className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'var(--cp)' }}>
                {t.popular}
              </span>
            )}
            <h3 className="text-xl font-extrabold text-gray-900">{t.names[p.id]}</h3>
            <p className="text-sm text-gray-500 mt-1 min-h-[40px]">{t.for[p.id]}</p>
            <div className="mt-4 mb-5" dir="ltr">
              <span className="text-4xl font-extrabold text-gray-900">{fmt(p[cycle][cur], cur)}</span>
              <span className="text-gray-500 text-sm ms-1">{cycle === 'monthly' ? t.perMonth : t.perYear}</span>
            </div>
            <ul className="space-y-2.5 flex-1">
              {ROWS.map((r, ri) => {
                const v = r.inc[pi]
                const label = typeof v === 'object' ? v[L] : null
                const ok = v === true || !!label
                return (
                  <li key={ri} className={`flex items-start gap-2 text-sm ${ok ? 'text-gray-700' : 'text-gray-300'}`}>
                    {ok ? <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span>{r[L]}{label ? <span className="text-gray-500"> — {label}</span> : null}</span>
                  </li>
                )
              })}
            </ul>
            {p.id === 'ENTERPRISE' ? (
              <a href={contactHref} className="mt-6 block text-center border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white py-3 rounded-xl font-bold text-sm transition-colors">
                {t.ctaEnt}
              </a>
            ) : (
              <Link href="/signup" className="mt-6 block text-center text-white py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
                style={{ background: p.popular ? 'var(--cp)' : '#111827' }}>
                {t.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-gray-500 mt-6">{t.noSetup}</p>
      <p className="text-center text-sm text-gray-600 mt-2">🎬 {t.addon}</p>
    </div>
  )
}
