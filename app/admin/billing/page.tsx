'use client'

import { useEffect, useState } from 'react'
import {
  Wallet, CreditCard, AlertTriangle, CheckCircle,
  Clock, ArrowUpRight, ArrowDownRight, Loader2,
  ChevronDown, RefreshCw, Gift, Zap
} from 'lucide-react'

type BillingStatus = 'GRACE_PERIOD' | 'COLLECTING_DEBT' | 'SUSPENDED' | string
type WalletLog = { id: number; type: string; amount: string; description: string; createdAt: string }
type BillingTier = { from: number; to: number | null; fee: number }
type FinanceStatus = {
  walletBalance: string; billingStatus: BillingStatus; currency: string
  inTrial: boolean; trialEndsAt: string | null; hasExtendedTrial: boolean
  hasSocialShareAddon: boolean
}
type BillingPackage = { tiers: BillingTier[]; source: string }

const STATUS_LABELS: Record<string, string> = {
  GRACE_PERIOD:    'فترة تجريبية',
  COLLECTING_DEBT: 'نشط',
  SUSPENDED:       'موقوف'
}
const STATUS_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-100 text-amber-700',
  COLLECTING_DEBT: 'bg-emerald-100 text-emerald-700',
  SUSPENDED:       'bg-red-100 text-red-700'
}
const LOG_ICONS: Record<string, any> = {
  DEBT_ACC_ORDER:     { icon: ArrowDownRight, cls: 'text-red-500' },
  DEBT_ACC_SOCIAL:    { icon: ArrowDownRight, cls: 'text-red-400' },
  PAYMENT_SETTLEMENT: { icon: ArrowUpRight,   cls: 'text-emerald-500' },
  TRIAL_EXTENSION:    { icon: Gift,           cls: 'text-violet-500' }
}

