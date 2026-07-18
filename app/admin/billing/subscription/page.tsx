'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CreditCard, ArrowRight, ArrowLeft, Loader2, Clock, CheckCircle2, XCircle,
  Users, HardDrive, Sparkles, Store, Zap, ShieldCheck, Plug, Headset
} from 'lucide-react'
import { useLang } from '../../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionStatus =
  | 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED'

type Plan = {
  id: string
  name: string
  code: string
  monthlyPrice: number
  currency: string
  maxUsers: number | null
  maxStorageGB: number | null
  aiCredits: number | null
  marketplaceEnabled: boolean
  automationEnabled: boolean
  certificationEnabled: boolean
  apiAccess: boolean
  supportLevel: string | null
}

type SubscriptionWithPlan = {
  id: string
  tenantId: string
  planId: string | null
  planCode: string | null
  planName: string | null
  status: SubscriptionStatus | string
  startDate: string | null
  endDate: string | null
  renewalDate: string | null
  trialEndsAt: string | null
  cancelledAt: string | null
  graceEndsAt: string | null
  autoRenew: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  plan?: Plan | null
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الاشتراك', subtitle: 'تفاصيل خطة اشتراكك الحالية',
    currentPlan: 'الخطة الحالية', status: 'حالة الاشتراك',
    renewalDate: 'تاريخ التجديد', trialEndsAt: 'نهاية فترة التجربة',
    trialRemaining: 'الأيام المتبقية في التجربة', noSubscription: 'لا يوجد اشتراك نشط',
    changePlan: 'تغيير الخطة', comingSoon: 'قريباً',
    features: 'مميزات الخطة', maxUsers: 'أقصى مستخدمين', storage: 'التخزين',
    aiCredits: 'رصيد AI', marketplace: 'المارکت‌بليس', automation: 'الأتمتة',
    certification: 'الشهادات', apiAccess: 'وصول API', support: 'الدعم',
    included: 'مشمول', notIncluded: 'غير مشمول', loading: 'جاري التحميل...',
    back: 'العودة إلى الفواتير', days: 'يوم',
    STATUS: {
      TRIAL: 'فترة تجريبية', ACTIVE: 'نشط', GRACE_PERIOD: 'فترة سماح',
      SUSPENDED: 'موقوف', CANCELLED: 'ملغى', EXPIRED: 'منتهي',
    } as Record<string, string>,
  },
  en: {
    title: 'Subscription', subtitle: 'Your current subscription plan details',
    currentPlan: 'Current Plan', status: 'Subscription Status',
    renewalDate: 'Renewal Date', trialEndsAt: 'Trial Ends',
    trialRemaining: 'Trial Days Remaining', noSubscription: 'No active subscription',
    changePlan: 'Change Plan', comingSoon: 'Coming Soon',
    features: 'Plan Features', maxUsers: 'Max Users', storage: 'Storage',
    aiCredits: 'AI Credits', marketplace: 'Marketplace', automation: 'Automation',
    certification: 'Certification', apiAccess: 'API Access', support: 'Support',
    included: 'Included', notIncluded: 'Not Included', loading: 'Loading...',
    back: 'Back to Billing', days: 'days',
    STATUS: {
      TRIAL: 'Trial', ACTIVE: 'Active', GRACE_PERIOD: 'Grace Period',
      SUSPENDED: 'Suspended', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
    } as Record<string, string>,
  },
}

type TLang = keyof typeof T

const STATUS_COLORS: Record<string, string> = {
  TRIAL:        'bg-amber-100 text-amber-700',
  ACTIVE:       'bg-emerald-100 text-emerald-700',
  GRACE_PERIOD: 'bg-amber-100 text-amber-700',
  SUSPENDED:    'bg-red-100 text-red-700',
  CANCELLED:    'bg-gray-100 text-gray-700',
  EXPIRED:      'bg-red-100 text-red-700',
}

function fmtDate(d: string | null, locale: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString(locale) } catch { return '—' }
}

