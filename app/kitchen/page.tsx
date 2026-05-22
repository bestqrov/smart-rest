'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { Bell, BellOff, ChefHat, CheckCircle2, Clock, AlertTriangle, CheckCheck, XCircle } from 'lucide-react'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Kitchen Display',
    sub: 'Real-time order queue',
    newOrders: 'NEW',
    cooking: 'COOKING',
    noNew: 'No pending orders',
    noCooking: 'Nothing cooking yet',
    accept: 'Start',
    ready: 'Done',
    urgent: 'URGENT',
    seat: 'Seat',
    justNow: 'Now',
    minAgo: (m: number) => `${m}m`,
    mute: 'Mute',
    unmute: 'Unmute',
    loading: 'Loading kitchen…',
    completedToday: 'Completed',
    cancelledToday: 'Cancelled',
  },
  ar: {
    title: 'شاشة المطبخ',
    sub: 'قائمة الطلبات اللحظية',
    newOrders: 'جديد',
    cooking: 'تحضير',
    noNew: 'لا يوجد طلبات معلقة',
    noCooking: 'لا يوجد طلبات قيد التحضير',
    accept: 'بدء',
    ready: 'جاهز',
    urgent: 'عاجل',
    seat: 'مقعد',
    justNow: 'الآن',
    minAgo: (m: number) => `${m}د`,
    mute: 'كتم',
    unmute: 'تشغيل',
    loading: 'جارٍ التحميل…',
    completedToday: 'مكتملة',
    cancelledToday: 'ملغاة',
  },
  fr: {
    title: 'Écran Cuisine',
    sub: "File d'attente",
    newOrders: 'NOUV.',
    cooking: 'EN COURS',
    noNew: 'Aucune commande en attente',
    noCooking: 'Rien en préparation',
    accept: 'Démarrer',
    ready: 'Prêt',
    urgent: 'URGENT',
    seat: 'Place',
    justNow: 'Maintenant',
    minAgo: (m: number) => `${m}min`,
    mute: 'Muet',
    unmute: 'Activer',
    loading: 'Chargement…',
    completedToday: 'Terminées',
    cancelledToday: 'Annulées',
  },
  es: {
    title: 'Cocina',
    sub: 'Cola en tiempo real',
    newOrders: 'NUEVO',
    cooking: 'EN PREP.',
    noNew: 'Sin pedidos pendientes',
    noCooking: 'Nada en preparación',
    accept: 'Iniciar',
    ready: 'Listo',
    urgent: 'URGENTE',
    seat: 'Asiento',
    justNow: 'Ahora',
    minAgo: (m: number) => `${m}min`,
    mute: 'Silenciar',
    unmute: 'Activar',
    loading: 'Cargando…',
    completedToday: 'Completadas',
    cancelledToday: 'Canceladas',
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type KdsItem   = { productId: string; productName: string; quantity: number; notes: string | null }
type SeatGroup = { seatNumber: number | null; physicalTableNumber: number; items: KdsItem[] }
type KdsTicket = {
  orderId:            string
  cafeId:             string
  billingTableNumber: number
  mergeLabel:         string
  seatGroups:         SeatGroup[]
  totalPrice:         string
  createdAt:          string
  status:             'PENDING' | 'PREPARING'
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const C = window.AudioContext || (window as any).webkitAudioContext
  return C ? new C() : null
}

function playTone(ctx: AudioContext, freq: number, start: number, duration = 0.2, vol = 0.45) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'; osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration + 0.05)
}

