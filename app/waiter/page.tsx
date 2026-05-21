'use client'

/**
 * Waiter Dashboard — real-time alerts for:
 *   • New customer orders
 *   • Waiter notifications (call_waiter / pay_cash / pay_tpe) ← NEW
 *   • Orders ready to serve (waiter_order_ready)              ← NEW
 *   • Legacy waiter calls (WATER / CLEAN / QUESTION)
 *   • Bill requests
 *
 * New API:  PATCH /api/waiter/notifications/ack { orderId }
 * Socket events listened: waiter_notification, waiter_notification_acked, waiter_order_ready
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { Bell, CheckCircle2, Clock, DollarSign, CreditCard, Utensils, BellRing } from 'lucide-react'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Waiter View',
    live: 'Live',
    offline: 'Disconnected',
    newOrders: '🆕 New Orders',
    notifications: '🔔 Notifications',
    readyToServe: '🍽️ Ready to Serve',
    legacyCalls: '📣 Customer Calls',
    billRequests: '💳 Bill Requests',
    gotIt: 'Got it ✓',
    onMyWay: "On my way ✓",
    served: '✅ Served',
    paid: 'Paid ✓',
    noAlerts: 'No active alerts',
    noCalls: 'No active calls',
    noReady: 'Nothing ready yet',
    table: 'Table',
    seat: 'Seat',
    callWaiter: 'Call Waiter',
    payCash: 'Cash Payment',
    payCard: 'Card Payment (TPE)',
    justNow: 'just now',
    minAgo: (m: number) => `${m}m ago`,
  },
  ar: {
    title: 'داشبورد النادل',
    live: 'متصل',
    offline: 'غير متصل',
    newOrders: '🆕 طلبات جديدة',
    notifications: '🔔 التنبيهات',
    readyToServe: '🍽️ جاهز للتقديم',
    legacyCalls: '📣 نداءات الزبائن',
    billRequests: '💳 طلبات الحساب',
    gotIt: 'تم ✓',
    onMyWay: 'في الطريق ✓',
    served: '✅ تم التقديم',
    paid: 'تم الدفع ✓',
    noAlerts: 'لا يوجد تنبيهات',
    noCalls: 'لا يوجد نداءات',
    noReady: 'لا يوجد طلبات جاهزة',
    table: 'طاولة',
    seat: 'مقعد',
    callWaiter: 'استدعاء النادل',
    payCash: 'دفع نقدي',
    payCard: 'دفع بالبطاقة (TPE)',
    justNow: 'الآن',
    minAgo: (m: number) => `منذ ${m} د`,
  },
  fr: {
    title: 'Vue Serveur',
    live: 'En direct',
    offline: 'Déconnecté',
    newOrders: '🆕 Nouvelles commandes',
    notifications: '🔔 Notifications',
    readyToServe: '🍽️ Prêt à servir',
    legacyCalls: '📣 Appels clients',
    billRequests: '💳 Demandes addition',
    gotIt: "Reçu ✓",
    onMyWay: "J'arrive ✓",
    served: '✅ Servi',
    paid: 'Payé ✓',
    noAlerts: 'Aucune alerte active',
    noCalls: 'Aucun appel actif',
    noReady: 'Rien de prêt',
    table: 'Table',
    seat: 'Place',
    callWaiter: 'Appel serveur',
    payCash: 'Paiement espèces',
    payCard: 'Paiement carte (TPE)',
    justNow: 'à l\'instant',
    minAgo: (m: number) => `il y a ${m} min`,
  },
  es: {
    title: 'Vista Mesero',
    live: 'En vivo',
    offline: 'Desconectado',
    newOrders: '🆕 Pedidos nuevos',
    notifications: '🔔 Notificaciones',
    readyToServe: '🍽️ Listo para servir',
    legacyCalls: '📣 Llamadas clientes',
    billRequests: '💳 Solicitudes cuenta',
    gotIt: 'Entendido ✓',
    onMyWay: 'En camino ✓',
    served: '✅ Servido',
    paid: 'Pagado ✓',
    noAlerts: 'Sin alertas activas',
    noCalls: 'Sin llamadas activas',
    noReady: 'Nada listo aún',
    table: 'Mesa',
    seat: 'Asiento',
    callWaiter: 'Llamar mesero',
    payCash: 'Pago efectivo',
    payCard: 'Pago tarjeta (TPE)',
    justNow: 'ahora mismo',
    minAgo: (m: number) => `hace ${m} min`,
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType   = 'call_waiter' | 'pay_cash' | 'pay_tpe'
type WaiterNotif = {
  orderId:     string
  tableId:     string | null
  tableNumber: number | null
  type:        NotifType
  isActive:    boolean
  receivedAt:  string
}
type ReadyOrder = {
  id: string; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { id: string; quantity: number; product: { nameEn: string } }[]
}
type LegacyCall  = { id: string; tableId: string; tableNumber?: number; type: string; message?: string | null; createdAt: string }
type NewOrder    = { orderId: string; mergeLabel: string; totalPrice: string; createdAt: string }
type BillRequest = { id: string; tableId: string; tableNumber?: number; createdAt: string }

// ─── Audio ────────────────────────────────────────────────────────────────────

function playToneSeq(freqs: number[], interval = 200) {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const ctx = new C() as AudioContext
    freqs.forEach((f, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = f
      osc.type = 'sine'
      const t = ctx.currentTime + (i * interval) / 1000
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t); osc.stop(t + 0.27)
    })
  } catch {}
}

const NOTIF_SOUND: Record<NotifType, () => void> = {
  call_waiter: () => playToneSeq([660, 880]),            // two rising tones
  pay_cash:    () => playToneSeq([440, 440, 660], 180),  // three tones — urgency
  pay_tpe:     () => playToneSeq([880, 1047, 880], 180), // high-low melody
}

function playReadyChime() {
  playToneSeq([523, 659, 784, 1047], 140) // C-E-G-C ascending chime
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ElapsedTr = { justNow: string; minAgo: (m: number) => string }
function elapsed(iso: string, tr: ElapsedTr) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? tr.justNow : tr.minAgo(m)
}

function resolveToken(): { token: string; isPOS: boolean } | null {
  try {
    const posToken = localStorage.getItem('posToken')
    if (posToken) {
      const p = JSON.parse(atob(posToken.split('.')[1]))
      if (p.staffId && p.cafeId) return { token: posToken, isPOS: true }
    }
    const adminToken = localStorage.getItem('token')
    if (adminToken) {
      const p = JSON.parse(atob(adminToken.split('.')[1]))
      if (p.cafeId) return { token: adminToken, isPOS: false }
    }
  } catch {}
  return null
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Flash class per notification type ───────────────────────────────────────

const NOTIF_FLASH: Record<NotifType, string> = {
  call_waiter: 'flash-yellow',
  pay_cash:    'flash-red',
  pay_tpe:     'flash-purple',
}

const NOTIF_ICON: Record<NotifType, React.ReactNode> = {
  call_waiter: <BellRing className="w-6 h-6" />,
  pay_cash:    <DollarSign className="w-6 h-6" />,
  pay_tpe:     <CreditCard className="w-6 h-6" />,
}

const NOTIF_COLOR: Record<NotifType, { bg: string; text: string; border: string; btn: string }> = {
  call_waiter: {
    bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300',
    btn: 'bg-yellow-500 hover:bg-yellow-400 text-white',
  },
  pay_cash: {
    bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300',
    btn: 'bg-red-500 hover:bg-red-400 text-white',
  },
  pay_tpe: {
    bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-300',
    btn: 'bg-violet-500 hover:bg-violet-400 text-white',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const [notifications, setNotifications] = useState<WaiterNotif[]>([])
  const [newOrders, setNewOrders]         = useState<NewOrder[]>([])
  const [legacyCalls, setLegacyCalls]     = useState<LegacyCall[]>([])
  const [ready, setReady]                 = useState<ReadyOrder[]>([])
  const [bills, setBills]                 = useState<BillRequest[]>([])
  const [cafeId, setCafeId]               = useState('')
  const [authed, setAuthed]               = useState(false)
  const [isPOS, setIsPOS]                 = useState(false)
  const [connected, setConnected]         = useState(false)
  const [lang, setLang]                   = useState<Lang>('en')
  const [, setTick]                       = useState(0)

  const tokenRef       = useRef('')
  const socketRef      = useRef<Socket | null>(null)
  const beepTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifsRef      = useRef<WaiterNotif[]>([])

  // keep ref in sync for beep loop closure
  useEffect(() => { notifsRef.current = notifications }, [notifications])

  const tr     = T[lang]
  const isRTL  = lang === 'ar'

  function authHeader() { return { Authorization: `Bearer ${tokenRef.current}` } }

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const resolved = resolveToken()
    if (!resolved) { window.location.href = '/login'; return }
    const payload = JSON.parse(atob(resolved.token.split('.')[1]))
    tokenRef.current = resolved.token
    setCafeId(payload.cafeId)
    setIsPOS(resolved.isPOS)
    setAuthed(true)
    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') setLang(saved)
  }, [])

  // ── load initial ready orders ─────────────────────────────────────────────
  async function loadReady() {
    const endpoint = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
    const orders = await fetch(endpoint, { headers: authHeader() }).then(r => r.ok ? r.json() : [])
    setReady((orders as ReadyOrder[]).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }

  useEffect(() => { if (authed) loadReady() }, [authed, isPOS])

  // ── clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── vibrate helper ────────────────────────────────────────────────────────
  const vibrate = useCallback(() => {
    try { navigator.vibrate?.([200, 100, 200]) } catch {}
  }, [])

  // ── notification beep loop: starts when any isActive, stops when all clear ─
  function startBeepLoop(type: NotifType) {
    if (beepTimerRef.current) return
    NOTIF_SOUND[type]()
    beepTimerRef.current = setInterval(() => {
      const active = notifsRef.current.filter(n => n.isActive)
      if (active.length > 0) NOTIF_SOUND[active[0].type]()
      else {
        clearInterval(beepTimerRef.current!)
        beepTimerRef.current = null
      }
    }, 3000)
  }

  function stopBeepIfQuiet() {
    const hasActive = notifsRef.current.some(n => n.isActive)
    if (!hasActive && beepTimerRef.current) {
      clearInterval(beepTimerRef.current)
      beepTimerRef.current = null
    }
  }

  // ── socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token: tokenRef.current }, transports: ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join', `room_${cafeId}`)
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    // ── NEW: waiter notification from customer (call_waiter / pay_cash / pay_tpe) ──
    socket.on('waiter_notification', (data: Omit<WaiterNotif, 'receivedAt'>) => {
      vibrate()
      const notif: WaiterNotif = { ...data, receivedAt: new Date().toISOString() }
      setNotifications(prev => {
        // replace existing notification for same order if exists
        const filtered = prev.filter(n => n.orderId !== data.orderId)
        return [notif, ...filtered]
      })
      startBeepLoop(data.type)
    })

    // ── NEW: notification cleared (server confirmed ACK) ──────────────────
    socket.on('waiter_notification_acked', ({ orderId }: { orderId: string }) => {
      setNotifications(prev =>
        prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n)
      )
      stopBeepIfQuiet()
    })

    // ── NEW: kitchen marked an order ready → dedicated waiter alert ───────
    socket.on('waiter_order_ready', ({ orderId, tableId }: { orderId: string; tableId: string | null }) => {
      vibrate()
      playReadyChime()
      // Refresh the ready list
      const endpoint = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
      fetch(endpoint, { headers: authHeader() })
        .then(r => r.ok ? r.json() : [])
        .then((orders: ReadyOrder[]) =>
          setReady(orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
        )
      setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
    })

    // ── legacy: new order placed ──────────────────────────────────────────
    socket.on('new_order', (o: { orderId: string; mergeLabel: string; totalPrice: string }) => {
      vibrate()
      setNewOrders(prev => [{ ...o, createdAt: new Date().toISOString() }, ...prev.filter(x => x.orderId !== o.orderId)])
    })

    // ── legacy: WATER / CLEAN / QUESTION calls ────────────────────────────
    socket.on('waiter_called', (c: LegacyCall) => {
      vibrate()
      setLegacyCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
    })
    socket.on('waiter_acknowledged', ({ id }: { id: string }) => {
      setLegacyCalls(prev => prev.filter(c => c.id !== id))
    })

    // ── legacy: bill request ──────────────────────────────────────────────
    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
    })

    // ── order completed / cancelled ───────────────────────────────────────
    socket.on('order_status_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
      }
    })

    socket.on('kds_order_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
      }
    })

    return () => {
      socket.disconnect()
      if (beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null }
    }
  }, [authed, cafeId, isPOS, vibrate])

  // ── ACK notification via HTTP ─────────────────────────────────────────────
  async function ackNotification(orderId: string) {
    // Optimistic local update
    setNotifications(prev =>
      prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n)
    )
    stopBeepIfQuiet()
    try {
      await fetch('/api/waiter/notifications/ack', {
        method:  'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId }),
      })
    } catch {}
  }

  // ── legacy call ACK (socket) ──────────────────────────────────────────────
  function ackLegacyCall(callId: string) {
    socketRef.current?.emit('ack_call', { cafeId, callId })
    setLegacyCalls(prev => prev.filter(c => c.id !== callId))
  }

  // ── mark served ──────────────────────────────────────────────────────────
  async function markServed(orderId: string) {
    const endpoint = isPOS ? `/api/pos/waiter/orders/${orderId}/served` : `/api/orders/${orderId}/status`
    const body = isPOS ? undefined : JSON.stringify({ status: 'COMPLETED' })
    await fetch(endpoint, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body })
    setReady(prev => prev.filter(o => o.id !== orderId))
  }

  const activeNotifs  = notifications.filter(n => n.isActive)
  const totalAlerts   = activeNotifs.length + newOrders.length + legacyCalls.length + bills.length + ready.length

  return (
    <>
      {/* ── Flash animation styles ── */}
      <style>{`
        @keyframes flash-yellow {
          0%,100% { background-color: rgb(254 240 138 / 0.6); border-color: rgb(234 179 8); }
          50%     { background-color: white; }
        }
        @keyframes flash-red {
          0%,100% { background-color: rgb(254 202 202 / 0.6); border-color: rgb(239 68 68); }
          50%     { background-color: white; }
        }
        @keyframes flash-purple {
          0%,100% { background-color: rgb(233 213 255 / 0.6); border-color: rgb(139 92 246); }
          50%     { background-color: white; }
        }
        .flash-yellow { animation: flash-yellow 0.7s ease-in-out infinite; }
        .flash-red    { animation: flash-red    0.7s ease-in-out infinite; }
        .flash-purple { animation: flash-purple 0.7s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <Utensils className="w-7 h-7 text-emerald-500" />
            <div>
              <h1 className="font-extrabold text-gray-900 leading-none">{tr.title}</h1>
              <p className="text-xs flex items-center gap-1 mt-0.5">
                <span className={`w-2 h-2 rounded-full inline-block ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className={connected ? 'text-emerald-600' : 'text-red-500'}>
                  {connected ? tr.live : tr.offline}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalAlerts > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center animate-pulse">
                {totalAlerts}
              </span>
            )}
            {/* Language selector */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['ar', 'en', 'fr', 'es'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
                  className={`text-xs font-bold px-2 py-1 rounded-lg transition-all ${lang === l ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="max-w-lg mx-auto p-3 space-y-4 pb-12">

          {/* ── Active Waiter Notifications (call / pay) ── */}
          {activeNotifs.length > 0 && (
            <section>
              <SectionTitle title={tr.notifications} count={activeNotifs.length} />
              <div className="space-y-2">
                {activeNotifs.map(n => {
                  const c = NOTIF_COLOR[n.type]
                  return (
                    <div key={n.orderId}
                      className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${NOTIF_FLASH[n.type]}`}
                    >
                      <span className={`${c.text} flex-shrink-0`}>{NOTIF_ICON[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${c.text}`}>
                          {tr.table} {n.tableNumber ?? '?'}
                        </p>
                        <p className={`text-xs ${c.text} opacity-75`}>
                          {n.type === 'call_waiter' ? tr.callWaiter : n.type === 'pay_cash' ? tr.payCash : tr.payCard}
                          {' · '}{elapsed(n.receivedAt, tr)}
                        </p>
                      </div>
                      <button
                        onClick={() => ackNotification(n.orderId)}
                        className={`px-3.5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all ${c.btn}`}
                      >
                        {tr.onMyWay}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Orders Ready to Serve ── */}
          <section>
            <SectionTitle title={tr.readyToServe} count={ready.length} />
            {ready.length === 0 ? (
              <Empty icon="⏳" text={tr.noReady} />
            ) : ready.map(order => {
              const tableNum = (order.originalTable ?? order.table)?.tableNumber
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {tr.table} {tableNum ?? '?'}{order.seat ? ` · ${tr.seat} ${order.seat.seatNumber}` : ''}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{elapsed(order.createdAt, tr)}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {order.items.map(item => (
                      <li key={item.id} className="text-sm text-gray-700">
                        <span className="font-bold">{item.quantity}×</span> {item.product.nameEn}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => markServed(order.id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {tr.served}
                  </button>
                </div>
              )
            })}
          </section>

          {/* ── New Orders ── */}
          {newOrders.length > 0 && (
            <section>
              <SectionTitle title={tr.newOrders} count={newOrders.length} />
              <div className="space-y-2">
                {newOrders.map(o => (
                  <div key={o.orderId} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 flex items-center gap-3">
                    <span className="text-3xl flex-shrink-0">📋</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{o.mergeLabel}</p>
                      <p className="text-xs text-gray-500">{o.totalPrice} · {elapsed(o.createdAt, tr)}</p>
                    </div>
                    <button onClick={() => setNewOrders(prev => prev.filter(x => x.orderId !== o.orderId))}
                      className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                      {tr.gotIt}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Legacy Customer Calls (WATER / CLEAN / QUESTION) ── */}
          <section>
            <SectionTitle title={tr.legacyCalls} count={legacyCalls.length} />
            {legacyCalls.length === 0 ? (
              <Empty icon="✅" text={tr.noCalls} />
            ) : legacyCalls.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-center gap-3 mt-2">
                <span className="text-3xl flex-shrink-0">
                  {c.type === 'WATER' ? '🧊' : c.type === 'CLEAN' ? '🧹' : '❓'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">
                    {tr.table} {c.tableNumber ?? '?'} <span className="text-gray-400 font-normal">· {c.type}</span>
                  </p>
                  {c.message && <p className="text-xs text-gray-500 truncate">{c.message}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{elapsed(c.createdAt, tr)}</p>
                </div>
                <button onClick={() => ackLegacyCall(c.id)}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                  {tr.gotIt}
                </button>
              </div>
            ))}
          </section>

          {/* ── Bill Requests ── */}
          {bills.length > 0 && (
            <section>
              <SectionTitle title={tr.billRequests} count={bills.length} />
              <div className="space-y-2">
                {bills.map(b => (
                  <div key={b.id} className="bg-white rounded-2xl border border-violet-100 shadow-sm p-4 flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-violet-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{tr.table} {b.tableNumber ?? '?'}</p>
                      <p className="text-xs text-gray-400">{elapsed(b.createdAt, tr)}</p>
                    </div>
                    <button onClick={() => setBills(prev => prev.filter(x => x.id !== b.id))}
                      className="bg-violet-500 hover:bg-violet-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                      {tr.paid}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <h2 className="font-extrabold text-sm text-gray-700">{title}</h2>
      {count > 0 && (
        <span className="text-xs font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-gray-100">
      <p className="text-3xl mb-1">{icon}</p>
      <p className="text-sm">{text}</p>
    </div>
  )
}
