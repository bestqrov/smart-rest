'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { Bell, BellOff, ChefHat, CheckCircle2, Clock, AlertTriangle, CheckCheck, XCircle, CalendarClock, Users, Phone, Check, X } from 'lucide-react'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Kitchen Display',
    sub: 'Real-time order queue',
    newOrders: 'NEW',
    cooking: 'COOKING',
    reservations: 'BOOKINGS',
    noNew: 'No pending orders',
    noCooking: 'Nothing cooking yet',
    noReservations: 'No pending reservations',
    accept: 'START COOKING',
    ready: 'DONE',
    resAccept: 'Accept',
    resCancel: 'Cancel',
    urgent: 'URGENT',
    seat: 'Seat',
    guests: 'guests',
    justNow: 'Now',
    minAgo: (m: number) => `${m}m`,
    mute: 'Mute',
    unmute: 'Unmute',
    loading: 'Loading kitchen…',
    completedToday: 'Done',
    cancelledToday: 'Cancelled',
    selectOrder: 'Select an order',
    selectOrderSub: 'Tap a ticket on the left to see details',
  },
  ar: {
    title: 'شاشة المطبخ',
    sub: 'قائمة الطلبات اللحظية',
    newOrders: 'جديد',
    cooking: 'تحضير',
    reservations: 'حجوزات',
    noNew: 'لا يوجد طلبات معلقة',
    noCooking: 'لا يوجد طلبات قيد التحضير',
    noReservations: 'لا يوجد حجوزات معلقة',
    accept: 'بدء التحضير',
    ready: 'جاهز',
    resAccept: 'قبول',
    resCancel: 'رفض',
    urgent: 'عاجل',
    seat: 'مقعد',
    guests: 'أشخاص',
    justNow: 'الآن',
    minAgo: (m: number) => `${m}د`,
    mute: 'كتم',
    unmute: 'تشغيل',
    loading: 'جارٍ التحميل…',
    completedToday: 'مكتملة',
    cancelledToday: 'ملغاة',
    selectOrder: 'اختر طلباً',
    selectOrderSub: 'اضغط على تذكرة لعرض التفاصيل',
  },
  fr: {
    title: 'Écran Cuisine',
    sub: "File d'attente",
    newOrders: 'NOUV.',
    cooking: 'EN COURS',
    reservations: 'RÉSERV.',
    noNew: 'Aucune commande en attente',
    noCooking: 'Rien en préparation',
    noReservations: 'Aucune réservation en attente',
    accept: 'DÉMARRER',
    ready: 'TERMINÉ',
    resAccept: 'Accepter',
    resCancel: 'Annuler',
    urgent: 'URGENT',
    seat: 'Place',
    guests: 'pers.',
    justNow: 'Maintenant',
    minAgo: (m: number) => `${m}min`,
    mute: 'Muet',
    unmute: 'Activer',
    loading: 'Chargement…',
    completedToday: 'Terminées',
    cancelledToday: 'Annulées',
    selectOrder: 'Sélectionner',
    selectOrderSub: 'Appuyez sur un ticket pour voir les détails',
  },
  es: {
    title: 'Cocina',
    sub: 'Cola en tiempo real',
    newOrders: 'NUEVO',
    cooking: 'EN PREP.',
    reservations: 'RESERVAS',
    noNew: 'Sin pedidos pendientes',
    noCooking: 'Nada en preparación',
    noReservations: 'Sin reservas pendientes',
    accept: 'INICIAR',
    ready: 'LISTO',
    resAccept: 'Aceptar',
    resCancel: 'Cancelar',
    urgent: 'URGENTE',
    seat: 'Asiento',
    guests: 'pers.',
    justNow: 'Ahora',
    minAgo: (m: number) => `${m}min`,
    mute: 'Silenciar',
    unmute: 'Activar',
    loading: 'Cargando…',
    completedToday: 'Completadas',
    cancelledToday: 'Canceladas',
    selectOrder: 'Seleccionar',
    selectOrderSub: 'Toca un ticket para ver detalles',
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

type Reservation = {
  id:        string
  name:      string
  phone:     string
  guests:    number
  date:      string
  notes:     string
  status:    'PENDING' | 'ACCEPTED' | 'CANCELLED'
  createdAt: string
}

type ActiveTab = 'orders' | 'reservations'

// ─── Audio ────────────────────────────────────────────────────────────────────

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const C = window.AudioContext || (window as any).webkitAudioContext
  return C ? new C() : null
}
function playTone(ctx: AudioContext, freq: number, start: number, duration = 0.2, vol = 0.45) {
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'; osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
  osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + duration + 0.05)
}
function playKitchenAlert() {
  try {
    const ctx = getAudioCtx(); if (!ctx) return
    playTone(ctx, 1047, 0, 0.18, 0.5); playTone(ctx, 784, 0.22, 0.18, 0.4); playTone(ctx, 1047, 0.44, 0.25, 0.5)
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedMin(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 60000) }
function elapsedSec(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 1000) }
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''
const STALE_THRESHOLD_MIN = 90

