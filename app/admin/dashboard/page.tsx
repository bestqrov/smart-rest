'use client'

import React, { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { io, Socket } from 'socket.io-client'
import {
  TrendingUp, ShoppingBag, Users, Clock,
  Bell, CheckCheck, Wallet, AlertTriangle,
  Heart, Activity, Store, ShoppingCart, ChevronRight
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
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  function loadStats() {
    fetch('/api/admin/stats', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s) { setStats(s); setLoading(false) } })
  }

  // Real-time analytics: socket events trigger a full stats reload (chart,
  // revenue, top products, recent orders — not just the counters), debounced
  // so a rush of orders coalesces into one request.
  function scheduleStatsReload() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(loadStats, 1500)
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

    // Real-time stats updates: bump the counters instantly for feedback,
    // then pull fresh analytics so revenue/chart/recent orders follow live.
    socket.on('new_order', () => {
      setStats((s: any) => s ? { ...s, activeOrders: (s.activeOrders ?? 0) + 1 } : s)
      scheduleStatsReload()
    })
    socket.on('order_status_update', ({ status }: { status: string }) => {
      if (status === 'COMPLETED') {
        setStats((s: any) => s ? {
          ...s,
          activeOrders:     Math.max(0, (s.activeOrders ?? 0) - 1),
          ordersCountToday: (s.ordersCountToday ?? 0) + 1,
        } : s)
        scheduleStatsReload()
      } else if (status === 'CANCELLED') {
        setStats((s: any) => s ? { ...s, activeOrders: Math.max(0, (s.activeOrders ?? 0) - 1) } : s)
        scheduleStatsReload()
      }
    })

    return () => {
      socket.disconnect()
      clearInterval(refreshId)
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [])

  function ackCall(c: WaiterCall) {
    const token = localStorage.getItem('token')
    let cafeId: number | null = null
    try { cafeId = token ? JSON.parse(atob(token!.split('.')[1])).cafeId : null } catch {}
    socketRef.current?.emit('ack_call', { cafeId, callId: c.id })
  }

  if (loading) return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl p-4 bg-gray-100 animate-pulse h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-gray-100 rounded-2xl animate-pulse" style={{ height: 340 }} />
        <div className="bg-gray-100 rounded-2xl animate-pulse" style={{ height: 340 }} />
      </div>
    </div>
  )
  if (!stats) return <div className="p-6 text-red-500">{t.loadError}</div>

  const currency = billing?.currency || 'MAD'
  const bal      = Number(billing?.walletBalance || 0)

  return (
    <div className="lg:h-full lg:overflow-hidden flex flex-col gap-3 p-3 sm:p-4" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Waiter call toasts — overlay, never take grid space ─────────── */}
      {calls.length > 0 && (
        <div className={`fixed top-16 md:top-4 ${isRTL ? 'left-4' : 'right-4'} z-50 space-y-2 w-[min(92vw,340px)]`}>
          {calls.map(c => (
            <div key={c.id} className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <p className="font-semibold text-amber-900 text-sm truncate">{t.table} {c.tableId} {t.tableRequestsHelp}</p>
                  <p className="text-amber-700 text-xs truncate">{c.type}{c.message ? ` — ${c.message}` : ''}</p>
                </div>
              </div>
              <button onClick={() => ackCall(c)}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors shrink-0">
                <CheckCheck className="w-4 h-4" /> {t.ack}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="font-extrabold text-gray-900 text-lg">{t.dashboard}</h1>
        <button onClick={loadStats}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-xl text-xs font-semibold transition-colors">
          <Activity className="w-3.5 h-3.5" />
          {t.refresh}
        </button>
      </div>

      {/* ── Critical alerts (conditional, compact) ───────────────────────── */}
      {staffCount === 0 && (
        <div className="shrink-0 bg-red-50 border border-red-300 rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <Bell className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-800 flex-1 min-w-0 truncate"><b>{t.setupAlert}</b> — {t.setupAlertMsg}</p>
          <a href="/admin/staff"
            className="shrink-0 inline-flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
            <Users className="w-3.5 h-3.5" /> {t.addStaffNow}
          </a>
        </div>
      )}
      {billing?.billingStatus === 'SUSPENDED' && (
        <div className="shrink-0 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1 min-w-0 truncate"><b>{t.restaurantSuspended}</b> — {t.negBalanceMsg} ({bal.toFixed(2)} {currency})</p>
          <a href="/admin/billing" className="shrink-0 text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg">
            {t.settleNow}
          </a>
        </div>
      )}

      {/* ── Section 1 — KPI small-boxes (AdminLTE gradient style) ────────── */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SmallBox
          gradient="from-sky-500 to-blue-600" icon={TrendingUp}
          value={`${Number(stats.revenue.today).toFixed(0)} ${currency}`}
          label={t.revenue} sub={`${t.week}: ${Number(stats.revenue.week).toFixed(0)}`}
          href="/admin/financials" moreInfo={t.moreInfo} isRTL={isRTL}
        />
        <SmallBox
          gradient="from-emerald-500 to-green-600" icon={ShoppingBag}
          value={String(stats.ordersCountToday)}
          label={t.todayOrders} sub={`${t.aov}: ${Number(stats.aov).toFixed(0)} ${currency}`}
          href="/admin/control" moreInfo={t.moreInfo} isRTL={isRTL}
        />
        <SmallBox
          gradient="from-amber-400 to-yellow-500" icon={Activity}
          value={String(stats.activeOrders ?? 0)}
          label={t.orders} sub={t.preparing} pulse={stats.activeOrders > 0}
          href="/admin/control" moreInfo={t.moreInfo} isRTL={isRTL}
        />
        <SmallBox
          gradient={bal < 0 ? 'from-rose-500 to-red-600' : 'from-violet-500 to-purple-600'} icon={Wallet}
          value={`${bal.toFixed(0)} ${currency}`}
          label={t.walletBalance}
          sub={billing?.inTrial ? t.trialEnds : billing?.billingStatus === 'SUSPENDED' ? '⚠' : t.active}
          href="/admin/billing" moreInfo={t.moreInfo} isRTL={isRTL}
        />
      </div>

      {/* ── Section 2 — everything else on one screen ────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Left (2/3): revenue chart + recent orders */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">

          {/* Revenue chart with a compact sub-stats strip */}
          <div className="flex-[3] min-h-0 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
              <h3 className="font-bold text-gray-800 text-sm">{t.totalRevenue}</h3>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-semibold">{t.newCustomers}: {stats.newCustomers}</span>
                <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold">{t.activeStaff}: {stats.activeStaff ?? 0}</span>
              </div>
            </div>
            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <Tooltip formatter={(v: number) => [`${v} ${currency}`, t.sales]} />
                  <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent orders — compact table, scrolls inside its card only */}
          <div className="flex-[2] min-h-0 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-bold text-gray-800 text-sm mb-2 shrink-0">{t.recentOrders}</h3>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-gray-400 border-b border-gray-100 text-xs">
                    <th className={`py-1.5 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t.orders}</th>
                    <th className={`py-1.5 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t.table}</th>
                    <th className={`py-1.5 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t.revenue}</th>
                    <th className={`py-1.5 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t.dateRange}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentCompleted.map((o: any) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2 font-mono text-gray-500 text-xs">#{String(o.id).slice(-6)}</td>
                      <td className="py-2 text-gray-700">{o.tableId ? `T${o.tableId}` : '—'}</td>
                      <td className="py-2 font-semibold text-emerald-600">{Number(o.totalPrice).toFixed(2)} {currency}</td>
                      <td className="py-2 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString(t.dateLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!stats.recentCompleted || stats.recentCompleted.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-6">{t.noDataYet}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right (1/3): insights + growth — sub-sections in one column */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto">

          {/* Insights card: 3 sub-sections */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4 shrink-0">
            {/* Top products */}
            <div>
              <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wide mb-2">{t.topProducts}</h3>
              <ul className="space-y-1.5">
                {(stats.top ?? []).slice(0, 3).map((p: any, i: number) => (
                  <li key={p.productId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 truncate">{p.name || `#${p.productId}`}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0">{p.quantity}×</span>
                  </li>
                ))}
                {(stats.top ?? []).length === 0 && <li className="text-xs text-gray-400">{t.noDataYet}</li>}
              </ul>
            </div>

            {/* Peak hours */}
            <div>
              <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> {t.peakHours}
              </h3>
              <div className="space-y-1.5">
                {(stats.peakHours ?? []).slice(0, 3).map((p: any) => (
                  <div key={p.hour} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 shrink-0">{p.hour}:00</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(100, (p.count / (stats.peakHours[0]?.count || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{p.count}</span>
                  </div>
                ))}
                {(stats.peakHours ?? []).length === 0 && <p className="text-xs text-gray-400">{t.noDataYet}</p>}
              </div>
            </div>

            {/* Most liked */}
            <div>
              <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> {t.mostLiked}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(stats.mostLiked ?? []).slice(0, 3).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-2.5 py-1">
                    <span className="text-xs font-semibold text-rose-700 truncate max-w-[110px]">
                      {lang === 'ar' ? (p.nameAr || p.nameEn) : lang === 'fr' ? (p.nameFr || p.nameEn) : p.nameEn || p.nameAr}
                    </span>
                    <span className="text-xs text-rose-400">❤ {p.likesCount}</span>
                  </div>
                ))}
                {(stats.mostLiked ?? []).length === 0 && <span className="text-xs text-gray-400">{t.noDataYet}</span>}
              </div>
            </div>
          </div>

          {mpEnabled && mpWidget && (
            <MarketplaceWidget data={mpWidget} isRTL={isRTL} lang={lang} />
          )}

          {/* Smart Resto Certified progress */}
          <CertificationTracker />
        </div>
      </div>
    </div>
  )
}

// ─── AdminLTE-style gradient small-box ───────────────────────────────────────

function SmallBox({ gradient, icon: Icon, value, label, sub, href, moreInfo, pulse, isRTL }: {
  gradient: string; icon: any; value: string; label: string; sub: string
  href: string; moreInfo: string; pulse?: boolean; isRTL: boolean
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-sm flex flex-col`}>
      <div className="p-4 flex-1">
        <div className="text-2xl font-extrabold leading-tight">{value}</div>
        <div className="text-sm font-medium text-white/90 mt-0.5">{label}</div>
        <div className="text-[11px] text-white/70 mt-0.5 truncate">{sub}</div>
      </div>
      <Icon aria-hidden
        className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-3 w-14 h-14 text-black/10 ${pulse ? 'animate-pulse' : ''}`} />
      <Link href={href}
        className="block text-center text-[11px] font-semibold text-white/90 bg-black/10 hover:bg-black/20 py-1.5 transition-colors">
        {moreInfo} <ChevronRight className={`inline w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
      </Link>
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 shrink-0" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
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

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-lg font-extrabold text-amber-600">{data.pendingOrders}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.pending}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-emerald-600">{data.approvedOrders}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.approved}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-gray-800">
            {data.totalSpent >= 1000
              ? `${(data.totalSpent / 1000).toFixed(1)}k`
              : data.totalSpent.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t.currency}</div>
        </div>
      </div>

      {data.recentPurchases.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t.recent}</div>
          <div className="space-y-1">
            {data.recentPurchases.slice(0, 3).map(o => (
              <Link key={o.id} href={`/admin/marketplace/orders/${o.id}`}
                className="flex items-center justify-between py-0.5 hover:bg-gray-50 rounded px-1 transition-colors">
                <span className="text-xs font-mono text-gray-600">{o.orderNumber}</span>
                <span className={`text-[10px] font-medium ${STATUS_STYLE[o.status] ?? 'text-gray-400'}`}>
                  {labels[o.status] ?? o.status}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/admin/marketplace/orders"
            className="mt-1.5 text-[10px] text-emerald-600 hover:underline block text-center">{t.viewAll}</Link>
        </>
      )}
    </div>
  )
}
