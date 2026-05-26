'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Shield, RefreshCw, Loader2, Filter,
  TrendingUp, Users, AlertTriangle, CheckCircle,
  Wallet, Globe, Ban, Edit3,
  ChevronDown, ChevronUp, X, Play, CalendarPlus,
  Coffee, Zap, BarChart3, Sandwich
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  totalCafes:       number
  activeCafes:      number
  suspendedCafes:   number
  trialCafes:       number
  economyCafes:     number
  advancedCafes:    number
  totalAccruedDebt: number
  totalRevenue:     number
  mrr:              number
}

interface Tenant {
  id:               string
  name:             string
  businessName:     string
  subdomain:        string
  country:          string
  currency:         string
  isActive:         boolean
  walletBalance:    number
  billingStatus:    string
  trialEndsAt:      string | null
  hasExtendedTrial: boolean
  subscriptionTier: string | null
  monthlyFee:       number | null
  coffeeRefPrice:   number | null
  sandwichRefPrice: number | null
  weeklyOrderCount: number | null
  _count:           { orders: number }
}

type ModalTab = 'prices' | 'trial' | 'activate'

interface ModalState {
  tenant:   Tenant
  tab:      ModalTab
  loading:  boolean
  error:    string
  coffee:   string
  sandwich: string
  days:     string
  fee:      string
  tier:     string
  preview:  { tier: string; monthlyFee: number; weeklyOrderCount: number } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  GRACE_PERIOD:    'تجريبي',
  COLLECTING_DEBT: 'نشط',
  SUSPENDED:       'موقوف'
}
const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-900/50 text-amber-300 border border-amber-700',
  COLLECTING_DEBT: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  SUSPENDED:       'bg-red-900/50 text-red-300 border border-red-700'
}
const TIER_COLORS: Record<string, string> = {
  ECONOMY:  'bg-sky-900/50 text-sky-300 border border-sky-700',
  ADVANCED: 'bg-violet-900/50 text-violet-300 border border-violet-700'
}
const TIER_AR: Record<string, string> = { ECONOMY: 'اقتصادي', ADVANCED: 'متقدم' }

