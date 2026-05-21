'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffInfo {
  id: string
  name: string
  role: string
  shiftStatus: string
  clockInTime: string | null
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
  zone: string | null
}

interface WaiterNotif {
  type: 'none' | 'call_waiter' | 'pay_cash' | 'pay_tpe'
  isActive: boolean
}

interface NotifOrder {
  id: string
  createdAt: string
  totalPrice: number
  waiterNotification: WaiterNotif | null
  assignedWaiterId: string | null
  table: {
    id: string
    tableNumber: number
    zone: string | null
    assignedWaiterId: string | null
    assignedWaiter: { id: string; name: string } | null
  } | null
}

interface TodayStats {
  closedOrders: number
  totalRevenue: number
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'لوحة النادل',
    myZone: 'منطقتي',
    allZones: 'جميع المناطق',
    notifications: 'التنبيهات',
    noNotifs: 'لا توجد تنبيهات نشطة',
    accept: 'قبول',
    accepting: 'جاري…',
    table: 'طاولة',
    zone: 'منطقة',
    callWaiter: '🔔 طلب نادل',
    payCash: '💵 الدفع نقداً',
    payTPE: '💳 الدفع بالبطاقة',
    none: 'طلب',
    closedOrders: 'طلبات منجزة',
    totalRevenue: 'إجمالي الإيرادات',
    clockOut: 'إنهاء الوردية',
    clockingOut: 'جاري الخروج…',
    logout: 'تسجيل الخروج',
    hello: 'مرحباً',
    activeShift: 'وردية نشطة',
    offDuty: 'خارج الخدمة',
    lockedByOther: 'الطاولة محجوزة بواسطة',
    errorAccept: 'فشل القبول',
    filterZone: 'تصفية حسب المنطقة',
  },
  en: {
    title: 'Waiter Dashboard',
    myZone: 'My Zone',
    allZones: 'All Zones',
    notifications: 'Notifications',
    noNotifs: 'No active notifications',
    accept: 'Accept',
    accepting: 'Accepting…',
    table: 'Table',
    zone: 'Zone',
    callWaiter: '🔔 Waiter Call',
    payCash: '💵 Pay Cash',
    payTPE: '💳 Pay by Card',
    none: 'Order',
    closedOrders: 'Closed Orders',
    totalRevenue: 'Total Revenue',
    clockOut: 'Clock Out',
    clockingOut: 'Clocking out…',
    logout: 'Logout',
    hello: 'Hello',
    activeShift: 'Active Shift',
    offDuty: 'Off Duty',
    lockedByOther: 'Table locked by',
    errorAccept: 'Accept failed',
    filterZone: 'Filter by zone',
  },
  fr: {
    title: 'Dashboard Serveur',
    myZone: 'Ma Zone',
    allZones: 'Toutes les zones',
    notifications: 'Notifications',
    noNotifs: 'Aucune notification active',
    accept: 'Accepter',
    accepting: 'En cours…',
    table: 'Table',
    zone: 'Zone',
    callWaiter: '🔔 Appel serveur',
    payCash: '💵 Paiement espèces',
    payTPE: '💳 Paiement CB',
    none: 'Commande',
    closedOrders: 'Commandes fermées',
    totalRevenue: 'Revenu total',
    clockOut: 'Fin de service',
    clockingOut: 'Déconnexion…',
    logout: 'Déconnexion',
    hello: 'Bonjour',
    activeShift: 'Service actif',
    offDuty: 'Hors service',
    lockedByOther: 'Table prise par',
    errorAccept: 'Échec acceptation',
    filterZone: 'Filtrer par zone',
  },
  es: {
    title: 'Panel del Camarero',
    myZone: 'Mi Zona',
    allZones: 'Todas las zonas',
    notifications: 'Notificaciones',
    noNotifs: 'Sin notificaciones activas',
    accept: 'Aceptar',
    accepting: 'Aceptando…',
    table: 'Mesa',
    zone: 'Zona',
    callWaiter: '🔔 Llamada camarero',
    payCash: '💵 Pago efectivo',
    payTPE: '💳 Pago tarjeta',
    none: 'Pedido',
    closedOrders: 'Pedidos cerrados',
    totalRevenue: 'Ingresos totales',
    clockOut: 'Fin turno',
    clockingOut: 'Cerrando…',
    logout: 'Cerrar sesión',
    hello: 'Hola',
    activeShift: 'Turno activo',
    offDuty: 'Fuera de servicio',
    lockedByOther: 'Mesa tomada por',
    errorAccept: 'Error al aceptar',
    filterZone: 'Filtrar por zona',
  },
}

