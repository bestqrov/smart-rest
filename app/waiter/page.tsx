'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Bell, CheckCircle2, Clock, Users, LogOut, WifiOff,
  ShoppingCart, Plus, Minus, Trash2, Send, ChefHat, Utensils,
} from 'lucide-react'
import { tr, getLang, setLang as saveLang, POS_LANGS, type Lang } from '../../src/lib/posI18n'

// ─── Colour palettes ──────────────────────────────────────────────────────────

const PALETTES = [
  { dot: 'bg-rose-500',    badge: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30' },
  { dot: 'bg-sky-500',     badge: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30' },
  { dot: 'bg-violet-500',  badge: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30' },
  { dot: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30' },
  { dot: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' },
  { dot: 'bg-fuchsia-500', badge: 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30' },
  { dot: 'bg-orange-500',  badge: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30' },
  { dot: 'bg-teal-500',    badge: 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30' },
  { dot: 'bg-indigo-500',  badge: 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30' },
  { dot: 'bg-pink-500',    badge: 'bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/30' },
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
type BillRequest = { id: string; tableId: string; tableNumber?: number; seatNumbers?: number[]; payScope?: string; message?: string | null; createdAt: string }
type NewOrder    = { orderId: string; mergeLabel: string; totalPrice: string; createdAt: string }
type WaiterStatus = {
  id: string; name: string; role: string
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  assignedTables: { id: string; tableNumber: number; zone?: string | null }[]
}

// ─── Notification config ──────────────────────────────────────────────────────

const NOTIF_META: Record<NotifType, { emoji: string; label: string; border: string; glow: string; btn: string }> = {
  call_waiter: {
    emoji: '🔔', label: 'Call Waiter',
    border: 'border-l-amber-400',
    glow:   'shadow-amber-500/20',
    btn:    'bg-amber-500 hover:bg-amber-400',
  },
  pay_cash: {
    emoji: '💵', label: 'Cash Payment',
    border: 'border-l-red-400',
    glow:   'shadow-red-500/20',
    btn:    'bg-red-500 hover:bg-red-400',
  },
  pay_tpe: {
    emoji: '💳', label: 'Card Payment',
    border: 'border-l-violet-400',
    glow:   'shadow-violet-500/20',
    btn:    'bg-violet-500 hover:bg-violet-400',
  },
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
      gain.gain.setValueAtTime(0.3, t)
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
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); const rm = m % 60
  return rm > 0 ? `${h}h${rm}m` : `${h}h`
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

// ─── Menu types ───────────────────────────────────────────────────────────────

type MenuProduct = { id: string; nameEn: string; nameAr: string; nameFr: string; price: number }
type MenuCat     = { id: string; nameEn: string; nameAr: string; products: MenuProduct[] }
type CartItem    = { productId: string; name: string; price: number; qty: number }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const [lang, setLangState] = useState<Lang>('ar')
  useEffect(() => { setLangState(getLang()) }, [])
  const L = (key: Parameters<typeof tr>[0]) => tr(key, lang)

  const [authed,    setAuthed]    = useState(false)
  const [isPOS,     setIsPOS]     = useState(false)
  const [cafeId,    setCafeId]    = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState('WAITER')
  const [connected, setConnected] = useState(false)
  const [cafeInfo,  setCafeInfo]  = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null })

  const [waiters,       setWaiters]       = useState<WaiterStatus[]>([])
  const [notifications, setNotifications] = useState<WaiterNotif[]>([])
  const [ready,         setReady]         = useState<ReadyOrder[]>([])
  const [newOrders,     setNewOrders]     = useState<NewOrder[]>([])
  const [legacyCalls,   setLegacyCalls]   = useState<LegacyCall[]>([])
  const [bills,         setBills]         = useState<BillRequest[]>([])

  const [tab,  setTab]  = useState<'alerts' | 'team' | 'order'>('alerts')
  const [, setTick]     = useState(0)

  // order tab
  const [menuCats,        setMenuCats]        = useState<MenuCat[]>([])
  const [activeCat,       setActiveCat]       = useState('')
  const [orderTable,      setOrderTable]      = useState<{ id: string; tableNumber: number } | null>(null)
  const [orderCart,       setOrderCart]       = useState<CartItem[]>([])
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderDone,       setOrderDone]       = useState(false)
  const [orderErr,        setOrderErr]        = useState('')

  const tokenRef   = useRef('')
  const socketRef  = useRef<Socket | null>(null)
  const beepRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifsRef  = useRef<WaiterNotif[]>([])

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

    // Fetch cafe name + logo via public menu API
    const subdomain = localStorage.getItem('subdomain') || localStorage.getItem('posLastSubdomain')
    if (subdomain) {
      fetch(`/api/menu/public?sub=${subdomain}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          setCafeInfo({
            name:    d.cafeName || d.name || '',
            logoUrl: d.logoSquareUrl || d.logoUrl || null,
          })
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

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

  const loadReady = useCallback(async () => {
    const ep = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
    const data = await fetch(ep, { headers: authHeader() }).then(r => r.ok ? r.json() : [])
    setReady((data as ReadyOrder[]).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }, [isPOS])

  useEffect(() => { if (authed) loadReady() }, [authed, loadReady])

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

  // ── socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token: tokenRef.current }, transports: ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect',       () => { setConnected(true); socket.emit('join', `room_${cafeId}`) })
    socket.on('disconnect',    () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('waiter_notification', (data: Omit<WaiterNotif, 'receivedAt'>) => {
      vibrate()
      const n: WaiterNotif = { ...data, receivedAt: new Date().toISOString() }
      setNotifications(prev => [n, ...prev.filter(x => x.orderId !== data.orderId)])
      startBeepLoop(data.type)
      // only switch to alerts if waiter is on team/order tab and not mid-order
    })

    socket.on('waiter_notification_acked', ({ orderId }: { orderId: string }) => {
      setNotifications(prev => prev.map(n => n.orderId === orderId ? { ...n, isActive: false } : n))
      stopBeepIfQuiet()
    })

    socket.on('waiter_order_ready', () => {
      vibrate(); playReadyChime()
      loadReady()
    })

    socket.on('new_order', (o: { orderId: string; mergeLabel: string; totalPrice: string }) => {
      vibrate()
      setNewOrders(prev => [{ ...o, createdAt: new Date().toISOString() }, ...prev.filter(x => x.orderId !== o.orderId)])
    })

    socket.on('waiter_called', (c: LegacyCall) => {
      vibrate()
      setLegacyCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
    })
    socket.on('waiter_acknowledged', ({ id }: { id: string }) =>
      setLegacyCalls(prev => prev.filter(c => c.id !== id))
    )

    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
    })

    socket.on('order_status_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
      }
    })

    socket.on('table_assigned', () => loadWaiters())
    socket.on('table_released', () => loadWaiters())

    return () => {
      socket.disconnect()
      if (beepRef.current) { clearInterval(beepRef.current); beepRef.current = null }
    }
  }, [authed, cafeId, isPOS, vibrate, loadReady, loadWaiters])

  // ── actions ────────────────────────────────────────────────────────────────
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

  async function openOrderTab() {
    setTab('order'); setOrderDone(false); setOrderErr('')
    if (menuCats.length > 0) return
    try {
      const res = await fetch('/api/pos/menu', { headers: authHeader() })
      if (res.ok) { const d = await res.json(); setMenuCats(d.categories ?? []); setActiveCat(d.categories?.[0]?.id ?? '') }
    } catch {}
  }

  function addToCart(p: MenuProduct) {
    setOrderCart(prev => {
      const ex = prev.find(c => c.productId === p.id)
      if (ex) return prev.map(c => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { productId: p.id, name: p.nameEn || p.nameAr, price: p.price, qty: 1 }]
    })
  }

  function updateCartQty(productId: string, delta: number) {
    setOrderCart(prev => prev.map(c => c.productId === productId ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0))
  }

  async function submitOrder() {
    if (!orderTable || orderCart.length === 0 || !isPOS) return
    setOrderSubmitting(true); setOrderErr('')
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: orderTable.id, items: orderCart.map(c => ({ productId: c.productId, quantity: c.qty })), paymentMethod: 'CASH' }),
      })
      if (!res.ok) { const d = await res.json(); setOrderErr(d.error ?? 'Failed'); return }
      setOrderCart([]); setOrderTable(null); setOrderDone(true)
      setTimeout(() => setOrderDone(false), 3000)
    } catch { setOrderErr('Network error') }
    finally { setOrderSubmitting(false) }
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const activeNotifs  = notifications.filter(n => n.isActive)
  const alertCount    = activeNotifs.length + ready.length + newOrders.length + legacyCalls.length + bills.length
  const activeWaiters = waiters.filter(w => w.shiftStatus === 'ACTIVE')
  const offWaiters    = waiters.filter(w => w.shiftStatus === 'OFF_DUTY')
  const selfWaiter    = waiters.find(w => w.name === staffName) ?? null
  const selfTables    = selfWaiter?.assignedTables ?? []
  const cartTotal     = orderCart.reduce((s, c) => s + c.price * c.qty, 0)
  const cartQty       = orderCart.reduce((s, c) => s + c.qty, 0)

  // Shift clock
  const clockInIso   = selfWaiter?.clockInTime ?? null
  const shiftMinutes = clockInIso
    ? Math.floor((Date.now() - new Date(clockInIso).getTime()) / 60000)
    : 0
  const clockInStr   = clockInIso
    ? new Date(clockInIso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null
  const passation    = shiftMinutes >= 450  // warn after 7h 30m

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes notif-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .notif-dot { animation: notif-pulse 1.2s ease-in-out infinite }
      `}</style>

      <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden text-white">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="shrink-0 bg-[#111118] border-b border-white/5">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Left: cafe logo + name + waiter */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {cafeInfo.logoUrl
                  ? <Image src={cafeInfo.logoUrl} alt="logo" width={40} height={40} className="w-full h-full object-cover" />
                  : <Utensils className="w-4 h-4 text-emerald-400" />
                }
              </div>
              <div className="min-w-0">
                {cafeInfo.name && (
                  <p className="text-[11px] text-gray-500 font-medium truncate leading-none mb-0.5">{cafeInfo.name}</p>
                )}
                <p className="font-bold text-sm text-white leading-none truncate">
                  {staffName || 'Waiter'}
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">
                    {staffRole}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {clockInStr && (
                    <span className="text-[11px] text-gray-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {clockInStr} · {shiftDuration(clockInIso)}
                    </span>
                  )}
                  {connected
                    ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    : <WifiOff className="w-3 h-3 text-red-400" />
                  }
                </div>
              </div>
            </div>

            {/* Right: lang + logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex gap-0.5">
                {POS_LANGS.map(l => (
                  <button key={l.code} onClick={() => { saveLang(l.code); setLangState(l.code) }}
                    className={`w-7 h-7 rounded-lg text-sm transition-all ${lang === l.code ? 'bg-white/15' : 'text-gray-600 hover:text-gray-400'}`}>
                    {l.flag}
                  </button>
                ))}
              </div>
              <button onClick={logout}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all text-gray-400">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Passation banner — shown after 7h30m on shift */}
          {passation && (
            <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
              <span className="text-base shrink-0">⚑</span>
              <p className="text-xs text-amber-300 font-medium">
                Passation recommandée — {shiftDuration(clockInIso)} de service · Briefer votre collègue avant de partir
              </p>
            </div>
          )}
        </header>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

            {/* ════ ALERTS TAB ════ */}
            {tab === 'alerts' && (
              <>
                {/* Active notifications — urgent */}
                {activeNotifs.length > 0 && (
                  <div className="space-y-2">
                    <Label text="Urgent" count={activeNotifs.length} urgent />
                    {activeNotifs.slice(0, 6).map(n => {
                      const m = NOTIF_META[n.type]
                      return (
                        <div key={n.orderId}
                          className={`bg-[#141420] border border-white/8 border-l-4 ${m.border} rounded-2xl p-4 flex items-center gap-3 shadow-lg ${m.glow}`}>
                          <span className="notif-dot text-2xl shrink-0">{m.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm">Table {n.tableNumber ?? '?'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{m.label} · {elapsed(n.receivedAt)}</p>
                          </div>
                          <button onClick={() => ackNotification(n.orderId)}
                            className={`shrink-0 ${m.btn} text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all`}>
                            On my way ✓
                          </button>
                        </div>
                      )
                    })}
                    {activeNotifs.length > 6 && (
                      <p className="text-center text-xs text-gray-600 py-1">+{activeNotifs.length - 6} more notifications</p>
                    )}
                  </div>
                )}

                {/* Ready to serve */}
                {ready.length > 0 && (
                  <div className="space-y-2">
                    <Label text="Ready to Serve" count={ready.length} />
                    {ready.map(order => {
                      const tableNum = (order.originalTable ?? order.table)?.tableNumber
                      return (
                        <div key={order.id} className="bg-[#141420] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-4 h-4 text-emerald-400" />
                              <span className="font-bold text-emerald-300 text-sm">Table {tableNum ?? '?'}</span>
                              {order.seat && <span className="text-xs text-gray-500">· Seat {order.seat.seatNumber}</span>}
                            </div>
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{elapsed(order.createdAt)}
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {order.items.map(item => (
                              <li key={item.id} className="text-sm text-gray-300 flex items-center gap-2">
                                <span className="text-emerald-500 font-bold">{item.quantity}×</span>
                                {item.product.nameEn}
                              </li>
                            ))}
                          </ul>
                          <button onClick={() => markServed(order.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Served ✓
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* New orders */}
                {newOrders.length > 0 && (
                  <div className="space-y-2">
                    <Label text="New Orders" count={newOrders.length} />
                    {newOrders.map(o => (
                      <div key={o.orderId} className="bg-[#141420] border border-sky-500/20 rounded-2xl p-4 flex items-center gap-3">
                        <span className="text-2xl shrink-0">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{o.mergeLabel}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{o.totalPrice} · {elapsed(o.createdAt)}</p>
                        </div>
                        <button onClick={() => setNewOrders(prev => prev.filter(x => x.orderId !== o.orderId))}
                          className="shrink-0 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          Got it ✓
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Customer calls */}
                {legacyCalls.length > 0 && (
                  <div className="space-y-2">
                    <Label text="Customer Calls" count={legacyCalls.length} />
                    {legacyCalls.map(c => (
                      <div key={c.id} className="bg-[#141420] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
                        <span className="text-2xl shrink-0">
                          {c.type === 'WATER' ? '🧊' : c.type === 'CLEAN' ? '🧹' : '📣'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">Table {c.tableNumber ?? '?'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{c.type}{c.message ? ` · ${c.message}` : ''} · {elapsed(c.createdAt)}</p>
                        </div>
                        <button onClick={() => ackLegacyCall(c.id)}
                          className="shrink-0 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          Done ✓
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bill requests */}
                {bills.length > 0 && (
                  <div className="space-y-2">
                    <Label text="Bill Requests" count={bills.length} />
                    {bills.map(b => (
                      <div key={b.id} className="bg-[#141420] border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3">
                        <span className="text-2xl shrink-0">🧾</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">Table {b.tableNumber ?? '?'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {b.payScope === 'SEATS' && b.seatNumbers?.length
                              ? `Seats ${b.seatNumbers.join(', ')}`
                              : 'Whole table'
                            } · {elapsed(b.createdAt)}
                          </p>
                        </div>
                        <button onClick={() => setBills(prev => prev.filter(x => x.id !== b.id))}
                          className="shrink-0 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                          Paid ✓
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {alertCount === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="font-bold text-gray-300">All clear</p>
                    <p className="text-sm text-gray-600 mt-1">No active alerts</p>
                  </div>
                )}
              </>
            )}

            {/* ════ TEAM TAB ════ */}
            {tab === 'team' && (
              <>
                {activeWaiters.length > 0 && (
                  <div className="space-y-2">
                    <Label text="On Duty" count={activeWaiters.length} />
                    {activeWaiters.map(w => {
                      const p    = PALETTES[waiters.indexOf(w) % PALETTES.length]
                      const myA  = activeNotifs.filter(n => n.tableId && w.assignedTables.some(t => t.id === n.tableId))
                      const dur  = shiftDuration(w.clockInTime)
                      return (
                        <div key={w.id} className={`bg-[#141420] border rounded-2xl p-4 space-y-3 ${myA.length > 0 ? 'border-red-500/40' : 'border-white/8'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`relative w-10 h-10 rounded-xl ${p.dot} flex items-center justify-center shrink-0`}>
                              <span className="text-white font-black text-xs">{initials(w.name)}</span>
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-[#141420] rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{w.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.badge}`}>{w.role}</span>
                                {dur && <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{dur}</span>}
                              </div>
                            </div>
                            {myA.length > 0 && (
                              <span className="w-6 h-6 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center animate-pulse shrink-0">
                                {myA.length}
                              </span>
                            )}
                          </div>
                          {w.assignedTables.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {w.assignedTables.map(t => {
                                const hasA = myA.some(n => n.tableId === t.id)
                                return (
                                  <span key={t.id} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${hasA ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-white/8 text-gray-400'}`}>
                                    T{t.tableNumber}{t.zone ? ` · ${t.zone}` : ''}{hasA ? ' 🔔' : ''}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600 italic">No tables assigned</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {offWaiters.length > 0 && (
                  <div className="space-y-2">
                    <Label text="Off Duty" count={offWaiters.length} />
                    <div className="grid grid-cols-2 gap-2">
                      {offWaiters.map(w => {
                        const p = PALETTES[waiters.indexOf(w) % PALETTES.length]
                        return (
                          <div key={w.id} className="bg-[#141420] border border-white/5 rounded-2xl p-3 flex items-center gap-2.5 opacity-50">
                            <div className={`w-8 h-8 rounded-lg ${p.dot} flex items-center justify-center shrink-0`}>
                              <span className="text-white font-black text-[10px]">{initials(w.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-white truncate">{w.name}</p>
                              <p className="text-[10px] text-gray-600">{w.role}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {waiters.length === 0 && (
                  <div className="text-center py-16">
                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                    <p className="text-gray-500 text-sm">No staff data — log in with POS token</p>
                  </div>
                )}
              </>
            )}

            {/* ════ ORDER TAB ════ */}
            {tab === 'order' && (
              <>
                {orderDone ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <p className="font-bold text-xl text-emerald-300">{L('order_sent')}</p>
                    <button onClick={() => { setOrderDone(false); setOrderTable(null) }}
                      className="mt-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                      + New Order
                    </button>
                  </div>
                ) : !orderTable ? (
                  <div className="space-y-2">
                    <Label text="Select Table" count={selfTables.length} />
                    {selfTables.length === 0 ? (
                      <div className="text-center py-12 text-gray-600">
                        <p className="text-sm">No tables assigned</p>
                        <p className="text-xs mt-1">Ask your supervisor</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {selfTables.map(t => (
                          <button key={t.id} onClick={() => setOrderTable(t)}
                            className="bg-[#141420] border border-white/10 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center gap-1 transition-all active:scale-95">
                            <span className="text-2xl font-black text-white">{t.tableNumber}</span>
                            <span className="text-[10px] text-gray-600">Table</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Table banner */}
                    <div className="flex items-center justify-between bg-emerald-600/20 border border-emerald-500/30 rounded-2xl px-4 py-3">
                      <span className="font-black text-emerald-300">Table {orderTable.tableNumber}</span>
                      <button onClick={() => { setOrderTable(null); setOrderCart([]) }}
                        className="text-xs bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl font-bold text-gray-300 transition-all">
                        ← Change
                      </button>
                    </div>

                    {/* Category tabs */}
                    {menuCats.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {menuCats.map(cat => (
                          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                              activeCat === cat.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                            }`}>
                            {lang === 'ar' ? (cat.nameAr || cat.nameEn) : cat.nameEn}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Product grid */}
                    {menuCats.length === 0 ? (
                      <div className="text-center py-8 text-gray-600">
                        <p className="text-sm">Loading menu…</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {(menuCats.find(c => c.id === activeCat)?.products ?? []).map(p => {
                          const inCart = orderCart.find(c => c.productId === p.id)
                          return (
                            <button key={p.id} onClick={() => addToCart(p)}
                              className={`bg-[#141420] rounded-2xl border p-3 flex flex-col gap-2 text-left transition-all active:scale-95 ${
                                inCart ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/8 hover:border-white/20'
                              }`}>
                              <p className="font-bold text-white text-xs leading-snug">
                                {lang === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-400">{p.price} MAD</span>
                                {inCart && (
                                  <span className="bg-emerald-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                                    {inCart.qty}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Cart */}
                    {orderCart.length > 0 && (
                      <div className="bg-[#141420] border border-white/10 rounded-2xl p-4 space-y-3">
                        <p className="font-bold text-sm text-white flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-emerald-400" />
                          {cartQty} item{cartQty !== 1 ? 's' : ''} · {cartTotal.toFixed(2)} MAD
                        </p>
                        <div className="space-y-2 max-h-44 overflow-y-auto">
                          {orderCart.map(c => (
                            <div key={c.productId} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-200 truncate">{c.name}</p>
                                <p className="text-xs text-gray-600">{c.price} × {c.qty} = {(c.price * c.qty).toFixed(2)} MAD</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => updateCartQty(c.productId, -1)}
                                  className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center active:scale-90 transition-all">
                                  {c.qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-gray-400" />}
                                </button>
                                <span className="w-6 text-center font-bold text-sm text-white">{c.qty}</span>
                                <button onClick={() => updateCartQty(c.productId, 1)}
                                  className="w-7 h-7 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg flex items-center justify-center active:scale-90 transition-all">
                                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {orderErr && <p className="text-sm text-red-400">{orderErr}</p>}
                        <button onClick={submitOrder} disabled={orderSubmitting}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                          {orderSubmitting
                            ? <span>Sending…</span>
                            : <><Send className="w-4 h-4" />{L('submit_order')}</>
                          }
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </main>

        {/* ── Bottom nav ─────────────────────────────────────────────────── */}
        <nav className="shrink-0 fixed bottom-0 left-0 right-0 bg-[#0f0f18]/95 backdrop-blur border-t border-white/8 flex flex-col safe-bottom">
          <p className="text-center text-[9px] text-gray-800 font-medium pt-1.5 select-none tracking-wide">
            Powered by <span className="text-gray-700">SmartRestau</span>
          </p>
          <div className="flex">
          {([
            {
              id: 'alerts' as const,
              icon: <Bell className="w-5 h-5" />,
              label: 'Alerts',
              badge: alertCount,
            },
            {
              id: 'team' as const,
              icon: <Users className="w-5 h-5" />,
              label: 'Team',
              badge: activeWaiters.length,
            },
            {
              id: 'order' as const,
              icon: <ShoppingCart className="w-5 h-5" />,
              label: 'Order',
              badge: cartQty,
            },
          ] as const).map(item => (
            <button key={item.id}
              onClick={() => item.id === 'order' ? openOrderTab() : setTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all relative ${
                tab === item.id ? 'text-white' : 'text-gray-600 hover:text-gray-400'
              }`}>
              <div className="relative">
                {item.icon}
                {item.badge > 0 && (
                  <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 text-[10px] font-black rounded-full flex items-center justify-center px-1 ${
                    item.id === 'alerts' && alertCount > 0
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {tab === item.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </button>
          ))}
          </div>
        </nav>

      </div>
    </>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ text, count, urgent }: { text: string; count: number; urgent?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1">
      <span className={`text-xs font-black uppercase tracking-widest ${urgent ? 'text-red-400' : 'text-gray-600'}`}>{text}</span>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-500/20 text-red-400' : 'bg-white/8 text-gray-500'}`}>
          {count}
        </span>
      )}
    </div>
  )
}