function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [email,    setEmail]    = useState('')
  const [secret,   setSecret]   = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [tenants,  setTenants]  = useState<Tenant[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [sweepMsg, setSweepMsg] = useState('')

  const [filterCountry, setFilterCountry] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterTier,    setFilterTier]    = useState('')
  const [sortBal,       setSortBal]       = useState<'asc' | 'desc'>('asc')

  const [modal,    setModal]    = useState<ModalState | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const secretRef = useRef(secret)
  useEffect(() => { secretRef.current = secret }, [secret])

  const emailRef = useRef(email)
  useEffect(() => { emailRef.current = email }, [email])

  const superHeader = useCallback(() => ({
    'x-superadmin-secret': secretRef.current,
    'x-superadmin-email':  emailRef.current,
    'Content-Type':        'application/json'
  }), [])

  const loadAll = useCallback(async (p = 1, append = false) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '20',
      ...(filterCountry ? { country: filterCountry } : {}),
      ...(filterStatus  ? { status:  filterStatus  } : {}),
      ...(filterTier    ? { tier:    filterTier    } : {})
    })
    try {
      const [ovRes, tenRes] = await Promise.all([
        fetch('/api/superadmin/billing/overview', { headers: superHeader() }),
        fetch(`/api/superadmin/tenants/rich?${params}`, { headers: superHeader() })
      ])
      if (ovRes.ok)  setOverview(await ovRes.json())
      if (tenRes.ok) {
        const d = await tenRes.json()
        setTotal(d.total ?? 0)
        setTenants(prev => append ? [...prev, ...d.cafes] : d.cafes)
      }
    } finally { setLoading(false) }
  }, [superHeader, filterCountry, filterStatus, filterTier])

  const [loginErr, setLoginErr] = useState(false)

  async function login() {
    if (!email.trim() || !secret.trim()) return
    setLoginErr(false)
    const res = await fetch('/api/superadmin/overview', {
      headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email, 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setLoginErr(true)
    }
  }
  useEffect(() => { if (authed) loadAll(1) }, [authed, loadAll])

  async function runSweep() {
    setSweeping(true); setSweepMsg('')
    try {
      const res  = await fetch('/api/superadmin/billing/run-sweep', { method: 'POST', headers: superHeader() })
      const data = await res.json()
      setSweepMsg(`تم تحليل ${data.processed} مقهى`)
      loadAll(1)
    } catch { setSweepMsg('فشل التحليل') }
    finally   { setSweeping(false) }
  }

  async function suspend(id: string) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/suspend`, { method: 'POST', headers: superHeader() })
    setActionId(null); loadAll(1)
  }

  async function reactivate(id: string) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/reactivate`, {
      method: 'POST', headers: superHeader(), body: JSON.stringify({ clearDebt: false })
    })
    setActionId(null); loadAll(1)
  }

  function openModal(tenant: Tenant, tab: ModalTab = 'prices') {
    setModal({ tenant, tab, loading: false, error: '',
      coffee:   String(tenant.coffeeRefPrice   ?? ''),
      sandwich: String(tenant.sandwichRefPrice ?? ''),
      days: '7', fee: String(tenant.monthlyFee ?? ''),
      tier: tenant.subscriptionTier ?? 'ECONOMY', preview: null
    })
  }

  function setMF<K extends keyof ModalState>(k: K, v: ModalState[K]) {
    setModal(m => m ? { ...m, [k]: v } : m)
  }

  async function previewBilling() {
    if (!modal) return
    setMF('loading', true)
    try {
      const res  = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/billing/compute`, {
        method: 'POST', headers: superHeader()
      })
      const data = await res.json()
      setMF('preview', { tier: data.tier, monthlyFee: data.monthlyFee, weeklyOrderCount: data.weeklyOrderCount })
    } finally { setMF('loading', false) }
  }

  async function savePrices() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const r1 = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/ref-prices`, {
        method: 'PATCH', headers: superHeader(),
        body: JSON.stringify({ coffeeRefPrice: Number(modal.coffee), sandwichRefPrice: Number(modal.sandwich) })
      })
      if (!r1.ok) { setMF('error', 'فشل حفظ الأسعار'); return }
      await fetch(`/api/superadmin/tenants/${modal.tenant.id}/billing/apply`, {
        method: 'POST', headers: superHeader()
      })
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  async function extendTrial() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const res  = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/extend-trial`, {
        method: 'PATCH', headers: superHeader(), body: JSON.stringify({ days: Number(modal.days) })
      })
      const data = await res.json()
      if (!res.ok) { setMF('error', data.error ?? 'فشل'); return }
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  async function manualActivate() {
    if (!modal) return
    setMF('loading', true); setMF('error', '')
    try {
      const res = await fetch(`/api/superadmin/tenants/${modal.tenant.id}/activate`, {
        method: 'POST', headers: superHeader(),
        body: JSON.stringify({ monthlyFee: Number(modal.fee), tier: modal.tier })
      })
      if (!res.ok) { setMF('error', 'فشل التفعيل'); return }
      setModal(null); loadAll(1)
    } finally { setMF('loading', false) }
  }

  // ─── Login screen ─────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4" dir="rtl">
        <div className="bg-gray-900 rounded-3xl p-8 w-full max-w-sm border border-gray-800 shadow-2xl">
          <div className="flex flex-col items-center mb-8 gap-3">
            <Image src="/assets/logo.png" alt="Smart Menu" width={52} height={52} className="rounded-2xl" />
            <div className="text-center">
              <h1 className="text-white font-extrabold text-xl">Super Admin</h1>
              <p className="text-gray-500 text-xs">Smart Resto · Control Room</p>
            </div>
          </div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-emerald-500 mb-3 text-sm"
          />
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="كلمة المرور"
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-emerald-500 mb-4 text-center tracking-[0.3em] text-base"
          />
          {loginErr && (
            <p className="text-red-400 text-xs text-center mb-3">البريد الإلكتروني أو كلمة المرور غير صحيحة</p>
          )}
          <button onClick={login}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-extrabold transition-colors active:scale-95"
          >
            دخول →
          </button>
        </div>
      </div>
    )
  }

  // ─── Main dashboard ───────────────────────────────────────────────────────

  const hasMore = tenants.length < total

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Image src="/assets/logo.png" alt="Smart Menu" width={36} height={36} className="rounded-xl" />
            <div>
              <h1 className="text-white font-extrabold text-xl leading-none">Super Admin</h1>
              <p className="text-gray-500 text-xs">Smart Resto · لوحة التحكم العليا</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {sweepMsg && <span className="text-emerald-400 text-xs bg-emerald-950/50 border border-emerald-700 px-3 py-1 rounded-full">{sweepMsg}</span>}
            <a href="/superadmin/landing"
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Globe className="w-4 h-4" /> Landing Page
            </a>
            <button onClick={runSweep} disabled={sweeping}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              {sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              تحليل الاشتراكات
            </button>
            <button onClick={() => loadAll(1)} disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI cards */}
        {overview && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { icon: Users,         label: 'إجمالي المقاهي',    val: overview.totalCafes,                  color: 'text-blue-400',    bg: 'border-blue-800/50'    },
                { icon: CheckCircle,   label: 'نشطة',               val: overview.activeCafes,                 color: 'text-emerald-400', bg: 'border-emerald-800/50' },
                { icon: AlertTriangle, label: 'موقوفة',              val: overview.suspendedCafes,              color: 'text-red-400',     bg: 'border-red-800/50'     },
                { icon: Globe,         label: 'تجريبية',             val: overview.trialCafes,                  color: 'text-amber-400',   bg: 'border-amber-800/50'   },
                { icon: TrendingUp,    label: 'MRR المتوقع',         val: `${overview.mrr.toFixed(0)} MAD`,     color: 'text-violet-400',  bg: 'border-violet-800/50'  },
              ].map((k, i) => (
                <div key={i} className={`bg-gray-900 rounded-2xl p-4 border ${k.bg}`}>
                  <k.icon className={`w-4 h-4 mb-2 ${k.color}`} />
                  <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
                  <div className={`text-2xl font-extrabold ${k.color}`}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Subscription tier split */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-950/40 border border-sky-800 rounded-2xl p-4 flex items-center gap-4">
                <Coffee className="w-9 h-9 text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-sky-400 font-bold uppercase tracking-wide">الشريحة الاقتصادية</p>
                  <p className="text-4xl font-extrabold text-white">{overview.economyCafes}</p>
                  <p className="text-xs text-sky-300/60 mt-0.5">{"< 50 طلبية / أسبوع"}</p>
                </div>
              </div>
              <div className="bg-violet-950/40 border border-violet-800 rounded-2xl p-4 flex items-center gap-4">
                <Zap className="w-9 h-9 text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-violet-400 font-bold uppercase tracking-wide">الشريحة المتقدمة</p>
                  <p className="text-4xl font-extrabold text-white">{overview.advancedCafes}</p>
                  <p className="text-xs text-violet-300/60 mt-0.5">{"≥ 50 طلبية / أسبوع"}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Filters */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
          <FSelect label="الدولة" value={filterCountry} onChange={setFilterCountry}>
            <option value="">الكل</option>
            <option value="MA">المغرب 🇲🇦</option>
            <option value="SA">السعودية 🇸🇦</option>
            <option value="AE">الإمارات 🇦🇪</option>
          </FSelect>
          <FSelect label="الحالة" value={filterStatus} onChange={setFilterStatus}>
            <option value="">الكل</option>
            <option value="GRACE_PERIOD">تجريبي</option>
            <option value="COLLECTING_DEBT">نشط</option>
            <option value="SUSPENDED">موقوف</option>
          </FSelect>
          <FSelect label="الشريحة" value={filterTier} onChange={setFilterTier}>
            <option value="">الكل</option>
            <option value="ECONOMY">اقتصادي</option>
            <option value="ADVANCED">متقدم</option>
          </FSelect>
          <div>
            <p className="text-xs text-gray-500 mb-1">الرصيد</p>
            <button onClick={() => setSortBal(s => s === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {sortBal === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {sortBal === 'asc' ? 'الأقل أولاً' : 'الأعلى أولاً'}
            </button>
          </div>
          <button onClick={() => { setPage(1); loadAll(1) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            <Filter className="w-4 h-4" /> تصفية
          </button>
        </div>

        {/* Tenants table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="px-4 py-3 text-right font-medium">المقهى</th>
                  <th className="px-4 py-3 text-right font-medium">المنطقة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-center font-medium">التجربة</th>
                  <th className="px-4 py-3 text-center font-medium">طلبات / أسبوع</th>
                  <th className="px-4 py-3 text-right font-medium">الشريحة</th>
                  <th className="px-4 py-3 text-right font-medium">الاشتراك / شهر</th>
                  <th className="px-4 py-3 text-right font-medium">الرصيد</th>
                  <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {tenants.map(t => {
                  const bal  = Number(t.walletBalance)
                  const days = trialDaysLeft(t.trialEndsAt)
                  return (
                    <tr key={t.id}
                      className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => openModal(t)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{t.businessName || t.name}</div>
                        <div className="text-gray-500 text-xs">{t.subdomain}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                          {BILLING_LABELS[t.billingStatus] ?? t.billingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {days == null ? <span className="text-gray-600">—</span>
                          : days > 0  ? <span className="text-amber-400">{days} يوم</span>
                          :             <span className="text-red-400">انتهت</span>}
                        {t.hasExtendedTrial && <span className="mr-1 text-sky-400 text-[10px]">↗ممدد</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-white">{t.weeklyOrderCount ?? t._count.orders}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.subscriptionTier
                          ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_COLORS[t.subscriptionTier] ?? 'bg-gray-700 text-gray-300'}`}>{TIER_AR[t.subscriptionTier] ?? t.subscriptionTier}</span>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-violet-300 text-xs">
                        {t.monthlyFee != null ? `${t.monthlyFee.toFixed(2)} ${t.currency}` : '—'}
                      </td>
                      <td className={`px-4 py-3 font-bold text-xs ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {bal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {t.billingStatus !== 'SUSPENDED'
                            ? <RowBtn icon={<Ban className="w-3 h-3" />}     label="إيقاف" color="red"   loading={actionId === t.id} onClick={() => suspend(t.id)} />
                            : <RowBtn icon={<CheckCircle className="w-3 h-3" />} label="تفعيل" color="green" loading={actionId === t.id} onClick={() => reactivate(t.id)} />}
                          <RowBtn icon={<Edit3 className="w-3 h-3" />} label="إعداد" color="blue" loading={false} onClick={() => openModal(t, 'prices')} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
            </div>
          )}
          {!loading && tenants.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">لا توجد بيانات</div>
          )}
          {hasMore && !loading && (
            <div className="p-4 text-center border-t border-gray-800">
              <button
                onClick={() => { const n = page + 1; setPage(n); loadAll(n, true) }}
                className="text-sm text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1 mx-auto"
              >
                <ChevronDown className="w-4 h-4" /> تحميل المزيد ({total - tenants.length} متبقٍ)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-white font-extrabold text-lg">{modal.tenant.businessName || modal.tenant.name}</h2>
                <p className="text-gray-400 text-xs">{modal.tenant.subdomain} · {modal.tenant.country} · {modal.tenant.currency}</p>
              </div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-gray-800 flex-shrink-0">
              {([
                { key: 'prices'   as ModalTab, icon: <Coffee className="w-3.5 h-3.5" />,      label: 'أسعار المرجع' },
                { key: 'trial'    as ModalTab, icon: <CalendarPlus className="w-3.5 h-3.5" />, label: 'تمديد التجربة' },
                { key: 'activate' as ModalTab, icon: <Zap className="w-3.5 h-3.5" />,          label: 'تفعيل يدوي'   }
              ]).map(tab => (
                <button key={tab.key} onClick={() => setMF('tab', tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors ${
                    modal.tab === tab.key
                      ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-950/20'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {modal.error && (
                <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-sm">{modal.error}</div>
              )}

              {/* Prices tab */}
              {modal.tab === 'prices' && <>
                <p className="text-gray-400 text-xs leading-relaxed">
                  حدد سعر القهوة والسندوتش المرجعيين يدوياً، أو اتركهما ليقوم النظام بالكشف التلقائي عبر أسماء المنتجات في المنيو.
                  بعد الحفظ يُعاد حساب الاشتراك الشهري فوراً.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FInput label={<><Coffee className="w-3 h-3 inline ml-1" />سعر القهوة</>}
                    value={modal.coffee} onChange={v => setMF('coffee', v)} placeholder="0.00" type="number" />
                  <FInput label={<><Sandwich className="w-3 h-3 inline ml-1" />سعر السندوتش</>}
                    value={modal.sandwich} onChange={v => setMF('sandwich', v)} placeholder="0.00" type="number" />
                </div>

                <button onClick={previewBilling} disabled={modal.loading}
                  className="flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm transition-colors disabled:opacity-50"
                >
                  <BarChart3 className="w-4 h-4" />
                  {modal.loading ? 'جارٍ الحساب…' : 'معاينة الاشتراك المتوقع'}
                </button>

                {modal.preview && (
                  <div className={`rounded-2xl p-4 border ${modal.preview.tier === 'ADVANCED' ? 'bg-violet-950/50 border-violet-700' : 'bg-sky-950/50 border-sky-700'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">الشريحة المتوقعة</p>
                        <p className={`font-extrabold text-xl ${modal.preview.tier === 'ADVANCED' ? 'text-violet-300' : 'text-sky-300'}`}>
                          {TIER_AR[modal.preview.tier] ?? modal.preview.tier}
                        </p>
                        <p className="text-xs text-gray-500">{modal.preview.weeklyOrderCount} طلبية / 7 أيام</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">الاشتراك الشهري</p>
                        <p className="font-extrabold text-3xl text-white">{modal.preview.monthlyFee.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{modal.tenant.currency} / شهر</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div>
                        قهوة × {modal.preview.tier === 'ADVANCED' ? '30' : '10'} يوم ={' '}
                        <span className="text-white">{(Number(modal.coffee || 0) * (modal.preview.tier === 'ADVANCED' ? 30 : 10)).toFixed(2)}</span>
                      </div>
                      <div>
                        سندوتش × {modal.preview.tier === 'ADVANCED' ? '12' : '4'} أسابيع ={' '}
                        <span className="text-white">{(Number(modal.sandwich || 0) * (modal.preview.tier === 'ADVANCED' ? 12 : 4)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={savePrices} disabled={modal.loading || !modal.coffee || !modal.sandwich}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
                >
                  {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '💾 حفظ وتطبيق الاشتراك'}
                </button>
              </>}

              {/* Trial tab */}
              {modal.tab === 'trial' && <>
                <p className="text-gray-400 text-xs leading-relaxed">
                  تمديد الفترة التجريبية يُعيد ضبط حالة الاشتراك ويمنح المقهى مهلة إضافية لإتمام الدفع.
                  <br />
                  انتهاء التجربة الحالي:{' '}
                  <span className="text-white">{modal.tenant.trialEndsAt ? new Date(modal.tenant.trialEndsAt).toLocaleDateString('ar') : '—'}</span>
                  {modal.tenant.hasExtendedTrial && ' (ممدد مسبقاً)'}
                </p>
                <FInput label="عدد الأيام الإضافية"
                  value={modal.days} onChange={v => setMF('days', v)} placeholder="7" type="number" />
                <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-3 text-xs text-amber-300">
                  التاريخ الجديد المتوقع:{' '}
                  <strong>{new Date(Date.now() + Number(modal.days || 0) * 86_400_000).toLocaleDateString('ar')}</strong>
                </div>
                <button onClick={extendTrial} disabled={modal.loading || !modal.days}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
                >
                  {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `📅 تمديد ${modal.days} يوم`}
                </button>
              </>}

              {/* Activate tab */}
              {modal.tab === 'activate' && <>
                <p className="text-gray-400 text-xs leading-relaxed">
                  تفعيل يدوي يتجاوز التحليل التلقائي ويُحوّل المقهى مباشرة إلى حالة "نشط – COLLECTING_DEBT".
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">الشريحة</p>
                    <select value={modal.tier} onChange={e => setMF('tier', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="ECONOMY">اقتصادي ({"< 50 طلبية"})</option>
                      <option value="ADVANCED">متقدم ({"≥ 50 طلبية"})</option>
                    </select>
                  </div>
                  <FInput label={`الاشتراك الشهري (${modal.tenant.currency})`}
                    value={modal.fee} onChange={v => setMF('fee', v)} placeholder="0.00" type="number" />
                </div>
                <button onClick={manualActivate} disabled={modal.loading || !modal.fee}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors active:scale-95"
                >
                  {modal.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '⚡ تفعيل الحساب'}
                </button>
              </>}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
      >
        {children}
      </select>
    </div>
  )
}

function FInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
      />
    </div>
  )
}

function RowBtn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string; color: 'red' | 'green' | 'blue'
  loading: boolean; onClick: () => void
}) {
  const cls = { red: 'bg-red-900/50 hover:bg-red-800 text-red-300', green: 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300', blue: 'bg-blue-900/50 hover:bg-blue-800 text-blue-300' }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 ${cls[color]} px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )
}
