'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { Bell, BellOff, ChefHat, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Kitchen Display',
    sub: 'Real-time order queue',
    newOrders: 'NEW ORDERS',
    cooking: 'COOKING',
    noNew: 'No pending orders',
    noCooking: 'Nothing cooking yet',
    accept: 'Accept — Start Cooking',
    ready: 'Ready — Notify Waiter',
    urgent: 'URGENT',
    seat: 'Seat',
    justNow: 'Just now',
    minAgo: (m: number) => `${m}m ago`,
    mute: 'Mute',
    unmute: 'Unmute',
    loading: 'Loading kitchen…',
  },
  ar: {
    title: 'شاشة المطبخ',
    sub: 'قائمة الطلبات اللحظية',
    newOrders: 'طلبات جديدة',
    cooking: 'قيد التحضير',
    noNew: 'لا يوجد طلبات معلقة',
    noCooking: 'لا يوجد طلبات قيد التحضير',
    accept: 'قبول — بدء التحضير',
    ready: 'جاهز — إشعار النادل',
    urgent: 'عاجل',
    seat: 'مقعد',
    justNow: 'الآن',
    minAgo: (m: number) => `منذ ${m} د`,
    mute: 'كتم',
    unmute: 'تشغيل',
    loading: 'جارٍ التحميل…',
  },
  fr: {
    title: 'Écran Cuisine',
    sub: "File d'attente en temps réel",
    newOrders: 'NOUVELLES COMMANDES',
    cooking: 'EN PRÉPARATION',
    noNew: 'Aucune commande en attente',
    noCooking: 'Rien en préparation',
    accept: 'Accepter — Commencer',
    ready: 'Prêt — Notifier le serveur',
    urgent: 'URGENT',
    seat: 'Place',
    justNow: "À l'instant",
    minAgo: (m: number) => `il y a ${m} min`,
    mute: 'Muet',
    unmute: 'Activer',
    loading: 'Chargement…',
  },
  es: {
    title: 'Cocina',
    sub: 'Cola de pedidos en tiempo real',
    newOrders: 'PEDIDOS NUEVOS',
    cooking: 'EN PREPARACIÓN',
    noNew: 'Sin pedidos pendientes',
    noCooking: 'Nada en preparación',
    accept: 'Aceptar — Empezar',
    ready: 'Listo — Notificar mesero',
    urgent: 'URGENTE',
    seat: 'Asiento',
    justNow: 'Ahora mismo',
    minAgo: (m: number) => `hace ${m} min`,
    mute: 'Silenciar',
    unmute: 'Activar',
    loading: 'Cargando…',
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

// ─── Audio (Web Audio API — no external file required) ───────────────────────

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const C = window.AudioContext || (window as any).webkitAudioContext
  return C ? new C() : null
}

function playTone(ctx: AudioContext, freq: number, start: number, duration = 0.2, vol = 0.45) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration + 0.05)
}