function daysRemaining(d: string | null): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  if (Number.isNaN(diff)) return null
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function SubscriptionPage() {
  const langCtx = useLang()
  const lang: TLang = (langCtx.lang === 'en' ? 'en' : 'ar')
  const isRTL = langCtx.isRTL
  const t = T[lang]
  const locale = lang === 'ar' ? 'ar-MA' : 'en-US'

  const [sub, setSub]         = useState<SubscriptionWithPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded]   = useState(false)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/subscription', { headers: authHeader() })
      const data = res.ok ? await res.json() : null
      setSub(data?.subscription ?? null)
    } catch {
      setSub(null)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  const BackIcon = isRTL ? ArrowRight : ArrowLeft
  const trialDays = sub?.status === 'TRIAL' ? daysRemaining(sub.trialEndsAt) : null

  const featureRows = sub?.plan ? [
    { key: 'maxUsers',     icon: Users,       label: t.maxUsers,     value: sub.plan.maxUsers != null ? String(sub.plan.maxUsers) : '∞' },
    { key: 'storage',      icon: HardDrive,   label: t.storage,      value: sub.plan.maxStorageGB != null ? `${sub.plan.maxStorageGB} GB` : '∞' },
    { key: 'aiCredits',    icon: Sparkles,    label: t.aiCredits,    value: sub.plan.aiCredits != null ? String(sub.plan.aiCredits) : '∞' },
    { key: 'support',      icon: Headset,     label: t.support,      value: sub.plan.supportLevel || '—' },
  ] : []

  const featureFlags = sub?.plan ? [
    { key: 'marketplace',   icon: Store,       label: t.marketplace,   enabled: sub.plan.marketplaceEnabled },
    { key: 'automation',    icon: Zap,         label: t.automation,    enabled: sub.plan.automationEnabled },
    { key: 'certification', icon: ShieldCheck, label: t.certification, enabled: sub.plan.certificationEnabled },
    { key: 'apiAccess',     icon: Plug,        label: t.apiAccess,     enabled: sub.plan.apiAccess },
  ] : []

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-600" /> {t.title}
        </h1>
      </div>
      <p className="text-gray-500 text-sm -mt-4">{t.subtitle}</p>

      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
      >
        <BackIcon className="w-4 h-4" /> {t.back}
      </Link>

      {loading && !loaded ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : !sub ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400">{t.noSubscription}</p>
        </div>
      ) : (
        <>
          {/* ── Plan + status ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">{t.currentPlan}</p>
              <p className="text-xl font-extrabold text-gray-900">
                {sub.plan?.name || sub.planName || '—'}
              </p>
              {(sub.plan?.code || sub.planCode) && (
                <p className="text-xs text-gray-400 mt-1 font-mono">{sub.plan?.code || sub.planCode}</p>
              )}
              {sub.plan && (
                <p className="text-sm text-gray-600 mt-2 font-semibold">
                  {sub.plan.monthlyPrice} {sub.plan.currency}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">{t.status}</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-700'}`}>
                {t.STATUS[sub.status] || sub.status}
              </span>

              {sub.status === 'TRIAL' && sub.trialEndsAt ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.trialEndsAt}: {fmtDate(sub.trialEndsAt, locale)}
                  </p>
                  {trialDays !== null && (
                    <p className="text-xs text-amber-700 font-bold">
                      {t.trialRemaining}: {trialDays} {t.days}
                    </p>
                  )}
                </div>
              ) : sub.renewalDate ? (
                <p className="text-xs text-gray-500 mt-2">
                  {t.renewalDate}: {fmtDate(sub.renewalDate, locale)}
                </p>
              ) : null}
            </div>
          </div>

          {/* ── Change plan ──────────────────────────────────────── */}
          <div className="flex justify-end">
            <button
              disabled
              title={t.comingSoon}
              className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-xl text-sm font-bold cursor-not-allowed"
            >
              {t.changePlan} — {t.comingSoon}
            </button>
          </div>

          {/* ── Plan features ────────────────────────────────────── */}
          {sub.plan && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-4">{t.features}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {featureRows.map(f => (
                  <div key={f.key} className="bg-gray-50 rounded-xl p-3 text-center">
                    <f.icon className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-[11px] text-gray-400">{f.label}</p>
                    <p className="text-sm font-bold text-gray-800">{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {featureFlags.map(f => (
                  <div
                    key={f.key}
                    className={`rounded-xl p-3 text-center border ${
                      f.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <f.icon className={`w-5 h-5 mx-auto mb-1.5 ${f.enabled ? 'text-emerald-600' : 'text-gray-300'}`} />
                    <p className="text-[11px] text-gray-500 mb-1">{f.label}</p>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${f.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {f.enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {f.enabled ? t.included : t.notIncluded}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
