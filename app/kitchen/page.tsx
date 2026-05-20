'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// KdsTicket shape emitted by emitKdsTicket()
type KdsItem    = { productId: string; productName: string; quantity: number; notes: string | null }
type SeatGroup  = { seatNumber: number | null; physicalTableNumber: number; items: KdsItem[] }
type KdsTicket  = {
  orderId:            string
  cafeId:             string
  billingTableNumber: number
  mergeLabel:         string
  seatGroups:         SeatGroup[]
  totalPrice:         string
  createdAt:          string
  status:             'PENDING' | 'PREPARING'
}

function elapsed(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function KitchenPage() {
  const [tickets, setTickets]   = useState<KdsTicket[]>([])
  const [loading, setLoading]   = useState(true)
  const [cafeId, setCafeId]     = useState('')
  const [authed, setAuthed]     = useState(false)
  const [, setTick]             = useState(0)
  const socketRef               = useRef<Socket | null>(null)
  // keep track of orderIds the kitchen already confirmed as DELIVERED
  // so ghost re-emits of kds_new_order for the same orderId are ignored
  const deliveredIds            = useRef<Set<string>>(new Set())

  function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      setCafeId(p.cafeId)
      setAuthed(true)
    } catch { window.location.href = '/login' }
  }, [])

  // ── load existing active orders from API ──────────────────────────────────
  async function loadOrders() {
    const [pending, preparing] = await Promise.all([
      fetch('/api/orders?status=PENDING',   { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch('/api/orders?status=PREPARING', { headers: authHeader() }).then(r => r.ok ? r.json() : []),
    ])
    // Transform API orders → KdsTicket shape
    const toTicket = (o: any, status: 'PENDING' | 'PREPARING'): KdsTicket => ({
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
          notes:       null
        }))
      }],
      totalPrice: String(o.totalPrice),
      createdAt:  o.createdAt,
      status
    })
    const all = [
      ...(pending   as any[]).map(o => toTicket(o, 'PENDING')),
      ...(preparing as any[]).map(o => toTicket(o, 'PREPARING')),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    setTickets(all)
    setLoading(false)
  }

  useEffect(() => { if (authed) loadOrders() }, [authed])

  // ── refresh elapsed every 30s ─────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const token = localStorage.getItem('token')
    const socket = socketIO(SOCKET_URL || window.location.origin, { auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', `kds_room_${cafeId}`)
    })

    // New order from customer → kds_room_ receives kds_new_order
    socket.on('kds_new_order', (ticket: KdsTicket) => {
      // Skip if this orderId was already marked DELIVERED by this kitchen session
      if (deliveredIds.current.has(ticket.orderId)) return
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play() } catch {}
      setTickets(prev => {
        if (prev.find(t => t.orderId === ticket.orderId)) return prev
        return [...prev, { ...ticket, status: 'PENDING' as const }]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
    })

    // Status updates
    socket.on('kds_order_updated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        deliveredIds.current.add(orderId)
        setTickets(prev => prev.filter(t => t.orderId !== orderId))
      } else if (status === 'PENDING' || status === 'PREPARING') {
        const s = status
        setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: s } : t))
      }
    })

    return () => { socket.disconnect() }
  }, [authed, cafeId])

  // ── actions ───────────────────────────────────────────────────────────────
  function accept(orderId: string) {
    socketRef.current?.emit('kds_ack_order', { cafeId, orderId })
    setTickets(prev => prev.map(t => t.orderId === orderId ? { ...t, status: 'PREPARING' } : t))
  }

  function markReady(orderId: string) {
    deliveredIds.current.add(orderId)
    socketRef.current?.emit('kds_ready', { cafeId, orderId })
    setTickets(prev => prev.filter(t => t.orderId !== orderId))
  }

  const pending   = tickets.filter(t => t.status === 'PENDING')
  const preparing = tickets.filter(t => t.status === 'PREPARING')

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-bounce">🍳</div>
        <p className="text-gray-400">Loading kitchen…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="ltr">

      <header className="bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image src="/assets/logo.png" alt="Smart Menu" width={32} height={32} className="rounded-lg" />
          <div>
            <h1 className="font-extrabold text-lg leading-none">Kitchen Display</h1>
            <p className="text-xs text-gray-400">Real-time order queue</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full font-bold text-sm">
            {pending.length} New
          </span>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold text-sm">
            {preparing.length} Cooking
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-61px)]">

        {/* PENDING */}
        <div className="border-r border-gray-800 overflow-y-auto">
          <div className="sticky top-0 bg-red-950/70 backdrop-blur px-4 py-2.5 border-b border-red-900/40">
            <h2 className="font-bold text-red-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse inline-block" />
              NEW ORDERS — {pending.length}
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {pending.length === 0 && <Empty icon="✅" text="No pending orders" />}
            {pending.map(t => (
              <TicketCard key={t.orderId} ticket={t} action="accept" onAction={() => accept(t.orderId)} />
            ))}
          </div>
        </div>

        {/* PREPARING */}
        <div className="overflow-y-auto">
          <div className="sticky top-0 bg-amber-950/70 backdrop-blur px-4 py-2.5 border-b border-amber-900/40">
            <h2 className="font-bold text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              COOKING — {preparing.length}
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {preparing.length === 0 && <Empty icon="🍳" text="Nothing cooking yet" />}
            {preparing.map(t => (
              <TicketCard key={t.orderId} ticket={t} action="ready" onAction={() => markReady(t.orderId)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TicketCard({ ticket, action, onAction }: {
  ticket: KdsTicket; action: 'accept' | 'ready'; onAction: () => void
}) {
  const min    = elapsed(ticket.createdAt)
  const urgent = min >= 8

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${
      action === 'accept' ? 'bg-gray-900 border-red-800/50' : 'bg-gray-900 border-amber-800/50'
    } ${urgent ? 'ring-1 ring-red-500/50 border-red-500' : ''}`}>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          action === 'accept' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {ticket.mergeLabel}
          {ticket.seatGroups[0]?.seatNumber != null && ` · Seat ${ticket.seatGroups[0].seatNumber}`}
        </span>
        <div className="flex items-center gap-2">
          {urgent && <span className="text-xs text-red-400 font-bold animate-pulse">⚠ URGENT</span>}
          <span className={`text-xs font-medium ${min >= 10 ? 'text-red-400' : min >= 5 ? 'text-amber-400' : 'text-gray-500'}`}>
            {min}m ago
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {ticket.seatGroups.flatMap(sg => sg.items).map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="bg-gray-800 text-white text-xs font-bold w-7 h-6 rounded flex items-center justify-center shrink-0">
              {item.quantity}×
            </span>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{item.productName}</p>
              {item.notes && <p className="text-xs text-amber-400">{item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={onAction}
        className={`w-full py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all ${
          action === 'accept'
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {action === 'accept' ? '✅ Accept — Start Cooking' : '🔔 Ready — Notify Waiter'}
      </button>
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-16 text-gray-600">
      <p className="text-4xl mb-2">{icon}</p>
      <p>{text}</p>
    </div>
  )
}
