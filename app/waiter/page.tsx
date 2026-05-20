'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

type WaiterCall  = { id: string; tableId: string; tableNumber?: number; type: string; message?: string | null; createdAt: string }
type NewOrder    = { orderId: string; mergeLabel: string; totalPrice: string; createdAt: string }
type ReadyOrder  = {
  id: string; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { id: string; quantity: number; product: { nameEn: string } }[]
}
type BillRequest = { id: string; tableId: string; tableNumber?: number; createdAt: string }

const CALL_ICONS: Record<string, string> = {
  WATER: '🧊', QUESTION: '❓', CLEAN: '🧹', BILL: '💳', OTHER: '🔔'
}

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : `${m}m ago`
}

// ─── resolve token: prefer posToken (staff), fall back to admin token ──────────

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

export default function WaiterPage() {
  const [newOrders, setNewOrders] = useState<NewOrder[]>([])
  const [calls, setCalls]         = useState<WaiterCall[]>([])
  const [ready, setReady]         = useState<ReadyOrder[]>([])
  const [bills, setBills]         = useState<BillRequest[]>([])
  const [cafeId, setCafeId]       = useState('')
  const [authed, setAuthed]       = useState(false)
  const [isPOS, setIsPOS]         = useState(false)
  const [, setTick]               = useState(0)
  const tokenRef                  = useRef('')
  const socketRef                 = useRef<Socket | null>(null)

  function authHeader() { return { Authorization: `Bearer ${tokenRef.current}` } }

  // ── boot: try posToken then admin token ──────────────────────────────────
  useEffect(() => {
    const resolved = resolveToken()
    if (!resolved) { window.location.href = '/login'; return }
    const payload = JSON.parse(atob(resolved.token.split('.')[1]))
    tokenRef.current = resolved.token
    setCafeId(payload.cafeId)
    setIsPOS(resolved.isPOS)
    setAuthed(true)
  }, [])

  // ── load initial "ready to serve" orders ─────────────────────────────────
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

  // ── socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !cafeId) return
    const socket = socketIO(SOCKET_URL, {
      auth:       { token: tokenRef.current },
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', `room_${cafeId}`)
    })

    socket.on('connect_error', (err) => {
      console.error('Waiter socket connect_error', err.message)
    })

    socket.on('error', (e: any) => {
      console.error('Waiter socket error', e)
    })

    // Customer placed an order → notify waiter immediately
    socket.on('new_order', (o: { orderId: string; mergeLabel: string; totalPrice: string }) => {
      vibrate()
      const incoming: NewOrder = { ...o, createdAt: new Date().toISOString() }
      setNewOrders(prev => [incoming, ...prev.filter(x => x.orderId !== o.orderId)])
    })

    // Waiter calls from customer
    socket.on('waiter_called', (c: WaiterCall) => {
      vibrate()
      setCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
    })

    socket.on('waiter_acknowledged', ({ id }: { id: string }) => {
      setCalls(prev => prev.filter(c => c.id !== id))
    })

    // Bill request from customer
    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
    })

    // Kitchen marked order ready (DELIVERED) → refresh ready list
    socket.on('kds_order_updated', (p: { orderId: string; status: string }) => {
      if (p.status === 'DELIVERED') {
        setNewOrders(prev => prev.filter(o => o.orderId !== p.orderId))
        const endpoint = isPOS ? '/api/pos/waiter/ready' : '/api/orders?status=DELIVERED'
        fetch(endpoint, { headers: authHeader() })
          .then(r => r.ok ? r.json() : [])
          .then((orders: ReadyOrder[]) =>
            setReady(orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
          )
      }
      if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== p.orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== p.orderId))
      }
    })

    socket.on('order_status_updated', (p: { orderId: string; status: string }) => {
      if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
        setReady(prev => prev.filter(o => o.id !== p.orderId))
        setNewOrders(prev => prev.filter(o => o.orderId !== p.orderId))
      }
    })

    return () => { socket.disconnect() }
  }, [authed, cafeId, isPOS, vibrate])

  // ── actions ───────────────────────────────────────────────────────────────
  function ackCall(callId: string) {
    socketRef.current?.emit('ack_call', { cafeId, callId })
    setCalls(prev => prev.filter(c => c.id !== callId))
  }

  async function markServed(orderId: string) {
    const endpoint = isPOS
      ? `/api/pos/waiter/orders/${orderId}/served`
      : `/api/orders/${orderId}/status`
    const body = isPOS
      ? undefined
      : JSON.stringify({ status: 'COMPLETED' })
    await fetch(endpoint, {
      method:  'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body
    })
    setReady(prev => prev.filter(o => o.id !== orderId))
  }

  function dismissBill(id: string) {
    setBills(prev => prev.filter(b => b.id !== id))
  }

  function dismissNewOrder(orderId: string) {
    setNewOrders(prev => prev.filter(o => o.orderId !== orderId))
  }

  const totalAlerts = newOrders.length + calls.length + bills.length + ready.length

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/assets/logo.png" alt="Smart Menu" width={32} height={32} className="rounded-lg" />
          <div>
            <h1 className="font-extrabold text-gray-900 leading-none">Waiter View</h1>
            <p className="text-xs text-gray-400">Live floor status</p>
          </div>
        </div>
        {totalAlerts > 0 && (
          <span className="bg-red-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center animate-pulse">
            {totalAlerts}
          </span>
        )}
      </header>

      <div className="max-w-lg mx-auto p-3 space-y-4 pb-12">

        {/* ── New Orders ── */}
        {newOrders.length > 0 && (
          <Section title="🆕 New Orders" count={newOrders.length} color="blue">
            {newOrders.map(o => (
              <div key={o.orderId} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 flex items-center gap-3">
                <span className="text-3xl flex-shrink-0">📋</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{o.mergeLabel}</p>
                  <p className="text-xs text-gray-500">{o.totalPrice} · {elapsed(o.createdAt)}</p>
                </div>
                <button
                  onClick={() => dismissNewOrder(o.orderId)}
                  className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                >
                  Got it ✓
                </button>
              </div>
            ))}
          </Section>
        )}

        {/* ── Waiter Calls ── */}
        <Section title="🔔 Customer Calls" count={calls.length} color="red">
          {calls.length === 0 ? (
            <Empty icon="✅" text="No active calls" />
          ) : calls.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-center gap-3">
              <span className="text-3xl flex-shrink-0">{CALL_ICONS[c.type] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">
                  Table {c.tableNumber ?? '?'} <span className="text-gray-400 font-normal">· {c.type}</span>
                </p>
                {c.message && <p className="text-xs text-gray-500 truncate">{c.message}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{elapsed(c.createdAt)}</p>
              </div>
              <button
                onClick={() => ackCall(c.id)}
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
              >
                Done ✓
              </button>
            </div>
          ))}
        </Section>

        {/* ── Bill Requests ── */}
        {bills.length > 0 && (
          <Section title="💳 Bill Requests" count={bills.length} color="violet">
            {bills.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-violet-100 shadow-sm p-4 flex items-center gap-3">
                <span className="text-3xl">💳</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">Table {b.tableNumber ?? '?'}</p>
                  <p className="text-xs text-gray-400">{elapsed(b.createdAt)}</p>
                </div>
                <button
                  onClick={() => dismissBill(b.id)}
                  className="bg-violet-500 hover:bg-violet-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                >
                  Paid ✓
                </button>
              </div>
            ))}
          </Section>
        )}

        {/* ── Ready to Serve ── */}
        <Section title="🍽️ Ready to Serve" count={ready.length} color="emerald">
          {ready.length === 0 ? (
            <Empty icon="⏳" text="Nothing ready yet" />
          ) : ready.map(order => {
            const tableNum = (order.originalTable ?? order.table)?.tableNumber
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    Table {tableNum ?? '?'}{order.seat ? ` · Seat ${order.seat.seatNumber}` : ''}
                  </span>
                  <span className="text-xs text-gray-400">{elapsed(order.createdAt)}</span>
                </div>
                <ul className="space-y-0.5">
                  {order.items.map(item => (
                    <li key={item.id} className="text-sm text-gray-700">
                      <span className="font-bold text-gray-900">{item.quantity}×</span> {item.product.nameEn}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => markServed(order.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
                >
                  ✅ Served — Mark Complete
                </button>
              </div>
            )
          })}
        </Section>

      </div>
    </div>
  )
}

function Section({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', red: 'text-red-600', violet: 'text-violet-600', emerald: 'text-emerald-600'
  }
  const badges: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600', red: 'bg-red-100 text-red-600',
    violet: 'bg-violet-100 text-violet-600', emerald: 'bg-emerald-100 text-emerald-600'
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <h2 className={`font-extrabold text-sm ${colors[color]}`}>{title}</h2>
        {count > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badges[color]}`}>{count}</span>}
      </div>
      <div className="space-y-2">{children}</div>
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
