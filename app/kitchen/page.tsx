'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { Bell, BellOff, ChefHat, CheckCircle2, AlertTriangle, CheckCheck, XCircle, CalendarClock, Users, Phone, Check, X } from 'lucide-react'

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
    todayTab: 'Today',
    noToday: 'No finished orders yet today',
    itemsCount: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
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
    todayTab: 'اليوم',
    noToday: 'لا يوجد طلبات منتهية اليوم بعد',
    itemsCount: (n: number) => `${n} صنف`,
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
    todayTab: "Aujourd'hui",
    noToday: 'Aucune commande terminée aujourd\'hui',
    itemsCount: (n: number) => `${n} article${n === 1 ? '' : 's'}`,
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
    todayTab: 'Hoy',
    noToday: 'Ningún pedido terminado hoy todavía',
    itemsCount: (n: number) => `${n} artículo${n === 1 ? '' : 's'}`,
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

type ActiveTab = 'orders' | 'reservations' | 'today'

type TodayOrder = {
  id: string
  status: 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  seatNumber: number | null
  table: { tableNumber: number; mergedIntoTableId: string | null; mergedIntoTable: { tableNumber: number } | null } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { quantity: number; product: { id: string; nameEn: string } }[]
}

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
function authHeader() {
  const t = localStorage.getItem('kitchenToken') || localStorage.getItem('token') || ''
  return { Authorization: `Bearer ${t}` }
}

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
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([])
  const [newReservationAlert, setNewReservationAlert] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashActionError(msg: string) {
    setActionError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setActionError(null), 4000)
  }
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

  // boot — accepts admin token OR supervisor posToken
  useEffect(() => {
    // Prefer admin token; fall back to posToken if role is SUPERVISOR
    const adminToken = localStorage.getItem('token')
    const posToken   = localStorage.getItem('posToken')

    let activeToken: string | null = null
    let cafeIdFromToken = ''

    if (adminToken) {
      try {
        const p = JSON.parse(atob(adminToken.split('.')[1]))
        if (p.cafeId) { activeToken = adminToken; cafeIdFromToken = p.cafeId }
      } catch {}
    }

    if (!activeToken && posToken) {
      try {
        const p = JSON.parse(atob(posToken.split('.')[1]))
        if (p.cafeId && p.staffRole === 'SUPERVISOR') { activeToken = posToken; cafeIdFromToken = p.cafeId }
      } catch {}
    }

    if (!activeToken) { window.location.href = '/login'; return }

    localStorage.setItem('kitchenToken', activeToken)
    setCafeId(cafeIdFromToken); setAuthed(true)

    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') setLang(saved as Lang)

    ;(async () => {
      try {
        const r = await fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${activeToken}` } })
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
    const orders: any[] = await fetch('/api/kitchen/orders/queue', { headers: authHeader() })
      .then(r => r.ok ? r.json() : [])

    const isMarketplace = (o: any) => o.orderSource === 'MARKETPLACE'
    const toTicket = (o: any): KdsTicket => ({
      orderId:            o.id,
      cafeId:             o.cafeId ?? '',
      billingTableNumber: (o.originalTable ?? o.table)?.tableNumber ?? 0,
      mergeLabel:         isMarketplace(o) ? `🛵 ${o.externalPlatform || 'Delivery'}`
                          : o.queueNumber != null ? `#${o.queueNumber}`
                          : `T${(o.originalTable ?? o.table)?.tableNumber ?? '?'}`,
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
      status:     o.status as 'PENDING' | 'PREPARING',
    })

    setTickets(orders.map(toTicket))
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

  async function loadTodayOrders() {
    try {
      const res = await fetch('/api/kitchen/orders/today', { headers: authHeader() })
      if (res.ok) { const d = await res.json(); setTodayOrders(d.orders ?? []) }
    } catch {}
  }

  useEffect(() => { if (!authed) return; loadOrders(); loadDailyStats(); loadReservations(); loadTodayOrders() }, [authed])

  useEffect(() => {
    const t = setInterval(() => {
      setTickets(prev => prev.filter(ticket => {
        if (elapsedMin(ticket.createdAt) > STALE_THRESHOLD_MIN) { alertOrderIds.current.delete(ticket.orderId); return false }
        return true
      }))
      loadDailyStats()
      loadTodayOrders()
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
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'preparing' }) })
      if (!res.ok) throw new Error()
    } catch {
      // Revert the optimistic flip so the ticket doesn't silently claim
      // "cooking" when the server never got the update — staff need to
      // see it's still PENDING and retry.
      setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PENDING' as const } : t))
      alertOrderIds.current.add(orderId); startBeepLoop()
      flashActionError(lang === 'ar' ? 'فشل تحديث الطلب — حاول مجدداً' : 'Failed to update order — try again')
    }
  }
  async function markReady(orderId: string) {
    const ticket = tickets.find(t => t.orderId === orderId)
    deliveredIds.current.add(orderId); alertOrderIds.current.delete(orderId); stopBeepLoopIfEmpty()
    setTickets(prev => prev.filter(t => t.orderId !== orderId))
    setSelectedId(null); setCompletedToday(n => n + 1)
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) })
      if (!res.ok) throw new Error()
    } catch {
      deliveredIds.current.delete(orderId)
      setCompletedToday(n => Math.max(0, n - 1))
      if (ticket) setTickets(prev => prev.find(t => t.orderId === orderId) ? prev : [...prev, ticket])
      flashActionError(lang === 'ar' ? 'فشل تحديث الطلب — حاول مجدداً' : 'Failed to update order — try again')
    }
  }
  async function handleReservation(id: string, action: 'accept' | 'cancel') {
    const reservation = reservations.find(r => r.id === id)
    setReservations(prev => prev.filter(r => r.id !== id))
    try {
      const res = await fetch(`/api/kitchen/reservations/${id}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (!res.ok) throw new Error()
    } catch {
      if (reservation) setReservations(prev => prev.find(r => r.id === id) ? prev : [reservation, ...prev])
      flashActionError(lang === 'ar' ? 'فشل تحديث الحجز — حاول مجدداً' : 'Failed to update reservation — try again')
    }
  }

  const allTickets = [...tickets].sort((a, b) => {
    if (a.status === b.status) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return a.status === 'PENDING' ? -1 : 1
  })
  const selectedTicket = allTickets.find(t => t.orderId === selectedId) ?? null
  const pendingRes     = reservations.filter(r => r.status === 'PENDING')

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-3 animate-bounce">🍳</div><p className="text-slate-500">{tr.loading}</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="h-14 bg-white border-b-2 border-amber-300 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          {cafeLogoUrl
            ? <img src={cafeLogoUrl} alt={cafeName} className="w-9 h-9 rounded-xl object-contain bg-amber-50 border-2 border-amber-200" />
            : <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center"><ChefHat className="w-5 h-5 text-amber-600" /></div>
          }
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              {cafeName && <span className="font-extrabold text-sm tracking-wide text-slate-800">{cafeName}</span>}
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-widest uppercase">
                🍳 {tr.title}
              </span>
            </div>
            <span className="text-[9px] text-slate-400 font-medium">Powered by SmartMenu</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Counters */}
          <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCheck className="w-3.5 h-3.5" /> {completedToday} {tr.completedToday}
          </span>
          <span className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" /> {cancelledToday} {tr.cancelledToday}
          </span>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setActiveTab('orders')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              🍳 Orders {allTickets.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-xs">{allTickets.length}</span>}
            </button>
            <button onClick={() => { setActiveTab('reservations'); setNewReservationAlert(false) }}
              className={`relative px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'reservations' ? 'bg-violet-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <CalendarClock className="w-3 h-3 inline mr-1" />
              {tr.reservations}
              {pendingRes.length > 0 && <span className={`ml-1 rounded-full px-1 text-white text-xs ${newReservationAlert ? 'bg-red-500 animate-pulse' : 'bg-violet-600'}`}>{pendingRes.length}</span>}
            </button>
            <button onClick={() => { setActiveTab('today'); loadTodayOrders() }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'today' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <CheckCheck className="w-3 h-3 inline mr-1" />
              {tr.todayTab} <span className="ml-1 bg-emerald-600/20 text-emerald-700 rounded-full px-1 text-xs">{todayOrders.length}</span>
            </button>
          </div>

          {/* Mute */}
          <button onClick={() => setMuted(m => !m)}
            className={`p-1.5 rounded-lg border transition-all ${muted ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-amber-50 border-amber-200 text-amber-500'}`}>
            {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {/* Lang */}
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-1">
            {(['ar','en','fr','es'] as Lang[]).map(l => (
              <button key={l} onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
                className={`text-xs font-bold px-1.5 py-0.5 rounded-md transition-all ${lang === l ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Action failure banner — actions are optimistic, so a failed request
          must be surfaced loudly instead of silently reverting behind the scenes ── */}
      {actionError && (
        <div className="shrink-0 bg-red-600 text-white text-sm font-bold px-4 py-2.5 flex items-center gap-2 justify-center">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      {/* ── Main body ── */}
      {activeTab === 'orders' ? (
        <div className="flex flex-1 overflow-hidden gap-3 p-3">

          {/* ── LEFT: ticket list (blue frame) ── */}
          <div className="w-56 lg:w-64 bg-white border-2 border-sky-200 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-sm">
            <div className="bg-sky-500 px-4 py-2 shrink-0">
              <span className="text-white text-xs font-black uppercase tracking-widest">🎫 Tickets</span>
            </div>
            <div className="overflow-y-auto flex-1" style={{touchAction:'pan-y'}}>
              {allTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-16">
                  <span className="text-3xl">✅</span>
                  <p className="text-xs text-center px-4">{tr.noNew}</p>
                </div>
              ) : allTickets.map(t => {
                const min     = elapsedMin(t.createdAt)
                const tier    = min >= 12 ? 'critical' : min >= 7 ? 'warning' : min >= 4 ? 'caution' : 'fresh'
                const isSel   = selectedId === t.orderId
                const isPend  = t.status === 'PENDING'
                const hasAlert = alertOrderIds.current.has(t.orderId)

                // Aging tickets need to read at a glance from across the kitchen, not
                // just via a 10px dot — the same tier already used in the detail panel
                // now tints the row border/background here too (accepted-and-alerting
                // states still take visual priority over plain aging).
                const tierBorder =
                  tier === 'critical' ? 'border-l-red-500' :
                  tier === 'warning'  ? 'border-l-orange-400' :
                  tier === 'caution'  ? 'border-l-yellow-400' : 'border-l-transparent'
                const tierBg = tier === 'critical' ? 'bg-red-50/40' : ''
                const timeColor =
                  tier === 'critical' ? 'text-red-600 font-bold' :
                  tier === 'warning'  ? 'text-orange-500 font-semibold' :
                  tier === 'caution'  ? 'text-yellow-600 font-semibold' : 'text-slate-400'

                return (
                  <div
                    key={t.orderId}
                    onClick={() => setSelectedId(isSel ? null : t.orderId)}
                    role="button" tabIndex={0}
                    className={`w-full text-left px-4 py-4 border-b border-slate-100 transition-all flex items-center justify-between gap-2 cursor-pointer border-l-4
                      ${isSel
                        ? 'bg-sky-50 border-l-sky-500'
                        : hasAlert && isPend
                          ? 'bg-red-50 border-l-red-500 hover:bg-red-100'
                          : `hover:bg-slate-50 ${tierBorder} ${tierBg}`}
                    `}
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      {/* Status label */}
                      <span className={`text-[11px] font-black tracking-widest uppercase
                        ${isPend ? 'text-red-500' : 'text-amber-600'}
                        ${hasAlert && isPend ? 'animate-pulse' : ''}
                      `}>
                        {isPend ? tr.newOrders : tr.cooking}
                      </span>
                      {/* Table */}
                      <span className="text-2xl font-black text-slate-800 leading-none">{t.mergeLabel}</span>
                      {/* Item count */}
                      <span className={`text-xs ${timeColor}`}>
                        {t.seatGroups.flatMap(sg => sg.items).reduce((s, i) => s + i.quantity, 0)} items · {min === 0 ? tr.justNow : tr.minAgo(min)}
                        {tier === 'critical' && ` · ${tr.urgent}`}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-2 shrink-0">
                      {/* Urgency dot */}
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        tier === 'critical' ? 'bg-red-500 animate-pulse' :
                        tier === 'warning'  ? 'bg-orange-400' :
                        tier === 'caution'  ? 'bg-yellow-400' : 'bg-slate-300'
                      }`} />
                      {/* One-tap action — skip the select-then-confirm detour */}
                      {isPend ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); accept(t.orderId) }}
                          aria-label={tr.accept}
                          className="w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-90 text-white transition-all flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); markReady(t.orderId) }}
                          aria-label={tr.ready}
                          className="w-11 h-11 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] active:scale-90 text-white transition-all flex items-center justify-center"
                        >
                          <Check className="w-5 h-5 stroke-[3]" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: detail panel (amber frame) ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white border-2 border-amber-200 rounded-2xl shadow-sm">
            {!selectedTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
                <ChefHat className="w-16 h-16 opacity-40" />
                <p className="text-lg font-bold text-slate-400">{tr.selectOrder}</p>
                <p className="text-sm text-slate-300">{tr.selectOrderSub}</p>
              </div>
            ) : (() => {
              const min   = elapsedMin(selectedTicket.createdAt)
              const tier  = min >= 12 ? 'critical' : min >= 7 ? 'warning' : min >= 4 ? 'caution' : 'fresh'
              const items = selectedTicket.seatGroups.flatMap(sg => sg.items)
              const isPend = selectedTicket.status === 'PENDING'

              return (
                <div className="flex-1 flex flex-col overflow-hidden">

                  {/* Detail header */}
                  <div className={`px-8 py-5 border-b-2 flex items-center justify-between rounded-t-xl
                    ${tier === 'critical' ? 'bg-red-50 border-red-200' : tier === 'warning' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}
                  `}>
                    <div>
                      <div className={`text-xs font-black tracking-widest uppercase mb-1
                        ${isPend ? 'text-red-500' : 'text-amber-600'}
                      `}>
                        {isPend ? tr.newOrders : tr.cooking}
                      </div>
                      <div className="text-5xl font-black text-slate-800">{selectedTicket.mergeLabel}</div>
                    </div>

                    {/* Digital timer */}
                    <div className="text-right">
                      <DigitalTimer iso={selectedTicket.createdAt} tier={tier} />
                      {tier === 'critical' && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-red-500 text-xs font-bold animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" /> {tr.urgent}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-slate-50" style={{touchAction:'pan-y'}}>
                    {items.map((item, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
                        {/* Qty badge */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shrink-0
                          ${tier === 'critical' ? 'bg-red-100 text-red-600' : tier === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-700'}
                        `}>
                          {item.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-bold text-slate-800 leading-tight">{item.productName}</p>
                          {item.notes && (
                            <p className="text-sm text-amber-600 mt-1 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action button — full width at bottom */}
                  <div className="px-6 pb-6 pt-3 shrink-0 bg-slate-50">
                    {isPend ? (
                      <button
                        onClick={() => accept(selectedTicket.orderId)}
                        className="w-full py-5 rounded-2xl font-black text-xl tracking-wider bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
                      >
                        <CheckCircle2 className="w-7 h-7" />
                        {tr.accept}
                      </button>
                    ) : (
                      <button
                        onClick={() => markReady(selectedTicket.orderId)}
                        className="w-full py-5 rounded-2xl font-black text-2xl tracking-widest bg-[#22c55e] hover:bg-[#16a34a] active:scale-[0.98] text-white transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/30"
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

      ) : activeTab === 'today' ? (
        /* ── Today history (emerald frame) ── */
        <div className="flex-1 overflow-y-auto p-3" style={{touchAction:'pan-y'}}>
          <div className="bg-white border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-emerald-500 px-4 py-2.5">
              <h2 className="font-black text-white text-sm flex items-center gap-2">
                <CheckCheck className="w-4 h-4" /> {tr.todayTab} — {todayOrders.length}
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-emerald-50/40">
              {todayOrders.length === 0 && (
                <div className="col-span-3 text-center py-16 text-slate-400">
                  <p className="text-3xl mb-2">✅</p><p className="text-xs">{tr.noToday}</p>
                </div>
              )}
              {todayOrders.map(o => {
                const tableNum = o.table?.mergedIntoTable?.tableNumber ?? o.table?.tableNumber ?? o.originalTable?.tableNumber
                const itemCount = o.items.reduce((s, it) => s + it.quantity, 0)
                const statusStyle = o.status === 'CANCELLED'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-emerald-200 bg-white text-emerald-600'
                return (
                  <div key={o.id} className={`rounded-2xl border-2 p-4 space-y-2 shadow-sm ${statusStyle}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800">
                        {tableNum ? `#${tableNum}` : ''}{o.seat?.seatNumber ? ` · ${tr.seat} ${o.seat.seatNumber}` : ''}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider">{o.status === 'CANCELLED' ? tr.cancelledToday : tr.completedToday}</span>
                    </div>
                    <p className="text-xs text-slate-500">{tr.itemsCount(itemCount)}</p>
                    <p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── Reservations (violet frame) ── */
        <div className="flex-1 overflow-y-auto p-3" style={{touchAction:'pan-y'}}>
          <div className="bg-white border-2 border-violet-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-violet-500 px-4 py-2.5">
              <h2 className="font-black text-white text-sm flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> {tr.reservations} — {pendingRes.length}
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-violet-50/40">
              {pendingRes.length === 0 && (
                <div className="col-span-3 text-center py-16 text-slate-400">
                  <p className="text-3xl mb-2">📅</p><p className="text-xs">{tr.noReservations}</p>
                </div>
              )}
              {pendingRes.map(r => {
                const date    = new Date(r.date)
                const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={r.id} className="rounded-2xl border-2 border-violet-200 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-violet-600">
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-sm">{dateStr}</span>
                        <span className="text-xs text-violet-400">{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1 text-violet-500 text-xs font-bold">
                        <Users className="w-3.5 h-3.5" /> {r.guests} {tr.guests}
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{r.name}</p>
                      <p className="flex items-center gap-1 text-slate-400 text-xs mt-0.5"><Phone className="w-3 h-3" />{r.phone}</p>
                    </div>
                    {r.notes && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {r.notes}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleReservation(r.id, 'accept')}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl transition-all">
                        <Check className="w-4 h-4" /> {tr.resAccept}
                      </button>
                      <button onClick={() => handleReservation(r.id, 'cancel')}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-400 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl transition-all">
                        <X className="w-4 h-4" /> {tr.resCancel}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      <footer className="text-center py-2 border-t border-slate-200 bg-white">
        <p className="text-[10px] text-slate-400 select-none">© 2026 Smart Restau</p>
      </footer>
    </div>
  )
}
