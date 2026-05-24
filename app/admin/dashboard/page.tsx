'use client'

import React, { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { io, Socket } from 'socket.io-client'
import {
  TrendingUp, ShoppingBag, Users, Clock,
  Bell, CheckCheck, Wallet, AlertTriangle, Loader2,
  ChefHat, Heart, Activity, UserPlus
} from 'lucide-react'
import { useLang } from '../lang-context'
import { A } from '../../../lib/adminI18n'

type WaiterCall = { id: number; tableId: number; type: string; message?: string; createdAt: string }

export default function DashboardPage() {
  const { lang, isRTL } = useLang()
  const t = A[lang]

  const [stats, setStats]     = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [calls, setCalls]     = useState<WaiterCall[]>([])
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats',    { headers: authHeader() }).then(r => r.ok ? r.json() : null),
      fetch('/api/finance/status', { headers: authHeader() }).then(r => r.ok ? r.json() : null),
      fetch('/api/admin/staff',    { headers: authHeader() }).then(r => r.ok ? r.json() : null),
    ]).then(([s, b, st]) => {
      setStats(s); setBilling(b)
      setStaffCount(st?.waiters?.length ?? 0)
      setLoading(false)
    })

    const token   = localStorage.getItem('token')
    const SOCKET  = process.env.NEXT_PUBLIC_SOCKET_URL || '/'
    let cafeId: number | null = null
    try { cafeId = token ? JSON.parse(atob(token.split('.')[1])).cafeId : null } catch {}

    const socket = io(SOCKET, { transports: ['websocket'], auth: { token } })
    socketRef.current = socket
    if (cafeId) socket.emit('join', `room_${cafeId}`)
    socket.on('waiter_called',      (p: WaiterCall) => setCalls(c => [p, ...c]))
    socket.on('waiter_acknowledged', (p: any)        => setCalls(c => c.filter(x => x.id !== p.id)))
    return () => { socket.disconnect() }
  }, [])

  function ackCall(c: WaiterCall) {
    const token = localStorage.getItem('token')
    let cafeId: number | null = null
    try { cafeId = token ? JSON.parse(atob(token!.split('.')[1])).cafeId : null } catch {}
    socketRef.current?.emit('ack_call', { cafeId, callId: c.id })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  )
  if (!stats) return <div className="p-6 text-red-500">فشل تحميل البيانات</div>

  const currency = billing?.currency || 'MAD'
  const bal      = Number(billing?.walletBalance || 0)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── System Health: zero-staff alert ──────────────────────── */}
      {staffCount === 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 animate-pulse-slow">
          <Bell className="w-6 h-6 text-red-500 shrink-0 mt-0.5 animate-[bell-ring_1s_ease-in-out_infinite]" style={{
            animation: 'ring 0.8s ease-in-out infinite alternate'
          }} />
          <div className="flex-1">
            <p className="font-extrabold text-red-800 text-base">
              🔴 تنبيه إعداد النظام — Alerte configuration système
            </p>
            <div className="mt-1 space-y-0.5 text-sm text-red-700">
              <p>🇸🇦 <strong>المرجو إضافة نادل أو موظف</strong> لتفعيل النظام والبدء في استقبال الطلبات ميدانياً.</p>
              <p>🇫🇷 <strong>Veuillez ajouter un serveur ou un employé</strong> pour activer le système et commencer à recevoir des commandes.</p>
              <p>🇬🇧 <strong>Please add a waiter or staff member</strong> to activate the system and start receiving orders in the field.</p>
              <p>🇪🇸 <strong>Por favor, añade un camarero o empleado</strong> para activar el sistema y comenzar a recibir pedidos.</p>
            </div>
            <a href="/admin/staff"
              className="mt-3 inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <Users className="w-4 h-4" /> إضافة موظف الآن / Add Staff Now
            </a>
          </div>
        </div>
      )}

      {/* ── Billing alert banner ──────────────────────────────────── */}
      {billing?.billingStatus === 'SUSPENDED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">المطعم موقوف مؤقتاً</p>
            <p className="text-red-600 text-sm mt-0.5">رصيدك سالب ({bal.toFixed(2)} {currency}). قم بتسوية الدين لاستعادة الخدمة.</p>
            <a href="/admin/billing" className="mt-2 inline-block text-sm font-bold text-white bg-red-500 px-4 py-1.5 rounded-lg">
              تسوية الآن
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
                  <p className="font-semibold text-amber-900">الطاولة {c.tableId} تطلب المساعدة</p>
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
            <Heart className="w-4 h-4 text-rose-500" /> الأكثر إعجاباً
          </h3>
          <div className="flex flex-wrap gap-2">
            {(stats.mostLiked ?? []).slice(0,5).map((p: any) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5">
                <span className="text-xs font-semibold text-rose-700 truncate max-w-[100px]">{p.nameAr || p.nameEn}</span>
                <span className="text-xs text-rose-400">❤ {p.likesCount}</span>
              </div>
            ))}
            {(stats.mostLiked ?? []).length === 0 && <span className="text-xs text-gray-400">لا توجد بيانات بعد</span>}
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
                <Tooltip formatter={(v: number) => [`${v} ${currency}`, 'المبيعات']} />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
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
              <Clock className="w-4 h-4 text-amber-500" /> أوقات الذروة
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
                <th className="py-2 font-medium text-right">{t.orders}</th>
                <th className="py-2 font-medium text-right">{t.table}</th>
                <th className="py-2 font-medium text-right">{t.revenue}</th>
                <th className="py-2 font-medium text-right">{t.dateRange}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCompleted.map((o: any) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 font-mono text-gray-600">#{o.id}</td>
                  <td className="py-3 text-gray-700">{o.tableId ? `T${o.tableId}` : '—'}</td>
                  <td className="py-3 font-semibold text-emerald-600">{Number(o.totalPrice).toFixed(2)} {currency}</td>
                  <td className="py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString('ar-MA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