export default function BillingPage() {
  const [status,  setStatus]  = useState<FinanceStatus | null>(null)
  const [pkg,     setPkg]     = useState<BillingPackage | null>(null)
  const [logs,    setLogs]    = useState<WalletLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action,  setAction]  = useState<string | null>(null)
  const [page,    setPage]    = useState(1)
  const [hasMore, setHasMore] = useState(false)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load(p = 1) {
    setLoading(true)
    const [s, k, l] = await Promise.all([
      fetch('/api/finance/status',        { headers: authHeader() }).then(r => r.ok ? r.json() : null),
      fetch('/api/finance/billing-package',{ headers: authHeader() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/finance/wallet-log?page=${p}&limit=10`, { headers: authHeader() }).then(r => r.ok ? r.json() : null),
    ])
    setStatus(s); setPkg(k)
    if (l?.logs) {
      setLogs(prev => p === 1 ? l.logs : [...prev, ...l.logs])
      setHasMore(l.hasMore)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function doAction(endpoint: string) {
    setAction(endpoint)
    await fetch(`/api/finance/${endpoint}`, { method: 'POST', headers: authHeader() })
    setAction(null); setPage(1); load(1)
  }

  async function loadMore() {
    const next = page + 1
    setPage(next); await load(next)
  }

  const bal = Number(status?.walletBalance || 0)
  const cur = status?.currency || 'MAD'

  if (loading && !status) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-600" /> الفواتير والرصيد
        </h1>
        <button onClick={() => load(1)} className="text-gray-400 hover:text-emerald-600 transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* ── Status + balance ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">الحالة</p>
          {status && (
            <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${STATUS_COLORS[status.billingStatus] || 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[status.billingStatus] || status.billingStatus}
            </span>
          )}
          {status?.inTrial && status.trialEndsAt && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              تنتهي التجربة: {new Date(status.trialEndsAt).toLocaleDateString('ar-MA')}
            </p>
          )}
        </div>
        <div className={`rounded-2xl p-5 shadow-sm border ${bal < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-400 mb-1">الرصيد</p>
          <p className={`text-2xl font-extrabold ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {bal.toFixed(2)} {cur}
          </p>
          {bal < 0 && (
            <p className="text-xs text-red-500 mt-1">دين متراكم — يُسوَّى أسبوعياً</p>
          )}
        </div>
      </div>

      {/* ── Suspension alert ─────────────────────────────────────── */}
      {status?.billingStatus === 'SUSPENDED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800">المطعم موقوف</p>
            <p className="text-red-600 text-sm mt-0.5">رصيدك سالب ولم يُسوَّ في الموعد. سدّد الدين لاستعادة الخدمة.</p>
            <button
              onClick={() => doAction('settle-debt')}
              disabled={action === 'settle-debt'}
              className="mt-3 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
            >
              {action === 'settle-debt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              تسوية الدين الآن
            </button>
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Extend trial */}
        {status?.inTrial && !status.hasExtendedTrial && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-violet-900 text-sm">تمديد التجربة</span>
            </div>
            <p className="text-violet-700 text-xs mb-3">تمديد مرة واحدة مجانية لمدة 7 أيام إضافية.</p>
            <button
              onClick={() => doAction('extend-trial')}
              disabled={!!action}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {action === 'extend-trial' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تمديد 7 أيام'}
            </button>
          </div>
        )}

        {/* Accept AI package */}
        {pkg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-emerald-900 text-sm">الباقة الذكية</span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{pkg.source === 'AI' ? 'AI' : 'مخصص'}</span>
            </div>
            <div className="space-y-1 mb-3">
              {pkg.tiers.slice(0, 3).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-emerald-800">
                  <span>حتى {t.to ?? '∞'} {cur}</span>
                  <span className="font-semibold">{t.fee} {cur}</span>
                </div>
              ))}
              {pkg.tiers.length > 3 && <p className="text-xs text-emerald-600">+{pkg.tiers.length - 3} شرائح أخرى...</p>}
            </div>
            <button
              onClick={() => doAction('accept-ai-package')}
              disabled={!!action}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {action === 'accept-ai-package' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تفعيل الباقة'}
            </button>
          </div>
        )}

        {/* Settle debt (not suspended) */}
        {status?.billingStatus === 'COLLECTING_DEBT' && bal < 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-blue-900 text-sm">تسوية الدين</span>
            </div>
            <p className="text-blue-700 text-xs mb-3">رصيدك سالب ({bal.toFixed(2)} {cur}). سدّد الآن لتجنب الإيقاف.</p>
            <button
              onClick={() => doAction('settle-debt')}
              disabled={!!action}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {action === 'settle-debt' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تسوية الآن'}
            </button>
          </div>
        )}
      </div>

      {/* ── Billing tiers ────────────────────────────────────────── */}
      {pkg && pkg.tiers.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3">شرائح الرسوم المعتمدة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="py-2 text-right font-medium">من</th>
                  <th className="py-2 text-right font-medium">إلى</th>
                  <th className="py-2 text-right font-medium">الرسوم</th>
                </tr>
              </thead>
              <tbody>
                {pkg.tiers.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700">{t.from} {cur}</td>
                    <td className="py-2.5 text-gray-700">{t.to != null ? `${t.to} ${cur}` : '∞'}</td>
                    <td className="py-2.5 font-semibold text-emerald-600">{t.fee} {cur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Wallet log ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-4">سجل المحفظة</h2>
        {logs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">لا توجد حركات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map(log => {
              const meta = LOG_ICONS[log.type] || { icon: Wallet, cls: 'text-gray-400' }
              const Icon = meta.icon
              return (
                <li key={log.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{log.description || log.type}</p>
                    <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('ar-MA')}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${Number(log.amount) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {Number(log.amount) < 0 ? '' : '+'}{Number(log.amount).toFixed(2)} {cur}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {hasMore && (
          <button
            onClick={loadMore}
            className="mt-4 w-full text-sm text-gray-500 hover:text-emerald-600 flex items-center justify-center gap-1 transition-colors"
          >
            <ChevronDown className="w-4 h-4" /> تحميل المزيد
          </button>
        )}
      </div>
    </div>
  )
}