function playKitchenAlert() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    playTone(ctx, 1047, 0, 0.18, 0.5)   // C6
    playTone(ctx, 784,  0.22, 0.18, 0.4) // G5
    playTone(ctx, 1047, 0.44, 0.25, 0.5) // C6
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [tickets, setTickets]     = useState<KdsTicket[]>([])
  const [loading, setLoading]     = useState(true)
  const [cafeId, setCafeId]       = useState('')
  const [authed, setAuthed]       = useState(false)
  const [muted, setMuted]         = useState(false)
  const [lang, setLang]           = useState<Lang>('en')
  const [, setTick]               = useState(0)

  const socketRef      = useRef<Socket | null>(null)
  const deliveredIds   = useRef<Set<string>>(new Set())
  const alertOrderIds  = useRef<Set<string>>(new Set())
  const beepTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef       = useRef(false)

  const tr = T[lang]
  const isRTL = lang === 'ar'

  // ── keep mutedRef in sync ──────────────────────────────────────────────────
  useEffect(() => { mutedRef.current = muted }, [muted])

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      setCafeId(p.cafeId)
      setAuthed(true)
    } catch { window.location.href = '/login' }

    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') setLang(saved)
  }, [])

  // ── 30s clock tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── load active orders ────────────────────────────────────────────────────
  async function loadOrders() {
    const header = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
    const [pend, prep] = await Promise.all([
      fetch('/api/orders?status=PENDING',   { headers: header() }).then(r => r.ok ? r.json() : []),
      fetch('/api/orders?status=PREPARING', { headers: header() }).then(r => r.ok ? r.json() : []),
    ])
    const toTicket = (o: any, s: 'PENDING' | 'PREPARING'): KdsTicket => ({
      orderId:            o.id,
      cafeId:             o.cafeId,
      billingTableNumber: (o.originalTable ?? o.table)?.tableNumber ?? 0,
      mergeLabel:         `TABLE ${(o.originalTable ?? o.table)?.tableNumber ?? '?'}`,
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
      ...(pend  as any[]).map(o => toTicket(o, 'PENDING')),
      ...(prep  as any[]).map(o => toTicket(o, 'PREPARING')),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    setTickets(all)
    setLoading(false)
  }

  useEffect(() => { if (authed) loadOrders() }, [authed])

  // ── audio alert loop ──────────────────────────────────────────────────────
  function startBeepLoop() {
    if (beepTimerRef.current) return
    const fire = () => { if (!mutedRef.current && alertOrderIds.current.size > 0) playKitchenAlert() }
    fire()
    beepTimerRef.current = setInterval(fire, 3000)
  }

  function stopBeepLoopIfEmpty() {
    if (alertOrderIds.current.size === 0 && beepTimerRef.current) {
      clearInterval(beepTimerRef.current)
      beepTimerRef.current = null
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
        const next: KdsTicket = { ...ticket, status: 'PENDING' }
        return [...prev, next]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
    })

    socket.on('kds_order_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        deliveredIds.current.add(orderId)
        alertOrderIds.current.delete(orderId)
        stopBeepLoopIfEmpty()
        setTickets(prev => prev.filter(t => t.orderId !== orderId))
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

  // ── actions (HTTP API) ────────────────────────────────────────────────────
  async function accept(orderId: string) {
    alertOrderIds.current.delete(orderId)
    stopBeepLoopIfEmpty()
    // Optimistic update
    setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' } : t))
    try {
      await fetch(`/api/kitchen/orders/${orderId}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'preparing' }),
      })
    } catch {}
  }

  async function markReady(orderId: string) {
    deliveredIds.current.add(orderId)
    alertOrderIds.current.delete(orderId)
    stopBeepLoopIfEmpty()
    setTickets(prev => prev.filter(t => t.orderId !== orderId))
    try {
      await fetch(`/api/kitchen/orders/${orderId}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'ready' }),
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
      <header className="bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="font-extrabold text-lg leading-none">{tr.title}</h1>
            <p className="text-xs text-gray-400">{tr.sub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Counters */}
          <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full font-bold text-sm">
            {pending.length} {tr.newOrders.split(' ')[0]}
          </span>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold text-sm">
            {preparing.length} {tr.cooking.split(' ')[0]}
          </span>

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(m => !m)}
            className={`p-2 rounded-xl transition-all ${muted ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-amber-400'}`}
            title={muted ? tr.unmute : tr.mute}
          >
            {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </button>

          {/* Language selector */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1.5">
            {(['ar', 'en', 'fr', 'es'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg transition-all ${lang === l ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-65px)]">

        {/* PENDING */}
        <div className={`${isRTL ? 'border-l' : 'border-r'} border-gray-800 overflow-y-auto`}>
          <div className="sticky top-0 bg-red-950/80 backdrop-blur px-4 py-2.5 border-b border-red-900/40">
            <h2 className="font-bold text-red-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse inline-block" />
              {tr.newOrders} — {pending.length}
              {pending.length > 0 && alertOrderIds.current.size > 0 && !muted && (
                <span className="ml-auto text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                  <Bell className="w-3 h-3" /> ringing
                </span>
              )}
            </h2>
          </div>
          <div className="p-3 space-y-3">
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
          <div className="sticky top-0 bg-amber-950/80 backdrop-blur px-4 py-2.5 border-b border-amber-900/40">
            <h2 className="font-bold text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              {tr.cooking} — {preparing.length}
            </h2>
          </div>
          <div className="p-3 space-y-3">
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

// ─── TicketCard ───────────────────────────────────────────────────────────────

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
  const min      = elapsedMin(ticket.createdAt)
  // Wait-time urgency tiers
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
    <div className={`rounded-2xl border p-4 space-y-3 transition-all ${tierStyles[tier]}`}>

      {/* Header row */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
          action === 'accept' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {ticket.mergeLabel}{seatNum != null ? ` · ${seat} ${seatNum}` : ''}
        </span>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {tier === 'critical' && (
            <span className="text-sm text-red-400 font-bold animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {urgent}
            </span>
          )}
          <span className={`text-sm flex items-center gap-1.5 ${timerStyles[tier]}`}>
            <Clock className="w-4 h-4" />
            {min === 0 ? justNow : minAgo(min)}
          </span>
        </div>
      </div>

      {/* Items list — larger text for readability from distance */}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <span className={`text-base font-black w-9 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              tier === 'critical' ? 'bg-red-800 text-red-200'
              : tier === 'warning' ? 'bg-orange-800 text-orange-200'
              : 'bg-gray-700 text-white'
            }`}>
              {item.quantity}×
            </span>
            <div>
              <p className="text-base font-bold leading-tight">{item.productName}</p>
              {item.notes && <p className="text-sm text-amber-400 mt-0.5 font-medium">⚠ {item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      {/* Action button — larger for readability */}
      <button
        onClick={onAction}
        className={`w-full py-3.5 rounded-xl font-bold text-base active:scale-95 transition-all flex items-center justify-center gap-2 ${
          action === 'accept'
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {action === 'accept' ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {label}
      </button>
    </div>
  )
}

function KdsEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-16 text-gray-600">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="text-sm">{text}</p>
    </div>
  )
}
