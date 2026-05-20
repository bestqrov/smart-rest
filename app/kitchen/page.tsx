'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

type OrderItem = { id: string; quantity: number; product: { nameEn: string; nameAr: string } }
type Order = {
  id: string
  status: 'PENDING' | 'PREPARING' | 'DELIVERED'
  createdAt: string
  table:         { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat:          { seatNumber: number }  | null
  items: OrderItem[]
}

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function KitchenPage() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [cafeId, setCafeId]         = useState('')
  const [authed, setAuthed]         = useState(false)
  const [, setTick]                 = useState(0)
  const socketRef                   = useRef<Socket | null>(null)

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

  // ── fetch active orders ───────────────────────────────────────────────────
  async function loadOrders() {
    const [pending, preparing] = await Promise.all([
      fetch('/api/orders?status=PENDING',    { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch('/api/orders?status=PREPARING',  { headers: authHeader() }).then(r => r.ok ? r.json() : []),
    ])
    setOrders([...(pending as Order[]), ...(preparing as Order[])]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
    setLoading(false)
  }

  useEffect(() => { if (authed) loadOrders() }, [authed])

  // ── clock tick every 30s to refresh elapsed times ────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const token = localStorage.getItem('token')
    const socket = socketIO(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', `kds_room_${cafeId}`)
      socket.emit('join', `room_${cafeId}`)
    })

    // new order arrives
    socket.on('new_order', (o: Order) => {
      setOrders(prev => {
        if (prev.find(x => x.id === o.id)) return prev
        return [...prev, o].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
      // audio ping
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play() } catch {}
    })

    // status updated (PREPARING / DELIVERED / COMPLETED)
    socket.on('kds_order_updated',    (p: { orderId: string; status: string }) => applyUpdate(p))
    socket.on('order_status_updated', (p: { orderId: string; status: string }) => applyUpdate(p))

    return () => { socket.disconnect() }
  }, [authed, cafeId])

  function applyUpdate({ orderId, status }: { orderId: string; status: string }) {
    setOrders(prev => {
      if (status === 'DELIVERED' || status === 'COMPLETED' || status === 'CANCELLED') {
        return prev.filter(o => o.id !== orderId)
      }
      return prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o)
    })
  }

  // ── actions ───────────────────────────────────────────────────────────────
  function accept(orderId: string) {
    socketRef.current?.emit('kds_ack_order', { cafeId, orderId })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING' } : o))
  }

  function markReady(orderId: string) {
    socketRef.current?.emit('kds_ready', { cafeId, orderId })
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const pending   = orders.filter(o => o.status === 'PENDING')
  const preparing = orders.filter(o => o.status === 'PREPARING')

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

      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image src="/assets/logo.png" alt="Smart Menu" width={32} height={32} className="rounded-lg" />
          <div>
            <h1 className="font-extrabold text-lg leading-none">Kitchen Display</h1>
            <p className="text-xs text-gray-400">Real-time order queue</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full font-bold">
            {pending.length} New
          </span>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
            {preparing.length} Cooking
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[calc(100vh-61px)]">

        {/* ── PENDING column ── */}
        <div className="border-r border-gray-800 overflow-y-auto">
          <div className="sticky top-0 bg-red-950/60 backdrop-blur px-4 py-2.5 border-b border-red-900/40">
            <h2 className="font-bold text-red-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse inline-block" />
              NEW ORDERS — {pending.length}
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {pending.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-4xl mb-2">✅</p>
                <p>No pending orders</p>
              </div>
            )}
            {pending.map(order => (
              <OrderCard key={order.id} order={order} action="accept" onAction={() => accept(order.id)} />
            ))}
          </div>
        </div>

        {/* ── PREPARING column ── */}
        <div className="overflow-y-auto">
          <div className="sticky top-0 bg-amber-950/60 backdrop-blur px-4 py-2.5 border-b border-amber-900/40">
            <h2 className="font-bold text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              COOKING — {preparing.length}
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {preparing.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-4xl mb-2">🍳</p>
                <p>Nothing cooking yet</p>
              </div>
            )}
            {preparing.map(order => (
              <OrderCard key={order.id} order={order} action="ready" onAction={() => markReady(order.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, action, onAction }: {
  order: Order
  action: 'accept' | 'ready'
  onAction: () => void
}) {
  const tableNum = (order.originalTable ?? order.table)?.tableNumber
  const elapsed  = elapsedMin(order.createdAt)
  const urgent   = elapsed >= 8

  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-all ${
      action === 'accept'
        ? 'bg-gray-900 border-red-800/50'
        : 'bg-gray-900 border-amber-800/50'
    } ${urgent ? 'border-red-500 ring-1 ring-red-500/40' : ''}`}>

      {/* Order header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            action === 'accept' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            Table {tableNum ?? '?'} · Seat {order.seat?.seatNumber ?? '?'}
          </span>
          {urgent && <span className="text-xs text-red-400 font-bold animate-pulse">⚠ URGENT</span>}
        </div>
        <span className={`text-xs font-medium ${elapsed >= 10 ? 'text-red-400' : elapsed >= 5 ? 'text-amber-400' : 'text-gray-500'}`}>
          {elapsed}m ago
        </span>
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {order.items.map(item => (
          <li key={item.id} className="flex items-start gap-2">
            <span className="bg-gray-800 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0">
              {item.quantity}×
            </span>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{item.product.nameEn}</p>
              <p className="text-xs text-gray-500">{item.product.nameAr}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Action button */}
      <button
        onClick={onAction}
        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
          action === 'accept'
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {action === 'accept' ? '✅ Accept — Start Cooking' : '🔔 Ready — Serve Now'}
      </button>
    </div>
  )
}