type Lang = keyof typeof T

// ── Component ─────────────────────────────────────────────────────────────────

export default function WaiterDashboard() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)

  const [lang, setLang] = useState<Lang>('ar')
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [notifications, setNotifications] = useState<NotifOrder[]>([])
  const [stats, setStats] = useState<TodayStats>({ closedOrders: 0, totalRevenue: 0 })
  const [accepting, setAccepting] = useState<string | null>(null)
  const [clockingOut, setClocingOut] = useState(false)
  const [filterMyZone, setFilterMyZone] = useState(false)
  const [error, setError] = useState('')
  const [cafeId, setCafeId] = useState('')
  const t = T[lang]
  const isRTL = lang === 'ar'

  // ── Auth header helper ───────────────────────────────────────────────────────
  function authHeader() {
    const tk = localStorage.getItem('waiterToken')
    return tk ? { Authorization: `Bearer ${tk}` } : {}
  }

  // ── Fetch profile ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/waiters/me', { headers: authHeader() })
    if (res.status === 401) { router.replace('/w/login'); return }
    if (!res.ok) return
    const data = await res.json()
    setStaff(data)
  }, [router])

  // ── Fetch notifications ───────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/waiters/active-notifications', { headers: authHeader() })
    if (!res.ok) return
    const data = await res.json()
    setNotifications(data.notifications ?? [])
  }, [])

  // ── Fetch stats ───────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/waiters/today-stats', { headers: authHeader() })
    if (!res.ok) return
    const data = await res.json()
    setStats(data)
  }, [])

  // ── On mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('waiterToken')
    if (!token) { router.replace('/w/login'); return }
    const cid = localStorage.getItem('waiterCafeId') ?? ''
    setCafeId(cid)

    // Detect lang
    const nav = navigator.language?.slice(0, 2)
    if (nav === 'fr') setLang('fr')
    else if (nav === 'es') setLang('es')
    else if (nav === 'ar') setLang('ar')
    else setLang('en')

    fetchProfile()
    fetchNotifications()
    fetchStats()
  }, [fetchProfile, fetchNotifications, fetchStats, router])

  // ── Socket.io ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cafeId) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? ''
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_room', cafeId)
    })

    // New waiter notification created by customer QR or POS
    socket.on('waiter_notification', () => {
      vibrate()
      fetchNotifications()
    })

    // Notification acknowledged by someone (remove from list)
    socket.on('waiter_notification_acked', () => {
      fetchNotifications()
      fetchStats()
    })

    // New order events — refresh too
    socket.on('new_order', () => fetchNotifications())
    socket.on('order_status_updated', () => fetchNotifications())

    return () => { socket.disconnect() }
  }, [cafeId, fetchNotifications, fetchStats])

  // ── Vibration helper ──────────────────────────────────────────────────────
  function vibrate() {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
  }

  // ── Vibrate when new unacknowledged notifs appear ─────────────────────────
  const prevCountRef = useRef(0)
  useEffect(() => {
    if (notifications.length > prevCountRef.current) vibrate()
    prevCountRef.current = notifications.length
  }, [notifications.length])

  // ── Accept notification ───────────────────────────────────────────────────
  async function handleAccept(orderId: string) {
    setAccepting(orderId)
    setError('')
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 403 ? `${t.lockedByOther} ${data.lockedByName ?? ''}` : (data.error ?? t.errorAccept))
        return
      }
      setNotifications(prev => prev.filter(n => n.id !== orderId))
      fetchStats()
      fetchProfile()
    } finally {
      setAccepting(null)
    }
  }

  // ── Clock out ─────────────────────────────────────────────────────────────
  async function handleClockOut() {
    setClocingOut(true)
    try {
      await fetch('/api/pos/waiters/clock-out', { method: 'POST', headers: authHeader() })
      localStorage.removeItem('waiterToken')
      localStorage.removeItem('waiterStaff')
      localStorage.removeItem('waiterCafeId')
      router.replace('/w/login')
    } finally {
      setClocingOut(false)
    }
  }

  // ── Logout (without clock-out) ─────────────────────────────────────────────
  function handleLogout() {
    localStorage.removeItem('waiterToken')
    localStorage.removeItem('waiterStaff')
    localStorage.removeItem('waiterCafeId')
    router.replace('/w/login')
  }

  // ── Filtered notifications ─────────────────────────────────────────────────
  const myZone = staff?.zone ?? null
  const displayed = filterMyZone && myZone
    ? notifications.filter(n => n.table?.zone === myZone)
    : notifications

  // ── Notif type label ───────────────────────────────────────────────────────
  function notifLabel(type: string | undefined) {
    if (type === 'call_waiter') return t.callWaiter
    if (type === 'pay_cash') return t.payCash
    if (type === 'pay_tpe') return t.payTPE
    return t.none
  }

  // ── Notif urgency color ────────────────────────────────────────────────────
  function notifColor(type: string | undefined) {
    if (type === 'pay_cash' || type === 'pay_tpe') return 'border-green-500 bg-green-900/30'
    if (type === 'call_waiter') return 'border-amber-500 bg-amber-900/30'
    return 'border-slate-600 bg-slate-800/50'
  }

  // ── Format time ───────────────────────────────────────────────────────────
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '< 1 min'
    return `${mins} min`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-900 text-white flex flex-col"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍽️</span>
          <div>
            <p className="font-bold text-sm leading-tight">{t.hello}, {staff?.name ?? '…'}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              staff?.shiftStatus === 'ACTIVE'
                ? 'bg-green-800 text-green-300'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {staff?.shiftStatus === 'ACTIVE' ? t.activeShift : t.offDuty}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Lang switcher */}
          <div className="flex gap-1">
            {(Object.keys(T) as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
                  lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Zone filter bar ───────────────────────────────────────────────── */}
      {myZone && (
        <div className="bg-slate-800/60 px-4 py-2 flex items-center gap-3 border-b border-slate-700">
          <span className="text-xs text-slate-400">{t.filterZone}:</span>
          <button
            onClick={() => setFilterMyZone(false)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !filterMyZone ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {t.allZones}
          </button>
          <button
            onClick={() => setFilterMyZone(true)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterMyZone ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {t.myZone} — {myZone}
          </button>
        </div>
      )}

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2 bg-red-900/60 border border-red-500 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Notifications list ────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-4 space-y-3 overflow-y-auto pb-36">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {t.notifications} ({displayed.length})
        </h2>

        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <span className="text-5xl mb-3">✅</span>
            <p>{t.noNotifs}</p>
          </div>
        ) : (
          displayed.map(order => (
            <div
              key={order.id}
              className={`border rounded-2xl p-4 transition-all ${notifColor(order.waiterNotification?.type)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold">
                      {t.table} {order.table?.tableNumber ?? '?'}
                    </span>
                    {order.table?.zone && (
                      <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-full text-slate-300">
                        {t.zone}: {order.table.zone}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-amber-300 mb-1">
                    {notifLabel(order.waiterNotification?.type)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{order.totalPrice.toFixed(2)} MAD</span>
                    <span>•</span>
                    <span>{timeAgo(order.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAccept(order.id)}
                  disabled={accepting === order.id}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-60 rounded-xl font-bold text-sm text-white transition-all min-w-[80px] text-center"
                >
                  {accepting === order.id ? t.accepting : t.accept}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ── Footer — Stats + Actions ─────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 px-4 py-3 z-10">
        {/* Stats row */}
        <div className="flex items-center justify-around mb-3">
          <div className="text-center">
            <p className="text-xl font-bold text-amber-400">{stats.closedOrders}</p>
            <p className="text-xs text-slate-400">{t.closedOrders}</p>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-center">
            <p className="text-xl font-bold text-green-400">{stats.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-slate-400">{t.totalRevenue}</p>
          </div>
          {myZone && (
            <>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-sm font-bold text-blue-300">{myZone}</p>
                <p className="text-xs text-slate-400">{t.zone}</p>
              </div>
            </>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleClockOut}
            disabled={clockingOut}
            className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-60 rounded-xl font-semibold text-sm transition-colors"
          >
            {clockingOut ? t.clockingOut : t.clockOut}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm transition-colors"
          >
            {t.logout}
          </button>
        </div>
      </footer>
    </div>
  )
}
