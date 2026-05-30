'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Bell, CheckCircle2, Clock, DollarSign, CreditCard,
  Utensils, BellRing, Users, LogOut, Wifi, WifiOff,
} from 'lucide-react'

// ─── Colour palette — one per waiter slot (index 0-9, then wraps) ─────────────

const PALETTES = [
  { avatar: 'bg-rose-500',    ring: 'ring-rose-300',    card: 'bg-rose-50    border-rose-200',    chip: 'bg-rose-100    text-rose-800',    btn: 'bg-rose-500    hover:bg-rose-600' },
  { avatar: 'bg-sky-500',     ring: 'ring-sky-300',     card: 'bg-sky-50     border-sky-200',     chip: 'bg-sky-100     text-sky-800',     btn: 'bg-sky-500     hover:bg-sky-600' },
  { avatar: 'bg-violet-500',  ring: 'ring-violet-300',  card: 'bg-violet-50  border-violet-200',  chip: 'bg-violet-100  text-violet-800',  btn: 'bg-violet-500  hover:bg-violet-600' },
  { avatar: 'bg-amber-500',   ring: 'ring-amber-300',   card: 'bg-amber-50   border-amber-200',   chip: 'bg-amber-100   text-amber-800',   btn: 'bg-amber-500   hover:bg-amber-600' },
  { avatar: 'bg-emerald-500', ring: 'ring-emerald-300', card: 'bg-emerald-50 border-emerald-200', chip: 'bg-emerald-100 text-emerald-800', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  { avatar: 'bg-fuchsia-500', ring: 'ring-fuchsia-300', card: 'bg-fuchsia-50 border-fuchsia-200', chip: 'bg-fuchsia-100 text-fuchsia-800', btn: 'bg-fuchsia-500 hover:bg-fuchsia-600' },
  { avatar: 'bg-orange-500',  ring: 'ring-orange-300',  card: 'bg-orange-50  border-orange-200',  chip: 'bg-orange-100  text-orange-800',  btn: 'bg-orange-500  hover:bg-orange-600' },
  { avatar: 'bg-teal-500',    ring: 'ring-teal-300',    card: 'bg-teal-50    border-teal-200',    chip: 'bg-teal-100    text-teal-800',    btn: 'bg-teal-500    hover:bg-teal-600' },
  { avatar: 'bg-indigo-500',  ring: 'ring-indigo-300',  card: 'bg-indigo-50  border-indigo-200',  chip: 'bg-indigo-100  text-indigo-800',  btn: 'bg-indigo-500  hover:bg-indigo-600' },
  { avatar: 'bg-pink-500',    ring: 'ring-pink-300',    card: 'bg-pink-50    border-pink-200',    chip: 'bg-pink-100    text-pink-800',    btn: 'bg-pink-500    hover:bg-pink-600' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'call_waiter' | 'pay_cash' | 'pay_tpe'

type WaiterNotif = {
  orderId: string; tableId: string | null; tableNumber: number | null
  type: NotifType; isActive: boolean; receivedAt: string
}
type ReadyOrder = {
  id: string; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { id: string; quantity: number; product: { nameEn: string } }[]
}
type LegacyCall  = { id: string; tableId: string; tableNumber?: number; type: string; message?: string | null; createdAt: string }
type BillRequest = { id: string; tableId: string; tableNumber?: number; createdAt: string }
type NewOrder    = { orderId: string; mergeLabel: string; totalPrice: string; createdAt: string }

type WaiterStatus = {
  id: string; name: string; role: string
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  assignedTables: { id: string; tableNumber: number; zone?: string | null }[]
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function playToneSeq(freqs: number[], interval = 200) {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const ctx = new C() as AudioContext
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = f; osc.type = 'sine'
      const t = ctx.currentTime + (i * interval) / 1000
      gain.gain.setValueAtTime(0.35, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t); osc.stop(t + 0.27)
    })
  } catch {}
}

const NOTIF_SOUND: Record<NotifType, () => void> = {
  call_waiter: () => playToneSeq([660, 880]),
  pay_cash:    () => playToneSeq([440, 440, 660], 180),
  pay_tpe:     () => playToneSeq([880, 1047, 880], 180),
}
const playReadyChime = () => playToneSeq([523, 659, 784, 1047], 140)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60); const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function shiftDuration(clockIn: string | null) {
  if (!clockIn) return null
  const m = Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000)
  if (m < 1)  return '< 1m'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function resolveToken(): { token: string; isPOS: boolean } | null {
  try {
    const t = localStorage.getItem('posToken')
    if (t) { const p = JSON.parse(atob(t.split('.')[1])); if (p.staffId && p.cafeId) return { token: t, isPOS: true } }
    const a = localStorage.getItem('token')
    if (a) { const p = JSON.parse(atob(a.split('.')[1])); if (p.cafeId) return { token: a, isPOS: false } }
  } catch {}
  return null
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Notification styles ──────────────────────────────────────────────────────

const NOTIF_META: Record<NotifType, { icon: React.ReactNode; label: string; flash: string; cardCls: string; btnCls: string }> = {
  call_waiter: {
    icon: <BellRing className="w-5 h-5" />, label: 'Call Waiter',
    flash: 'flash-yellow',
    cardCls: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    btnCls:  'bg-yellow-500 hover:bg-yellow-400 text-white',
  },
  pay_cash: {
    icon: <DollarSign className="w-5 h-5" />, label: 'Cash Payment',
    flash: 'flash-red',
    cardCls: 'bg-red-50 border-red-300 text-red-800',
    btnCls:  'bg-red-500 hover:bg-red-400 text-white',
  },
  pay_tpe: {
    icon: <CreditCard className="w-5 h-5" />, label: 'Card Payment',
    flash: 'flash-purple',
    cardCls: 'bg-violet-50 border-violet-300 text-violet-800',
    btnCls:  'bg-violet-500 hover:bg-violet-400 text-white',
  },
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  // auth
  const [authed,    setAuthed]    = useState(false)
  const [isPOS,     setIsPOS]     = useState(false)
  const [cafeId,    setCafeId]    = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState('WAITER')
  const [connected, setConnected] = useState(false)

  // team panel
  const [waiters, setWaiters] = useState<WaiterStatus[]>([])

  // live alerts
  const [notifications, setNotifications] = useState<WaiterNotif[]>([])
  const [ready,         setReady]         = useState<ReadyOrder[]>([])
  const [newOrders,     setNewOrders]     = useState<NewOrder[]>([])
  const [legacyCalls,   setLegacyCalls]   = useState<LegacyCall[]>([])
  const [bills,         setBills]         = useState<BillRequest[]>([])

  // UI
  const [tab,    setTab]    = useState<'team' | 'alerts'>('team')
  const [, setTick]         = useState(0)   // clock refresh

  const tokenRef     = useRef('')
  const socketRef    = useRef<Socket | null>(null)
  const beepRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifsRef    = useRef<WaiterNotif[]>([])

  useEffect(() => { notifsRef.current = notifications }, [notifications])

  function authHeader() { return { Authorization: `Bearer ${tokenRef.current}` } }

  // ── boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const resolved = resolveToken()
    if (!resolved) { window.location.href = '/pos'; return }
    const p = JSON.parse(atob(resolved.token.split('.')[1]))
    tokenRef.current = resolved.token
    setCafeId(p.cafeId)
    setIsPOS(resolved.isPOS)
    setAuthed(true)
    setStaffName(localStorage.getItem('staffName') ?? '')
    setStaffRole(p.staffRole ?? 'WAITER')
  }, [])

  // ── clock tick (refresh durations) ─────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── fetch team status ───────────────────────────────────────────────────────
  const loadWaiters = useCallback(async () => {
    if (!isPOS) return
    const res = await fetch('/api/pos/waiters/status', { headers: authHeader() })
    if (res.ok) setWaiters((await res.json()).waiters ?? [])
  }, [isPOS])

  useEffect(() => {
    if (!authed) return
    loadWaiters()
    const t = setInterval(loadWaiters, 30_000)
    return () => clearInterval(t)
  }, [authed, loadWaiters])

  // ── load ready orders ───────────────────────────────────────────────────────
  const loadReady = useCallback(async () => {
    const ep = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
    const data = await fetch(ep, { headers: authHeader() }).then(r => r.ok ? r.json() : [])
    setReady((data as ReadyOrder[]).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }, [isPOS])

  useEffect(() => { if (authed) loadReady() }, [authed, loadReady])

  // ── audio helpers ───────────────────────────────────────────────────────────
  const vibrate = useCallback(() => { try { navigator.vibrate?.([200, 100, 200]) } catch {} }, [])

  function startBeepLoop(type: NotifType) {
    if (beepRef.current) return
    NOTIF_SOUND[type]()
    beepRef.current = setInterval(() => {
      const active = notifsRef.current.filter(n => n.isActive)
      if (active.length) NOTIF_SOUND[active[0].type]()
      else { clearInterval(beepRef.current!); beepRef.current = null }
    }, 3000)
  }

  function stopBeepIfQuiet() {
    if (!notifsRef.current.some(n => n.isActive) && beepRef.current) {
      clearInterval(beepRef.current); beepRef.current = null
    }
  }

  // ── socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token: tokenRef.current }, transports: ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect',       () => { setConnected(true);  socket.emit('join', `room_${cafeId}`) })
    socket.on('disconnect',    () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('waiter_notification', (data: Omit<WaiterNotif, 'receivedAt'>) => {
      vibrate()
      const n: WaiterNotif = { ...data, receivedAt: new Date().toISOString() }
      setNotifications(prev => [n, ...prev.filter(x => x.orderId !== data.orderId)])
      startBeepLoop(data.type)
      setTab('alerts')
    })

    socket.on('waiter_notification_acked', ({ orderId }: { orderId: string }) => {
      setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n))
      stopBeepIfQuiet()
    })

    socket.on('waiter_order_ready', () => {
      vibrate(); playReadyChime()
      loadReady()
      setTab('alerts')
    })

    socket.on('new_order', (o: { orderId: string; mergeLabel: string; totalPrice: string }) => {
      vibrate()
      setNewOrders(prev => [{ ...o, createdAt: new Date().toISOString() }, ...prev.filter(x => x.orderId !== o.orderId)])
    })

    socket.on('waiter_called', (c: LegacyCall) => {
      vibrate()
      setLegacyCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
      setTab('alerts')
    })
    socket.on('waiter_acknowledged', ({ id }: { id: string }) =>
      setLegacyCalls(prev => prev.filter(c => c.id !== id))
    )

    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
      setTab('alerts')
    })

    socket.on('order_status_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
      }
    })

    // Team panel refresh on table assignment changes
    socket.on('table_assigned', () => loadWaiters())
    socket.on('table_released', () => loadWaiters())

    return () => {
      socket.disconnect()
      if (beepRef.current) { clearInterval(beepRef.current); beepRef.current = null }
    }
  }, [authed, cafeId, isPOS, vibrate, loadReady, loadWaiters])

  // ── actions ─────────────────────────────────────────────────────────────────
  async function ackNotification(orderId: string) {
    setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n))
    stopBeepIfQuiet()
    try {
      await fetch('/api/waiter/notifications/ack', {
        method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
    } catch {}
  }

  function ackLegacyCall(callId: string) {
    socketRef.current?.emit('ack_call', { cafeId, callId })
    setLegacyCalls(prev => prev.filter(c => c.id !== callId))
  }

  async function markServed(orderId: string) {
    const ep = isPOS ? `/api/pos/waiter/orders/${orderId}/served` : `/api/orders/${orderId}/status`
    const body = isPOS ? undefined : JSON.stringify({ status: 'COMPLETED' })
    await fetch(ep, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body })
    setReady(prev => prev.filter(o => o.id !== orderId))
  }

  function logout() {
    localStorage.removeItem('posToken'); localStorage.removeItem('staffName')
    window.location.href = '/pos'
  }

  // ── derived ─────────────────────────────────────────────────────────────────
  const activeNotifs  = notifications.filter(n => n.isActive)
  const alertCount    = activeNotifs.length + ready.length + newOrders.length + legacyCalls.length + bills.length
  const activeWaiters = waiters.filter(w => w.shiftStatus === 'ACTIVE')
  const offWaiters    = waiters.filter(w => w.shiftStatus === 'OFF_DUTY')

  // Map tableId → waiter index for colour lookup
  const tableWaiterIdx = new Map<string, number>()
  waiters.forEach((w, idx) => w.assignedTables.forEach(t => tableWaiterIdx.set(t.id, idx)))

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes flash-yellow  { 0%,100%{background-color:rgb(254 240 138/.6);border-color:rgb(234 179 8)}  50%{background-color:white} }
        @keyframes flash-red     { 0%,100%{background-color:rgb(254 202 202/.6);border-color:rgb(239 68 68)}   50%{background-color:white} }
        @keyframes flash-purple  { 0%,100%{background-color:rgb(233 213 255/.6);border-color:rgb(139 92 246)}  50%{background-color:white} }
        .flash-yellow { animation:flash-yellow 0.7s ease-in-out infinite }
        .flash-red    { animation:flash-red    0.7s ease-in-out infinite }
        .flash-purple { animation:flash-purple 0.7s ease-in-out infinite }
        .tab-active   { position:relative }
        .tab-active::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px; background:white; border-radius:2px }
      `}</style>

      <div className="min-h-screen bg-slate-100 flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-sky-600 to-indigo-600 shadow-lg sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">

            {/* Left: identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm leading-none">Waiter Command</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    staffRole === 'SUPERVISOR' ? 'bg-violet-400 text-white' : 'bg-white/20 text-white'
                  }`}>{staffRole}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {connected
                    ? <Wifi className="w-3 h-3 text-emerald-300" />
                    : <WifiOff className="w-3 h-3 text-red-300" />
                  }
                  <span className="text-xs text-sky-100">
                    {staffName ? `${staffName} · ` : ''}{connected ? 'Live' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: alert badge + logout */}
            <div className="flex items-center gap-2">
              {alertCount > 0 && (
                <button onClick={() => setTab('alerts')}
                  className="bg-red-500 text-white text-sm font-extrabold min-w-[2rem] h-8 px-2 rounded-full flex items-center justify-center animate-pulse shadow-lg gap-1">
                  <Bell className="w-3.5 h-3.5" />{alertCount}
                </button>
              )}
              <button onClick={logout} title="Logout"
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors text-white">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Tab bar ─────────────────────────────────────────────────────── */}
          <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
            {[
              { id: 'team',   icon: <Users className="w-3.5 h-3.5" />,  label: `Team (${waiters.length})` },
              { id: 'alerts', icon: <Bell className="w-3.5 h-3.5" />,   label: `Alerts${alertCount > 0 ? ` (${alertCount})` : ''}` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                  tab === t.id
                    ? 'bg-slate-100 text-indigo-700 tab-active'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 max-w-4xl mx-auto w-full px-3 py-4 space-y-6 pb-10">

          {/* ════════ TEAM TAB ════════ */}
          {tab === 'team' && (
            <>
              {/* Active waiters */}
              <section>
                <SectionHeader icon="🟢" title="On Duty" count={activeWaiters.length} />
                {activeWaiters.length === 0 ? (
                  <EmptyCard icon="😴" text="No waiters clocked in yet" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeWaiters.map(w => {
                      const idx = waiters.indexOf(w) % PALETTES.length
                      const p   = PALETTES[idx]
                      return <WaiterCard key={w.id} waiter={w} palette={p} activeNotifs={activeNotifs} />
                    })}
                  </div>
                )}
              </section>

              {/* Off-duty waiters */}
              {offWaiters.length > 0 && (
                <section>
                  <SectionHeader icon="⚫" title="Off Duty" count={offWaiters.length} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {offWaiters.map(w => {
                      const idx = waiters.indexOf(w) % PALETTES.length
                      const p   = PALETTES[idx]
                      return (
                        <div key={w.id} className="bg-white rounded-2xl border border-gray-200 p-3 flex items-center gap-3 opacity-60">
                          <div className={`w-9 h-9 rounded-xl ${p.avatar} flex items-center justify-center shrink-0`}>
                            <span className="text-white font-extrabold text-xs">{initials(w.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-700 text-sm truncate">{w.name}</p>
                            <p className="text-xs text-gray-400">{w.role}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {waiters.length === 0 && (
                <EmptyCard icon="👥" text="No staff data. Make sure you're logged in with a POS token." />
              )}
            </>
          )}

          {/* ════════ ALERTS TAB ════════ */}
          {tab === 'alerts' && (
            <>
              {/* Active notifications (flashing) */}
              {activeNotifs.length > 0 && (
                <section>
                  <SectionHeader icon="🔔" title="Notifications" count={activeNotifs.length} />
                  <div className="space-y-2">
                    {activeNotifs.map(n => {
                      const m = NOTIF_META[n.type]
                      const wIdx = n.tableId ? tableWaiterIdx.get(n.tableId) : undefined
                      const wPalette = wIdx !== undefined ? PALETTES[wIdx % PALETTES.length] : null
                      const waiter   = wIdx !== undefined ? waiters[wIdx] : null
                      return (
                        <div key={n.orderId} className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${m.flash}`}>
                          <span className="flex-shrink-0 opacity-80">{m.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">Table {n.tableNumber ?? '?'}</p>
                              {waiter && wPalette && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${wPalette.chip}`}>
                                  {initials(waiter.name)} {waiter.name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            <p className="text-xs opacity-75">{m.label} · {elapsed(n.receivedAt)}</p>
                          </div>
                          <button onClick={() => ackNotification(n.orderId)}
                            className={`px-3.5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all text-white ${m.btnCls}`}>
                            On my way ✓
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Ready to serve */}
              <section>
                <SectionHeader icon="🍽️" title="Ready to Serve" count={ready.length} />
                {ready.length === 0 ? (
                  <EmptyCard icon="⏳" text="Nothing ready yet" />
                ) : ready.map(order => {
                  const tableNum = (order.originalTable ?? order.table)?.tableNumber
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          Table {tableNum ?? '?'}{order.seat ? ` · Seat ${order.seat.seatNumber}` : ''}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{elapsed(order.createdAt)}
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
                        <CheckCircle2 className="w-4 h-4" /> Served ✓
                      </button>
                    </div>
                  )
                })}
              </section>

              {/* New orders */}
              {newOrders.length > 0 && (
                <section>
                  <SectionHeader icon="🆕" title="New Orders" count={newOrders.length} />
                  <div className="space-y-2">
                    {newOrders.map(o => (
                      <div key={o.orderId} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 flex items-center gap-3">
                        <span className="text-3xl flex-shrink-0">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{o.mergeLabel}</p>
                          <p className="text-xs text-gray-500">{o.totalPrice} · {elapsed(o.createdAt)}</p>
                        </div>
                        <button onClick={() => setNewOrders(prev => prev.filter(x => x.orderId !== o.orderId))}
                          className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                          Got it ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Legacy calls */}
              <section>
                <SectionHeader icon="📣" title="Customer Calls" count={legacyCalls.length} />
                {legacyCalls.length === 0 ? (
                  <EmptyCard icon="✅" text="No active calls" />
                ) : legacyCalls.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-center gap-3 mt-2">
                    <span className="text-3xl flex-shrink-0">
                      {c.type === 'WATER' ? '🧊' : c.type === 'CLEAN' ? '🧹' : '❓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">
                        Table {c.tableNumber ?? '?'} <span className="text-gray-400 font-normal">· {c.type}</span>
                      </p>
                      {c.message && <p className="text-xs text-gray-500 truncate">{c.message}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{elapsed(c.createdAt)}</p>
                    </div>
                    <button onClick={() => ackLegacyCall(c.id)}
                      className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                      Got it ✓
                    </button>
                  </div>
                ))}
              </section>

              {/* Bill requests */}
              {bills.length > 0 && (
                <section>
                  <SectionHeader icon="💳" title="Bill Requests" count={bills.length} />
                  <div className="space-y-2">
                    {bills.map(b => (
                      <div key={b.id} className="bg-white rounded-2xl border border-violet-100 shadow-sm p-4 flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-violet-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">Table {b.tableNumber ?? '?'}</p>
                          <p className="text-xs text-gray-400">{elapsed(b.createdAt)}</p>
                        </div>
                        <button onClick={() => setBills(prev => prev.filter(x => x.id !== b.id))}
                          className="bg-violet-500 hover:bg-violet-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl">
                          Paid ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {alertCount === 0 && (
                <EmptyCard icon="🎉" text="All clear — no active alerts" />
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

// ─── Waiter card ──────────────────────────────────────────────────────────────

function WaiterCard({
  waiter, palette, activeNotifs,
}: {
  waiter: WaiterStatus
  palette: typeof PALETTES[number]
  activeNotifs: WaiterNotif[]
}) {
  const dur      = shiftDuration(waiter.clockInTime)
  const myAlerts = activeNotifs.filter(n => n.tableId && waiter.assignedTables.some(t => t.id === n.tableId))

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 shadow-sm transition-all ${palette.card} ${myAlerts.length > 0 ? 'shadow-md ring-2 ' + palette.ring : ''}`}>
      {/* Top row: avatar + name + status */}
      <div className="flex items-center gap-3">
        <div className={`relative w-12 h-12 rounded-2xl ${palette.avatar} flex items-center justify-center shrink-0 shadow`}>
          <span className="text-white font-extrabold text-base">{initials(waiter.name)}</span>
          {/* Pulse dot */}
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{waiter.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${palette.chip}`}>{waiter.role}</span>
            {dur && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{dur}
              </span>
            )}
          </div>
        </div>
        {/* Alert badge */}
        {myAlerts.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center animate-pulse shrink-0">
            {myAlerts.length}
          </span>
        )}
      </div>

      {/* Assigned tables */}
      <div>
        {waiter.assignedTables.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No tables assigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {waiter.assignedTables.map(t => {
              const hasAlert = myAlerts.some(n => n.tableId === t.id)
              return (
                <span key={t.id} className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                  hasAlert ? 'bg-red-500 text-white animate-pulse' : palette.chip
                }`}>
                  T{t.tableNumber}{t.zone ? ` · ${t.zone}` : ''}
                  {hasAlert && <Bell className="w-3 h-3" />}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Active alert types */}
      {myAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {myAlerts.map(n => (
            <span key={n.orderId} className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              {n.type === 'call_waiter' ? '🔔 Call' : n.type === 'pay_cash' ? '💵 Cash' : '💳 Card'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="text-base">{icon}</span>
      <h2 className="font-extrabold text-gray-700 text-sm">{title}</h2>
      {count > 0 && (
        <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}
