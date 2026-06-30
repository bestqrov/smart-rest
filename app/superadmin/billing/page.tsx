'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreditCard, Users, FileText } from 'lucide-react'
import { useSAAuth } from '../context'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الفوترة',
    subtitle: 'إدارة منظومة الفوترة',
    plans: 'الخطط',
    plansDesc: 'إدارة خطط الاشتراك والأسعار',
    subscriptions: 'الاشتراكات',
    subscriptionsDesc: 'إدارة اشتراكات المستأجرين',
    invoices: 'الفواتير',
    invoicesDesc: 'إدارة الفواتير والمدفوعات',
    comingSoon: 'قريباً',
  },
  en: {
    title: 'Billing',
    subtitle: 'Manage the billing system',
    plans: 'Plans',
    plansDesc: 'Manage subscription plans and pricing',
    subscriptions: 'Subscriptions',
    subscriptionsDesc: 'Manage tenant subscriptions',
    invoices: 'Invoices',
    invoicesDesc: 'Manage invoices and payments',
    comingSoon: 'Coming Soon',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const isRTL = lang === 'ar'
  const t = T[lang]

  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-blue-400" />
            {t.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
          className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plans — active */}
        <Link href="/superadmin/billing/plans"
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:bg-zinc-800 transition flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-900/50 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t.plans}</h2>
            <p className="text-sm text-zinc-400 mt-1">{t.plansDesc}</p>
          </div>
        </Link>

        {/* Subscriptions — disabled */}
        <div className="opacity-50 cursor-not-allowed bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Users className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">{t.subscriptions}</h2>
              <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">{t.comingSoon}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">{t.subscriptionsDesc}</p>
          </div>
        </div>

        {/* Invoices — disabled */}
        <div className="opacity-50 cursor-not-allowed bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <FileText className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">{t.invoices}</h2>
              <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">{t.comingSoon}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">{t.invoicesDesc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
