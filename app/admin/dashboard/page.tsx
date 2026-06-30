'use client'

import React, { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { io, Socket } from 'socket.io-client'
import {
  TrendingUp, ShoppingBag, Users, Clock,
  Bell, CheckCheck, Wallet, AlertTriangle, Loader2,
  ChefHat, Heart, Activity, UserPlus, Store, ShoppingCart
} from 'lucide-react'
import Link from 'next/link'
import { useLang } from '../lang-context'
import { A } from '../../../lib/adminI18n'
import CertificationTracker from './CertificationTracker'

type WaiterCall = { id: number; tableId: number; type: string; message?: string; createdAt: string }

export default function DashboardPage() {
  const { lang, isRTL } = useLang()
  const t = A[lang]

  const [stats, setStats]     = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [calls, setCalls]     = useState<WaiterCall[]>([])
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [mpEnabled, setMpEnabled] = useState(false)
  const [mpWidget,  setMpWidget]  = useState<{
    pendingOrders:   number
    approvedOrders:  number
    totalSpent:      number
    recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  } | null>(null)
  const socketRef = useRef<Socket | null>(null)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  function loadStats() {
    fetch('/api/admin/stats', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s) { setStats(s); setLoading(false) } })
  }

  useEffect(() => {
    // Load stats immediately — don't block on billing/staff
    loadStats()
    fetch('/api/finance/status', { headers: authHeader() }).then(r => r.ok ? r.json() : null).then(b => b && setBilling(b))
    fetch('/api/admin/staff',    { headers: authHeader() }).then(r => r.ok ? r.json() : null).then(st => st && setStaffCount(st?.waiters?.length ?? 0))

    const token3 = localStorage.getItem('token')
    if (token3) {
      const h3 = { Authorization: `Bearer ${token3}` }
      fetch('/api/restaurant/marketplace/flag', { headers: h3 })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.enabled) {
            setMpEnabled(true)
            fetch('/api/restaurant/marketplace/widget', { headers: h3 })
              .then(r => r.ok ? r.json() : null)
              .then(w => w && setMpWidget(w))
              .catch(() => undefined)
          }
        })
        .catch(() => undefined)
    }

    // Auto-refresh every 60s
    const refreshId = setInterval(loadStats, 60_000)

    const token  = localStorage.getItem('token')
    const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL || '/'
    let cafeId: string | null = null
    try { cafeId = token ? JSON.parse(atob(token.split('.')[1])).cafeId : null } catch {}

    const socket = io(SOCKET, { transports: ['websocket'], auth: { token } })
    socketRef.current = socket
    if (cafeId) socket.emit('join', `room_${cafeId}`)

    socket.on('waiter_called',       (p: WaiterCall) => setCalls(c => [p, ...c]))
    socket.on('waiter_acknowledged', (p: any)        => setCalls(c => c.filter(x => x.id !== p.id)))

    // Real-time stats updates
    socket.on('new_order', () => {
      setStats((s: any) => s ? { ...s, activeOrders: (s.activeOrders ?? 0) + 1 } : s)
    })
    socket.on('order_status_update', ({ status }: { status: string }) => {
      if (status === 'COMPLETED') {
        setStats((s: any) => s ? {
          ...s,
          activeOrders:     Math.max(0, (s.activeOrders ?? 0) - 1),
          ordersCountToday: (s.ordersCountToday ?? 0) + 1,
        } : s)
      } else if (status === 'CANCELLED') {
        setStats((s: any) => s ? { ...s, activeOrders: Math.max(0, (s.activeOrders ?? 0) - 1) } : s)
      }
    })

    return () => { socket.disconnect(); clearInterval(refreshId) }
  }, [])

  function ackCall(c: WaiterCall) {
    const token = localStorage.getItem('token')
    let cafeId: number | null = null
    try { cafeId = token ? JSON.parse(atob(token!.split('.')[1])).cafeId : null } catch {}
    socketRef.current?.emit('ack_call', { cafeId, callId: c.id })
  }

  if (loading) return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-7 bg-gray-100 rounded w-1/2 mb-2" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-7 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse" style={{ height: 280 }} />
    </div>
  )
  if (!stats) return <div className="p-6 text-red-500">{t.loadError}</div>

  const currency = billing?.currency || 'MAD'
  const bal      = Number(billing?.walletBalance || 0)

  return (
    <div className="flex min-h-full" dir={isRTL ? 'rtl' : 'ltr'}>
    {/* ── Main column ───────────────────────────────────────────────────── */}
    <div className="flex-1 p-4 sm:p-6 max-w-5xl space-y-6 overflow-x-hidden">

      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <h1 className="font-extrabold text-gray-900 text-lg">{t.dashboard}</h1>
        <button onClick={loadStats}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-xl text-xs font-semibold transition-colors">
          <Activity className="w-3.5 h-3.5" />
          {t.refresh ?? 'Refresh'}
        </button>
      </div>

      {/* ── System Health: zero-staff alert ──────────────────────── */}
      {staffCount === 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
          <Bell className="w-6 h-6 text-red-500 shrink-0 mt-0.5" style={{ animation: 'ring 0.8s ease-in-out infinite alternate' }} />
          <div className="flex-1">
            <p className="font-extrabold text-red-800 text-base">🔴 {t.setupAlert}</p>
            <p className="mt-1 text-sm text-red-700">{t.setupAlertMsg}</p>
            <a href="/admin/staff"
              className="mt-3 inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <Users className="w-4 h-4" /> {t.addStaffNow}
            </a>
          </div>
        </div>
      )}

      {/* ── Billing alert banner ──────────────────────────────────── */}
      {billing?.billingStatus === 'SUSPENDED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">{t.restaurantSuspended}</p>
            <p className="text-red-600 text-sm mt-0.5">{t.negBalanceMsg} ({bal.toFixed(2)} {currency})</p>
            <a href="/admin/billing" className="mt-2 inline-block text-sm font-bold text-white bg-red-500 px-4 py-1.5 rounded-lg">
              {t.settleNow}
            </a>
          </div>
        </div>
      )}

      {/* ── Waiter call toasts ────────────────────────────────────── */}
      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map(c => (
            <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                <div>
                  <p className="font-semibold text-amber-900">{t.table} {c.tableId} {t.tableRequestsHelp}</p>
                  <p className="text-amber-700 text-xs">{c.type}{c.message ? ` — ${c.message}` : ''}</p>
                </div>
              </div>
              <button
                onClick={() => ackCall(c)}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <CheckCheck className="w-4 h-4" /> {t.ack}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI cards row 1 ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp} color="emerald"
          label={t.revenue} value={`${Number(stats.revenue.today).toFixed(0)} ${currency}`}
          sub={`${t.week}: ${Number(stats.revenue.week).toFixed(0)}`}
        />
        <KpiCard
          icon={ShoppingBag} color="blue"
          label={t.todayOrders} value={String(stats.ordersCountToday)}
          sub={`avg: ${Number(stats.aov).toFixed(0)} ${currency}`}
        />
        <KpiCard
          icon={Activity} color="orange"
          label={t.orders} value={String(stats.activeOrders ?? 0)}
          sub={t.preparing}
          pulse={stats.activeOrders > 0}
        />
        <KpiCard
          icon={ChefHat} color="violet"
          label={t.activeStaff} value={String(stats.activeStaff ?? 0)}
          sub={t.active}
        />
      </div>

      {/* ── KPI cards row 2 ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users} color="sky"
          label={t.staff} value={String(stats.newCustomers)}
          sub="30d"
        />
        <KpiCard
          icon={Wallet} color={bal < 0 ? 'red' : 'emerald'}
          label={t.walletBalance} value={`${bal.toFixed(2)} ${currency}`}
          sub={billing?.inTrial ? t.trialEnds : billing?.billingStatus === 'SUSPENDED' ? '⚠' : t.active}
        />
        <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-rose-500" /> {t.mostLiked}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(stats.mostLiked ?? []).slice(0,5).map((p: any) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5">
                <span className="text-xs font-semibold text-rose-700 truncate max-w-[100px]">
                  {lang === 'ar' ? (p.nameAr || p.nameEn) : lang === 'fr' ? (p.nameFr || p.nameEn) : p.nameEn || p.nameAr}
                </span>
                <span className="text-xs text-rose-400">❤ {p.likesCount}</span>
              </div>
            ))}
            {(stats.mostLiked ?? []).length === 0 && <span className="text-xs text-gray-400">{t.noDataYet}</span>}
          </div>
        </div>
      </div>

      {/* ── Charts row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">{t.totalRevenue}</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} ${currency}`, t.sales]} />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {/* Smart Resto Certified progress */}
          <CertificationTracker />

          {mpEnabled && mpWidget && (
            <MarketplaceWidget data={mpWidget} isRTL={isRTL} lang={lang} />
          )}

          {/* Top products */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3">{t.products}</h3>
            <ul className="space-y-2">
              {stats.top.map((t: any, i: number) => (
                <li key={t.productId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-gray-700 truncate">{t.name || `#${t.productId}`}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0">{t.quantity}×</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Peak hours */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> {t.peakHours}
            </h3>
            <div className="space-y-2">
              {stats.peakHours.map((p: any) => (
                <div key={p.hour} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-14 shrink-0">{p.hour}:00</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 bg-amber-400 rounded-full"
                      style={{ width: `${Math.min(100, (p.count / (stats.peakHours[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent orders ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">{t.recentOrders}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="py-2 font-medium text-left">{t.orders}</th>
                <th className="py-2 font-medium text-left">{t.table}</th>
                <th className="py-2 font-medium text-left">{t.revenue}</th>
                <th className="py-2 font-medium text-left">{t.dateRange}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCompleted.map((o: any) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 font-mono text-gray-500 text-xs">#{String(o.id).slice(-6)}</td>
                  <td className="py-3 text-gray-700">{o.tableId ? `T${o.tableId}` : '—'}</td>
                  <td className="py-3 font-semibold text-emerald-600">{Number(o.totalPrice).toFixed(2)} {currency}</td>
                  <td className="py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString(t.dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ── Right stats panel — visible on xl screens ──────────────────── */}
    <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-gray-100 bg-white/50 p-5 space-y-5">

      {/* Venue header */}
      <div className="bg-[#1a2744] rounded-2xl p-4 text-white flex flex-col items-center text-center gap-2">
        {stats.cafeLogoUrl ? (
          <img src={stats.cafeLogoUrl} alt={stats.cafeName} className="w-12 h-12 rounded-xl object-contain bg-white/15" />
        ) : (
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-2xl">🍽️</div>
        )}
        <p className="font-black text-sm leading-tight">{stats.cafeName || 'Your Venue'}</p>
        <p className="text-blue-200 text-xs">Smart Menu Dashboard</p>
      </div>

      {/* Performance circles */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Performance</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Orders conversion */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center gap-2">
            <DonutChart
              value={stats.ordersCountToday > 0 ? Math.min(99, Math.round((stats.activeOrders / stats.ordersCountToday) * 100)) : 0}
              color="#10b981"
            />
            <p className="text-[10px] text-gray-500 text-center leading-tight">Active</p>
          </div>
          {/* AOV ratio */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center gap-2">
            <DonutChart
              value={stats.aov > 0 ? Math.min(99, Math.round((stats.aov / Math.max(stats.aov, 100)) * 100)) : 0}
              color="#3b82f6"
            />
            <p className="text-[10px] text-gray-500 text-center leading-tight">AOV score</p>
          </div>
        </div>
      </div>

      {/* Revenue en domaine */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-400 mb-1">Revenues en 1 domaine</p>
        <p className="text-2xl font-black text-gray-900">
          {Number(stats.revenue?.today ?? 0).toFixed(2)}
          <span className="text-sm font-bold text-gray-400 ml-1">{currency}</span>
        </p>
        <p className={`text-xs font-bold mt-1 ${stats.ordersCountToday > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {stats.ordersCountToday} {t.todayOrders}
        </p>
      </div>

      {/* Performance bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-400 mb-3">Performance Actix</p>
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900">
            {Number(stats.revenue?.week ?? 0).toFixed(2)}
            <span className="text-sm font-bold text-gray-400 ml-1">{currency}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">7-day revenue</p>
        </div>
        {/* Mini bar chart */}
        <div className="flex items-end gap-1 mt-3 h-12">
          {(stats.dailySales ?? []).slice(-7).map((d: any, i: number) => {
            const max = Math.max(...(stats.dailySales ?? []).map((x: any) => x.total || 0), 1)
            const pct = Math.round(((d.total || 0) / max) * 100)
            return (
              <div key={i} className="flex-1 bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${Math.max(4, pct)}%` }} />
            )
          })}
        </div>
      </div>

      {/* Waiter calls */}
      {calls.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
            <Bell className="w-3 h-3" /> {calls.length} Active Call{calls.length > 1 ? 's' : ''}
          </p>
          {calls.slice(0, 3).map(c => (
            <div key={c.id} className="text-xs text-amber-800 font-medium">
              T{c.tableId} — {c.type}
            </div>
          ))}
        </div>
      )}
    </aside>

    </div>
  )
}

function DonutChart({ value, color }: { value: number; color: string }) {
  const r = 15.9
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${value} ${100 - value}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-gray-800">
        {value}%
      </span>
    </div>
  )
}

function MarketplaceWidget({ data, isRTL, lang }: {
  data: {
    pendingOrders:   number
    approvedOrders:  number
    totalSpent:      number
    recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  }
  isRTL: boolean
  lang:  string
}) {
  const isAr = lang === 'ar'
  const t = isAr
    ? { title:'المتجر الذكي', pending:'بانتظار الموافقة', approved:'معتمدة', spent:'إجمالي المشتريات', recent:'آخر الطلبات', viewAll:'عرض الكل', quickOrder:'طلب سريع', currency:'د.م.' }
    : { title:'Marketplace', pending:'Pending', approved:'Approved', spent:'Total Spent', recent:'Recent Orders', viewAll:'View All', quickOrder:'Quick Order', currency:'MAD' }

  const STATUS_STYLE: Record<string, string> = {
    DRAFT:'text-gray-400', SUBMITTED:'text-amber-500',
    UNDER_REVIEW:'text-blue-500', APPROVED:'text-emerald-500',
    REJECTED:'text-red-500', FULFILLED:'text-emerald-400',
  }
  const STATUS_LABEL: Record<string, Record<string, string>> = {
    ar: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'مراجعة', APPROVED:'معتمد', REJECTED:'مرفوض', FULFILLED:'مُنجز', CANCELLED:'ملغى' },
    en: { DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review', APPROVED:'Approved', REJECTED:'Rejected', FULFILLED:'Fulfilled', CANCELLED:'Cancelled' },
  }
  const labels = STATUS_LABEL[isAr ? 'ar' : 'en'] ?? STATUS_LABEL.en

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Store className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="font-bold text-gray-900 text-sm">{t.title}</span>
        </div>
        <Link href="/admin/marketplace/orders/new"
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          {t.quickOrder}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xl font-extrabold text-amber-600">{data.pendingOrders}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.pending}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold text-emerald-600">{data.approvedOrders}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.approved}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold text-gray-800">
            {data.totalSpent >= 1000
              ? `${(data.totalSpent / 1000).toFixed(1)}k`
              : data.totalSpent.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.currency}</div>
        </div>
      </div>

      {data.recentPurchases.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.recent}</div>
          <div className="space-y-1.5">
            {data.recentPurchases.slice(0, 3).map(o => (
              <Link key={o.id} href={`/admin/marketplace/orders/${o.id}`}
                className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1 transition-colors">
                <span className="text-xs font-mono text-gray-600">{o.orderNumber}</span>
                <span className={`text-[10px] font-medium ${STATUS_STYLE[o.status] ?? 'text-gray-400'}`}>
                  {labels[o.status] ?? o.status}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/admin/marketplace/orders"
            className="mt-2 text-[10px] text-emerald-600 hover:underline block text-center">{t.viewAll}</Link>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, color, label, value, sub, pulse }: {
  icon: any; color: string; label: string; value: string; sub: string; pulse?: boolean
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50   text-blue-600',
    sky:     'bg-sky-50    text-sky-600',
    violet:  'bg-violet-50 text-violet-600',
    orange:  'bg-orange-50 text-orange-600',
    red:     'bg-red-50    text-red-600',
  }
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-shadow hover:shadow-md ${pulse ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-xl font-extrabold text-gray-900 leading-tight">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  )
}