// ─── Digital Timer ────────────────────────────────────────────────────────────

function DigitalTimer({ iso, tier }: { iso: string; tier: string }) {
  const [sec, setSec] = useState(elapsedSec(iso))
  useEffect(() => {
    const t = setInterval(() => setSec(elapsedSec(iso)), 1000)
    return () => clearInterval(t)
  }, [iso])
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  const color = tier === 'critical' ? '#f87171' : tier === 'warning' ? '#fb923c' : tier === 'caution' ? '#facc15' : '#94a3b8'
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 72, fontWeight: 900, color, letterSpacing: 4, lineHeight: 1, textShadow: `0 0 24px ${color}55` }}>
      {String(mm).padStart(2,'0')}
      <span style={{ opacity: sec % 2 === 0 ? 1 : 0.3, transition: 'opacity 0.1s' }}>:</span>
      {String(ss).padStart(2,'0')}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [tickets, setTickets]           = useState<KdsTicket[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [activeTab, setActiveTab]       = useState<ActiveTab>('orders')
  const [loading, setLoading]           = useState(true)
  const [cafeId, setCafeId]             = useState('')
  const [authed, setAuthed]             = useState(false)
  const [muted, setMuted]               = useState(false)
  const [lang, setLang]                 = useState<Lang>('en')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [, setTick]                     = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
  const [cancelledToday, setCancelledToday] = useState(0)
  const [newReservationAlert, setNewReservationAlert] = useState(false)
  const [cafeLogoUrl, setCafeLogoUrl]       = useState<string | null>(null)
  const [cafeName, setCafeName]             = useState('')

  const socketRef     = useRef<Socket | null>(null)
  const deliveredIds  = useRef<Set<string>>(new Set())
  const alertOrderIds = useRef<Set<string>>(new Set())
  const beepTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef      = useRef(false)

  const tr    = T[lang]
  const isRTL = lang === 'ar'

  useEffect(() => { mutedRef.current = muted }, [muted])

  // boot
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      setCafeId(p.cafeId); setAuthed(true)
    } catch { window.location.href = '/login'; return }
    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') setLang(saved as Lang)
    // Fetch cafe branding for logo display
    const tok = token
    ;(async () => {
      try {
        const r = await fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${tok}` } })
        if (r.ok) { const d = await r.json(); setCafeLogoUrl(d.logoUrl ?? null); setCafeName(d.businessName || d.name || '') }
      } catch {}
    })()
  }, [])

  // 30s clock tick
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

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

  async function loadReservations() {
    try {
      const res = await fetch('/api/kitchen/reservations', { headers: authHeader() })
      if (res.ok) setReservations(await res.json())
    } catch {}
  }

  async function loadDailyStats() {
    try {
      const res = await fetch('/api/kitchen/daily-stats', { headers: authHeader() })
      if (res.ok) { const d = await res.json(); setCompletedToday(d.completed ?? 0); setCancelledToday(d.cancelled ?? 0) }
    } catch {}
  }

  useEffect(() => { if (!authed) return; loadOrders(); loadDailyStats(); loadReservations() }, [authed])

  useEffect(() => {
    const t = setInterval(() => {
      setTickets(prev => prev.filter(ticket => {
        if (elapsedMin(ticket.createdAt) > STALE_THRESHOLD_MIN) { alertOrderIds.current.delete(ticket.orderId); return false }
        return true
      }))
      loadDailyStats()
    }, 3600000)
    return () => clearInterval(t)
  }, [])

  function startBeepLoop() {
    if (beepTimerRef.current) return
    const fire = () => { if (!mutedRef.current && alertOrderIds.current.size > 0) playKitchenAlert() }
    fire(); beepTimerRef.current = setInterval(fire, 3000)
  }
  function stopBeepLoopIfEmpty() {
    if (alertOrderIds.current.size === 0 && beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null }
  }

  // socket
  useEffect(() => {
    if (!authed || !cafeId) return
    const token  = localStorage.getItem('token')
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token }, transports: ['polling', 'websocket'],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000, reconnectionDelayMax: 10000,
    })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('join', `kds_room_${cafeId}`))
    socket.on('reconnect', () => socket.emit('join', `kds_room_${cafeId}`))
    socket.on('kds_new_order', (ticket: KdsTicket) => {
      if (deliveredIds.current.has(ticket.orderId)) return
      alertOrderIds.current.add(ticket.orderId); startBeepLoop()
      setTickets(prev => {
        if (prev.find(t => t.orderId === ticket.orderId)) return prev
        return [...prev, { ...ticket, status: 'PENDING' as const }]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
    })
    socket.on('reservation_new', (res: Reservation) => {
      setReservations(prev => [res, ...prev]); setNewReservationAlert(true)
      if (!mutedRef.current) playKitchenAlert()
    })
    socket.on('reservation_updated', ({ id, status }: { id: string; status: string }) => {
      setReservations(prev => prev.filter(r => r.id !== id || status === 'ACCEPTED')
        .map(r => r.id === id ? { ...r, status: status as Reservation['status'] } : r))
    })
    socket.on('kds_order_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        deliveredIds.current.add(orderId); alertOrderIds.current.delete(orderId); stopBeepLoopIfEmpty()
        setTickets(prev => prev.filter(t => t.orderId !== orderId))
        setSelectedId(prev => prev === orderId ? null : prev)
        if (status === 'COMPLETED') setCompletedToday(n => n + 1)
        if (status === 'CANCELLED') setCancelledToday(n => n + 1)
      } else if (status === 'PREPARING') {
        alertOrderIds.current.delete(orderId); stopBeepLoopIfEmpty()
        setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' as const } : t))
      } else if (status === 'PENDING') {
        setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PENDING' as const } : t))
      }
    })
    return () => { socket.disconnect(); if (beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null } }
  }, [authed, cafeId])

  // actions
  async function accept(orderId: string) {
    alertOrderIds.current.delete(orderId); stopBeepLoopIfEmpty()
    setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' as const } : t))
    try { await fetch(`/api/kitchen/orders/${orderId}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'preparing' }) }) } catch {}
  }
  async function markReady(orderId: string) {
    deliveredIds.current.add(orderId); alertOrderIds.current.delete(orderId); stopBeepLoopIfEmpty()
    setTickets(prev => prev.filter(t => t.orderId !== orderId))
    setSelectedId(null); setCompletedToday(n => n + 1)
    try { await fetch(`/api/kitchen/orders/${orderId}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) }) } catch {}
  }
  async function handleReservation(id: string, action: 'accept' | 'cancel') {
    setReservations(prev => prev.filter(r => r.id !== id))
    try { await fetch(`/api/kitchen/reservations/${id}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }) } catch {}
  }

  const allTickets = [...tickets].sort((a, b) => {
    if (a.status === b.status) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return a.status === 'PENDING' ? -1 : 1
  })
  const selectedTicket = allTickets.find(t => t.orderId === selectedId) ?? null
  const pendingRes     = reservations.filter(r => r.status === 'PENDING')

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-3 animate-bounce">🍳</div><p className="text-gray-400">{tr.loading}</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1e2229] text-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="h-12 bg-[#161a1f] border-b border-[#2a2f38] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          {cafeLogoUrl
            ? <img src={cafeLogoUrl} alt={cafeName} className="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/10" />
            : <ChefHat className="w-5 h-5 text-amber-400" />
          }
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-sm tracking-wide">{cafeName || tr.title}</span>
            <span className="text-[9px] text-gray-500 font-medium">Powered by SmartMenu</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Counters */}
          <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCheck className="w-3.5 h-3.5" /> {completedToday} {tr.completedToday}
          </span>
          <span className="flex items-center gap-1 bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" /> {cancelledToday} {tr.cancelledToday}
          </span>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-[#2a2f38] rounded-lg p-0.5">
            <button onClick={() => setActiveTab('orders')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>
              🍳 Orders {allTickets.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-xs">{allTickets.length}</span>}
            </button>
            <button onClick={() => { setActiveTab('reservations'); setNewReservationAlert(false) }}
              className={`relative px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'reservations' ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'}`}>
              <CalendarClock className="w-3 h-3 inline mr-1" />
              {tr.reservations}
              {pendingRes.length > 0 && <span className={`ml-1 rounded-full px-1 text-white text-xs ${newReservationAlert ? 'bg-red-500 animate-pulse' : 'bg-violet-600'}`}>{pendingRes.length}</span>}
            </button>
          </div>

          {/* Mute */}
          <button onClick={() => setMuted(m => !m)}
            className={`p-1.5 rounded-lg transition-all ${muted ? 'bg-[#2a2f38] text-gray-500' : 'bg-[#2a2f38] text-amber-400'}`}>
            {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {/* Lang */}
          <div className="flex items-center gap-0.5 bg-[#2a2f38] rounded-lg px-1.5 py-1">
            {(['ar','en','fr','es'] as Lang[]).map(l => (
              <button key={l} onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
                className={`text-xs font-bold px-1.5 py-0.5 rounded-md transition-all ${lang === l ? 'bg-amber-500 text-gray-950' : 'text-gray-500 hover:text-white'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main body ── */}
      {activeTab === 'orders' ? (
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: ticket list ── */}
          <div className="w-56 lg:w-64 bg-[#252930] border-r border-[#2a2f38] flex flex-col overflow-hidden shrink-0">
            <div className="overflow-y-auto flex-1">
              {allTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 py-16">
                  <span className="text-3xl">✅</span>
                  <p className="text-xs text-center px-4">{tr.noNew}</p>
                </div>
              ) : allTickets.map(t => {
                const min     = elapsedMin(t.createdAt)
                const tier    = min >= 12 ? 'critical' : min >= 7 ? 'warning' : min >= 4 ? 'caution' : 'fresh'
                const isSel   = selectedId === t.orderId
                const isPend  = t.status === 'PENDING'
                const hasAlert = alertOrderIds.current.has(t.orderId)

                return (
                  <button
                    key={t.orderId}
                    onClick={() => setSelectedId(isSel ? null : t.orderId)}
                    className={`w-full text-left px-4 py-4 border-b border-[#2a2f38] transition-all flex items-center justify-between gap-2
                      ${isSel ? 'bg-[#1e2229]' : 'hover:bg-[#2d333d]'}
                    `}
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      {/* Status label */}
                      <span className={`text-[11px] font-black tracking-widest uppercase
                        ${isPend ? 'text-red-400' : 'text-amber-400'}
                        ${hasAlert && isPend ? 'animate-pulse' : ''}
                      `}>
                        {isPend ? tr.newOrders : tr.cooking}
                      </span>
                      {/* Table */}
                      <span className="text-2xl font-black text-white leading-none">{t.mergeLabel}</span>
                      {/* Item count */}
                      <span className="text-xs text-gray-500">
                        {t.seatGroups.flatMap(sg => sg.items).reduce((s, i) => s + i.quantity, 0)} items · {min === 0 ? tr.justNow : tr.minAgo(min)}
                      </span>
                    </div>

                    {/* Urgency dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      tier === 'critical' ? 'bg-red-500 animate-pulse' :
                      tier === 'warning'  ? 'bg-orange-400' :
                      tier === 'caution'  ? 'bg-yellow-400' : 'bg-gray-600'
                    }`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: detail panel ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1e2229]">
            {!selectedTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
                <ChefHat className="w-16 h-16 opacity-20" />
                <p className="text-lg font-bold opacity-40">{tr.selectOrder}</p>
                <p className="text-sm opacity-25">{tr.selectOrderSub}</p>
              </div>
            ) : (() => {
              const min   = elapsedMin(selectedTicket.createdAt)
              const tier  = min >= 12 ? 'critical' : min >= 7 ? 'warning' : min >= 4 ? 'caution' : 'fresh'
              const items = selectedTicket.seatGroups.flatMap(sg => sg.items)
              const isPend = selectedTicket.status === 'PENDING'

              return (
                <div className="flex-1 flex flex-col overflow-hidden">

                  {/* Detail header */}
                  <div className={`px-8 py-5 border-b border-[#2a2f38] flex items-center justify-between
                    ${tier === 'critical' ? 'bg-red-950/30' : tier === 'warning' ? 'bg-orange-950/20' : 'bg-[#252930]'}
                  `}>
                    <div>
                      <div className={`text-xs font-black tracking-widest uppercase mb-1
                        ${isPend ? 'text-red-400' : 'text-amber-400'}
                      `}>
                        {isPend ? tr.newOrders : tr.cooking}
                      </div>
                      <div className="text-5xl font-black text-white">{selectedTicket.mergeLabel}</div>
                    </div>

                    {/* Digital timer */}
                    <div className="text-right">
                      <DigitalTimer iso={selectedTicket.createdAt} tier={tier} />
                      {tier === 'critical' && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-red-400 text-xs font-bold animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" /> {tr.urgent}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-start gap-4 bg-[#252930] rounded-xl px-5 py-4">
                        {/* Qty badge */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shrink-0
                          ${tier === 'critical' ? 'bg-red-800 text-red-100' : tier === 'warning' ? 'bg-orange-800 text-orange-100' : 'bg-[#2a2f38] text-white'}
                        `}>
                          {item.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-bold text-white leading-tight">{item.productName}</p>
                          {item.notes && (
                            <p className="text-sm text-amber-400 mt-1 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action button — full width at bottom */}
                  <div className="px-6 pb-6 pt-3 shrink-0">
                    {isPend ? (
                      <button
                        onClick={() => accept(selectedTicket.orderId)}
                        className="w-full py-5 rounded-2xl font-black text-xl tracking-wider bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-gray-950 transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20"
                      >
                        <CheckCircle2 className="w-7 h-7" />
                        {tr.accept}
                      </button>
                    ) : (
                      <button
                        onClick={() => markReady(selectedTicket.orderId)}
                        className="w-full py-5 rounded-2xl font-black text-2xl tracking-widest bg-[#22c55e] hover:bg-[#16a34a] active:scale-[0.98] text-white transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/25"
                        style={{ boxShadow: '0 4px 32px rgba(34,197,94,0.25)' }}
                      >
                        <Check className="w-8 h-8 stroke-[3]" />
                        {tr.ready}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

      ) : (
        /* ── Reservations ── */
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 bg-violet-950/80 backdrop-blur px-4 py-2 border-b border-violet-900/40">
            <h2 className="font-bold text-violet-300 text-sm flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> {tr.reservations} — {pendingRes.length}
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingRes.length === 0 && (
              <div className="col-span-3 text-center py-16 text-gray-600">
                <p className="text-3xl mb-2">📅</p><p className="text-xs">{tr.noReservations}</p>
              </div>
            )}
            {pendingRes.map(r => {
              const date    = new Date(r.date)
              const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={r.id} className="rounded-2xl border border-violet-700/40 bg-[#252930] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-violet-300">
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      <span className="font-bold text-sm">{dateStr}</span>
                      <span className="text-xs text-violet-400">{timeStr}</span>
                    </div>
                    <div className="flex items-center gap-1 text-violet-400 text-xs font-bold">
                      <Users className="w-3.5 h-3.5" /> {r.guests} {tr.guests}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{r.name}</p>
                    <p className="flex items-center gap-1 text-gray-400 text-xs mt-0.5"><Phone className="w-3 h-3" />{r.phone}</p>
                  </div>
                  {r.notes && <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">⚠ {r.notes}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => handleReservation(r.id, 'accept')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl transition-all">
                      <Check className="w-4 h-4" /> {tr.resAccept}
                    </button>
                    <button onClick={() => handleReservation(r.id, 'cancel')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl transition-all">
                      <X className="w-4 h-4" /> {tr.resCancel}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