function playKitchenAlert() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    playTone(ctx, 1047, 0, 0.18, 0.5)
    playTone(ctx, 784,  0.22, 0.18, 0.4)
    playTone(ctx, 1047, 0.44, 0.25, 0.5)
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''
const STALE_THRESHOLD_MIN = 90

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [tickets, setTickets]   = useState<KdsTicket[]>([])
  const [loading, setLoading]   = useState(true)
  const [cafeId,  setCafeId]    = useState('')
  const [authed,  setAuthed]    = useState(false)
  const [muted,   setMuted]     = useState(false)
  const [lang,    setLang]      = useState<Lang>('en')
  const [, setTick]             = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
  const [cancelledToday, setCancelledToday] = useState(0)

  const socketRef     = useRef<Socket | null>(null)
  const deliveredIds  = useRef<Set<string>>(new Set())
  const alertOrderIds = useRef<Set<string>>(new Set())
  const beepTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef      = useRef(false)

  const tr    = T[lang]
  const isRTL = lang === 'ar'

  useEffect(() => { mutedRef.current = muted }, [muted])

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      setCafeId(p.cafeId); setAuthed(true)
    } catch { window.location.href = '/login' }
    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') setLang(saved as Lang)
  }, [])

  // ── 30s clock tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── load active orders ────────────────────────────────────────────────────
  async function loadOrders() {
    const [pend, prep] = await Promise.all([
      fetch('/api/orders?status=PENDING',   { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch('/api/orders?status=PREPARING', { headers: authHeader() }).then(r => r.ok ? r.json() : []),
    ])
    const toTicket = (o: any, s: 'PENDING' | 'PREPARING'): KdsTicket => ({
      orderId:            o.id,
      cafeId:             o.cafeId,
      billingTableNumber: (o.originalTable ?? o.table)?.tableNumber ?? 0,
      mergeLabel:         `T${(o.originalTable ?? o.table)?.tableNumber ?? '?'}`,
      seatGroups: [{
        seatNumber:          o.seat?.seatNumber ?? null,
        physicalTableNumber: (o.originalTable ?? o.table)?.tableNumber ?? 0,
        items: o.items.map((i: any) => ({
          productId:   i.product?.id ?? '',
          productName: i.product?.nameEn ?? '',
          quantity:    i.quantity,
          notes:       i.notes ?? null,
        })),
      }],
      totalPrice: String(o.totalPrice),
      createdAt:  o.createdAt,
      status:     s,
    })
    const all = [
      ...(pend as any[]).map(o => toTicket(o, 'PENDING')),
      ...(prep as any[]).map(o => toTicket(o, 'PREPARING')),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    setTickets(all)
    setLoading(false)
  }

  // ── fetch daily counters ──────────────────────────────────────────────────
  async function loadDailyStats() {
    try {
      const res = await fetch('/api/kitchen/daily-stats', { headers: authHeader() })
      if (res.ok) {
        const d = await res.json()
        setCompletedToday(d.completed ?? 0)
        setCancelledToday(d.cancelled ?? 0)
      }
    } catch {}
  }

  useEffect(() => {
    if (!authed) return
    loadOrders()
    loadDailyStats()
  }, [authed])

  // ── hourly auto-clean: remove stale orders ────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setTickets(prev => prev.filter(ticket => {
        if (elapsedMin(ticket.createdAt) > STALE_THRESHOLD_MIN) {
          alertOrderIds.current.delete(ticket.orderId)
          return false
        }
        return true
      }))
      loadDailyStats()
    }, 3600000)
    return () => clearInterval(t)
  }, [])

  // ── audio alert loop ──────────────────────────────────────────────────────
  function startBeepLoop() {
    if (beepTimerRef.current) return
    const fire = () => { if (!mutedRef.current && alertOrderIds.current.size > 0) playKitchenAlert() }
    fire()
    beepTimerRef.current = setInterval(fire, 3000)
  }

  function stopBeepLoopIfEmpty() {
    if (alertOrderIds.current.size === 0 && beepTimerRef.current) {
      clearInterval(beepTimerRef.current); beepTimerRef.current = null
    }
  }

  // ── socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const token  = localStorage.getItem('token')
    const socket = socketIO(SOCKET_URL || window.location.origin, { auth: { token }, transports: ['polling', 'websocket'] })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join', `kds_room_${cafeId}`))

    socket.on('kds_new_order', (ticket: KdsTicket) => {
      if (deliveredIds.current.has(ticket.orderId)) return
      alertOrderIds.current.add(ticket.orderId)
      startBeepLoop()
      setTickets(prev => {
        if (prev.find(t => t.orderId === ticket.orderId)) return prev
        return [...prev, { ...ticket, status: 'PENDING' as const }]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
    })

    socket.on('kds_order_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        deliveredIds.current.add(orderId)
        alertOrderIds.current.delete(orderId)
        stopBeepLoopIfEmpty()
        setTickets(prev => prev.filter(t => t.orderId !== orderId))
        if (status === 'COMPLETED') setCompletedToday(n => n + 1)
        if (status === 'CANCELLED') setCancelledToday(n => n + 1)
      } else if (status === 'PREPARING') {
        alertOrderIds.current.delete(orderId)
        stopBeepLoopIfEmpty()
        setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' as const } : t))
      } else if (status === 'PENDING') {
        setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PENDING' as const } : t))
      }
    })

    return () => {
      socket.disconnect()
      if (beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null }
    }
  }, [authed, cafeId])

  // ── actions ───────────────────────────────────────────────────────────────
  async function accept(orderId: string) {
    alertOrderIds.current.delete(orderId)
    stopBeepLoopIfEmpty()
    setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' as const } : t))
    try {
      await fetch(`/api/kitchen/orders/${orderId}`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      })
    } catch {}
  }

  async function markReady(orderId: string) {
    deliveredIds.current.add(orderId)
    alertOrderIds.current.delete(orderId)
    stopBeepLoopIfEmpty()
    setTickets(prev => prev.filter(t => t.orderId !== orderId))
    setCompletedToday(n => n + 1)
    try {
      await fetch(`/api/kitchen/orders/${orderId}`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      })
    } catch {}
  }

  const pending   = tickets.filter(t => t.status === 'PENDING')
  const preparing = tickets.filter(t => t.status === 'PREPARING')

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <div className="text-5xl mb-3 animate-bounce">🍳</div>
        <p className="text-gray-400">{tr.loading}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-400" />
          <h1 className="font-extrabold text-base leading-none">{tr.title}</h1>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Live productivity counters */}
          <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCheck className="w-3.5 h-3.5" /> {completedToday} {tr.completedToday}
          </span>
          <span className="flex items-center gap-1 bg-red-500/15 text-red-300 border border-red-500/25 px-2.5 py-1 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" /> {cancelledToday} {tr.cancelledToday}
          </span>

          {/* Active queue counters */}
          <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2.5 py-1 rounded-full font-bold text-xs">
            {pending.length} {tr.newOrders}
          </span>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-bold text-xs">
            {preparing.length} {tr.cooking}
          </span>

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(m => !m)}
            className={`p-1.5 rounded-lg transition-all ${muted ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-amber-400'}`}
            title={muted ? tr.unmute : tr.mute}
          >
            {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {/* Language selector */}
          <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg px-1.5 py-1">
            {(['ar', 'en', 'fr', 'es'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
                className={`text-xs font-bold px-1.5 py-0.5 rounded-md transition-all ${lang === l ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-49px)]">

        {/* PENDING */}
        <div className={`${isRTL ? 'border-l' : 'border-r'} border-gray-800 overflow-y-auto`}>
          <div className="sticky top-0 bg-red-950/80 backdrop-blur px-3 py-2 border-b border-red-900/40">
            <h2 className="font-bold text-red-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
              {tr.newOrders} — {pending.length}
              {pending.length > 0 && alertOrderIds.current.size > 0 && !muted && (
                <span className="ml-auto text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                </span>
              )}
            </h2>
          </div>
          <div className="p-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
            {pending.length === 0 && <KdsEmpty icon="✅" text={tr.noNew} />}
            {pending.map(t => (
              <TicketCard
                key={t.orderId} ticket={t} action="accept"
                label={tr.accept} seat={tr.seat}
                justNow={tr.justNow} minAgo={tr.minAgo}
                urgent={tr.urgent} isRTL={isRTL}
                onAction={() => accept(t.orderId)}
              />
            ))}
          </div>
        </div>

        {/* PREPARING */}
        <div className="overflow-y-auto">
          <div className="sticky top-0 bg-amber-950/80 backdrop-blur px-3 py-2 border-b border-amber-900/40">
            <h2 className="font-bold text-amber-300 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              {tr.cooking} — {preparing.length}
            </h2>
          </div>
          <div className="p-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
            {preparing.length === 0 && <KdsEmpty icon="🍳" text={tr.noCooking} />}
            {preparing.map(t => (
              <TicketCard
                key={t.orderId} ticket={t} action="ready"
                label={tr.ready} seat={tr.seat}
                justNow={tr.justNow} minAgo={tr.minAgo}
                urgent={tr.urgent} isRTL={isRTL}
                onAction={() => markReady(t.orderId)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TicketCard (compact) ─────────────────────────────────────────────────────

function TicketCard({ ticket, action, label, seat, justNow, minAgo, urgent, isRTL, onAction }: {
  ticket:  KdsTicket
  action:  'accept' | 'ready'
  label:   string
  seat:    string
  justNow: string
  minAgo:  (m: number) => string
  urgent:  string
  isRTL:   boolean
  onAction: () => void
}) {
  const min  = elapsedMin(ticket.createdAt)
  const tier = min >= 12 ? 'critical' : min >= 7 ? 'warning' : min >= 4 ? 'caution' : 'fresh'
  const tierStyles = {
    fresh:    'bg-gray-900 border-gray-700',
    caution:  'bg-yellow-950/60 border-yellow-700/60',
    warning:  'bg-orange-950/70 border-orange-600 ring-1 ring-orange-500/40',
    critical: 'bg-red-950/80 border-red-500 ring-2 ring-red-500/60 animate-[pulse_2s_ease-in-out_infinite]',
  }
  const timerStyles = {
    fresh:    'text-gray-500',
    caution:  'text-yellow-400',
    warning:  'text-orange-400 font-bold',
    critical: 'text-red-400 font-bold animate-pulse',
  }
  const items   = ticket.seatGroups.flatMap(sg => sg.items)
  const seatNum = ticket.seatGroups[0]?.seatNumber

  return (
    <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${tierStyles[tier]}`}>

      {/* Header row */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          action === 'accept' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {ticket.mergeLabel}{seatNum != null ? ` · ${seat} ${seatNum}` : ''}
        </span>
        <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {tier === 'critical' && (
            <span className="text-xs text-red-400 font-bold animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {urgent}
            </span>
          )}
          <span className={`text-xs flex items-center gap-1 ${timerStyles[tier]}`}>
            <Clock className="w-3 h-3" />
            {min === 0 ? justNow : minAgo(min)}
          </span>
        </div>
      </div>

      {/* Items list */}
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <span className={`text-xs font-black w-7 h-6 rounded-md flex items-center justify-center shrink-0 ${
              tier === 'critical' ? 'bg-red-800 text-red-200'
              : tier === 'warning' ? 'bg-orange-800 text-orange-200'
              : 'bg-gray-700 text-white'
            }`}>
              {item.quantity}×
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">{item.productName}</p>
              {item.notes && <p className="text-xs text-amber-400 font-medium">⚠ {item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      {/* Action button */}
      <button
        onClick={onAction}
        className={`w-full py-2 rounded-lg font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
          action === 'accept'
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {action === 'accept' ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {label}
      </button>
    </div>
  )
}

function KdsEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12 text-gray-600 xl:col-span-2">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-xs">{text}</p>
    </div>
  )
}
