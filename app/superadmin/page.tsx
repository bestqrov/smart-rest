'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, AlertTriangle, TrendingUp,
  Wallet, Globe, Filter, RefreshCw, ChevronDown,
  ChevronUp, Ban, CheckCircle, Loader2, Edit3,
  Shield
} from 'lucide-react'

type Overview = {
  totalCafes: number; activeCafes: number; suspendedCafes: number
  trialCafes: number; totalAccruedDebt: number; totalRevenue: number
}
type Tenant = {
  id: number; businessName: string; subdomain: string
  country: string; billingStatus: string; walletBalance: string
  currency: string; isActive: boolean; createdAt: string
  _count?: { Order: number }
}

const STATUS_LABELS: Record<string, string> = {
  GRACE_PERIOD:    'تجريبي',
  COLLECTING_DEBT: 'نشط',
  SUSPENDED:       'موقوف'
}
const STATUS_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-100 text-amber-700',
  COLLECTING_DEBT: 'bg-emerald-100 text-emerald-700',
  SUSPENDED:       'bg-red-100 text-red-700'
}

const SECRET = process.env.NEXT_PUBLIC_SUPERADMIN_SECRET || ''

export default function SuperAdminPage() {
  const [secret,   setSecret]   = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [tenants,  setTenants]  = useState<Tenant[]>([])
  const [loading,  setLoading]  = useState(false)
  const [page,     setPage]     = useState(1)
  const [hasMore,  setHasMore]  = useState(false)
  const [country,  setCountry]  = useState('')
  const [status,   setStatus]   = useState('')
  const [sort,     setSort]     = useState<'asc'|'desc'>('asc')
  const [actionId, setActionId] = useState<number | null>(null)
  const [overrideId, setOverrideId] = useState<number | null>(null)
  const [overrideAmt, setOverrideAmt] = useState('')

  function superHeader() {
    return { 'x-superadmin-secret': secret }
  }

  async function loadAll(p = 1) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '20', sort })
    if (country) params.set('country', country)
    if (status)  params.set('status',  status)

    const [ov, ten] = await Promise.all([
      fetch('/api/superadmin/overview', { headers: superHeader() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/superadmin/tenants?${params}`, { headers: superHeader() }).then(r => r.ok ? r.json() : null),
    ])
    setOverview(ov)
    if (ten?.cafes) {
      setTenants(prev => p === 1 ? ten.cafes : [...prev, ...ten.cafes])
      setHasMore(ten.hasMore)
    }
    setLoading(false)
  }

  function login() {
    if (!secret.trim()) return
    setAuthed(true)
    loadAll(1)
  }

  async function suspend(id: number) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/suspend`, { method: 'POST', headers: superHeader() })
    setActionId(null); loadAll(1)
  }

  async function reactivate(id: number) {
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/reactivate`, { method: 'POST', headers: { ...superHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ clearDebt: true }) })
    setActionId(null); loadAll(1)
  }

  async function overrideBalance(id: number) {
    if (!overrideAmt) return
    setActionId(id)
    await fetch(`/api/superadmin/tenants/${id}/override-balance`, {
      method: 'POST',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: Number(overrideAmt) })
    })
    setActionId(null); setOverrideId(null); setOverrideAmt(''); loadAll(1)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4" dir="rtl">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">Super Admin</h1>
              <p className="text-gray-400 text-xs">SmartMenu Control Room</p>
            </div>
          </div>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="الكود السري"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-emerald-500 mb-4"
          />
          <button
            onClick={login}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors"
          >
            دخول
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Super Admin — Control Room</h1>
              <p className="text-gray-400 text-xs">SmartMenu · Global Overview</p>
            </div>
          </div>
          <button onClick={() => { setPage(1); loadAll(1) }} className="text-gray-400 hover:text-emerald-400 transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────── */}
        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: Users,         label: 'إجمالي المطاعم', value: String(overview.totalCafes),       color: 'text-blue-400'    },
              { icon: CheckCircle,   label: 'نشطة',           value: String(overview.activeCafes),      color: 'text-emerald-400' },
              { icon: AlertTriangle, label: 'موقوفة',          value: String(overview.suspendedCafes),   color: 'text-red-400'     },
              { icon: Globe,         label: 'تجريبية',         value: String(overview.trialCafes),       color: 'text-amber-400'   },
              { icon: Wallet,        label: 'إجمالي الديون',   value: `${overview.totalAccruedDebt.toFixed(0)} MAD`, color: 'text-red-400' },
              { icon: TrendingUp,    label: 'إجمالي الإيرادات',value: `${overview.totalRevenue.toFixed(0)} MAD`,     color: 'text-emerald-400' },
            ].map((k, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <k.icon className={`w-5 h-5 mb-2 ${k.color}`} />
                <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
                <div className={`text-xl font-extrabold ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">الدولة</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
            >
              <option value="">الكل</option>
              <option value="MA">المغرب</option>
              <option value="SA">السعودية</option>
              <option value="AE">الإمارات</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">الحالة</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
            >
              <option value="">الكل</option>
              <option value="GRACE_PERIOD">تجريبي</option>
              <option value="COLLECTING_DEBT">نشط</option>
              <option value="SUSPENDED">موقوف</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">الرصيد</label>
            <button
              onClick={() => setSort(s => s === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {sort === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {sort === 'asc' ? 'الأقل أولاً' : 'الأعلى أولاً'}
            </button>
          </div>
          <button
            onClick={() => { setPage(1); loadAll(1) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Filter className="w-4 h-4" /> تصفية
          </button>
        </div>

        {/* ── Tenant matrix ──────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="px-4 py-3 text-right font-medium">المطعم</th>
                  <th className="px-4 py-3 text-right font-medium">الدولة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">الرصيد</th>
                  <th className="px-4 py-3 text-right font-medium">الطلبات</th>
                  <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => {
                  const bal = Number(t.walletBalance)
                  return (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{t.businessName}</div>
                        <div className="text-gray-500 text-xs">{t.subdomain}.smartmenu.ma</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{t.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[t.billingStatus] || 'bg-gray-700 text-gray-300'}`}>
                          {STATUS_LABELS[t.billingStatus] || t.billingStatus}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-bold ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {bal.toFixed(2)} {t.currency}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {t._count?.Order ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {t.billingStatus !== 'SUSPENDED' ? (
                            <button
                              onClick={() => suspend(t.id)}
                              disabled={actionId === t.id}
                              className="flex items-center gap-1 bg-red-900/50 hover:bg-red-800 text-red-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              إيقاف
                            </button>
                          ) : (
                            <button
                              onClick={() => reactivate(t.id)}
                              disabled={actionId === t.id}
                              className="flex items-center gap-1 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              تفعيل
                            </button>
                          )}
                          <button
                            onClick={() => { setOverrideId(t.id); setOverrideAmt('') }}
                            className="flex items-center gap-1 bg-blue-900/50 hover:bg-blue-800 text-blue-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Edit3 className="w-3 h-3" /> رصيد
                          </button>
                        </div>
                        {/* Override balance inline */}
                        {overrideId === t.id && (
                          <div className="flex items-center gap-1 mt-2">
                            <input
                              type="number"
                              value={overrideAmt}
                              onChange={e => setOverrideAmt(e.target.value)}
                              placeholder="0.00"
                              className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white outline-none"
                            />
                            <button
                              onClick={() => overrideBalance(t.id)}
                              disabled={actionId === t.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50"
                            >
                              {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'حفظ'}
                            </button>
                            <button onClick={() => setOverrideId(null)} className="text-gray-500 text-xs px-1">✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          )}
          {!loading && tenants.length === 0 && (
            <div className="text-center py-10 text-gray-500">لا توجد بيانات</div>
          )}
          {hasMore && !loading && (
            <div className="p-4 text-center border-t border-gray-800">
              <button
                onClick={() => { const next = page + 1; setPage(next); loadAll(next) }}
                className="text-sm text-gray-400 hover:text-emerald-400 flex items-center gap-1 mx-auto transition-colors"
              >
                <ChevronDown className="w-4 h-4" /> تحميل المزيد
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
