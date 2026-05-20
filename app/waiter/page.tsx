'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

type WaiterCall = {
  id: string; tableId: string; type: string; message?: string | null; createdAt: string
  tableNumber?: number
}
type ReadyOrder = {
  id: string; tableId: string; createdAt: string
  table: { tableNumber: number } | null
  originalTable: { tableNumber: number } | null
  seat: { seatNumber: number } | null
  items: { id: string; quantity: number; product: { nameEn: string } }[]
}
type BillRequest = { id: string; tableId: string; createdAt: string; tableNumber?: number }

const CALL_ICONS: Record<string, string> = {
  WATER:    '🧊',
  QUESTION: '❓',
  CLEAN:    '🧹',
  BILL:     '💳',
  OTHER:    '🔔',
}

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : `${m}m ago`
}

export default function WaiterPage() {
  const [calls, setCalls]         = useState<WaiterCall[]>([])
  const [ready, setReady]         = useState<ReadyOrder[]>([])
  const [bills, setBills]         = useState<BillRequest[]>([])
  const [cafeId, setCafeId]       = useState('')
  const [authed, setAuthed]       = useState(false)
  const [, setTick]               = useState(0)
  const socketRef                 = useRef<Socket | null>(null)

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

  // ── fetch initial data ────────────────────────────────────────────────────
  async function loadData() {
    const [tables, delivered] = await Promise.all([
      fetch('/api/tables', { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch('/api/orders?status=DELIVERED', { headers: authHeader() }).then(r => r.ok ? r.json() : []),
    ])
    setReady((delivered as ReadyOrder[]).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
    void tables
  }

  useEffect(() => { if (authed) loadData() }, [authed])

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
    const token = localStorage.getItem('token')
    const socket = socketIO(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join', `room_${cafeId}`))

    socket.on('waiter_called', (c: WaiterCall) => {
      vibrate()
      setCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
    })

    socket.on('waiter_acknowledged', ({ id }: { id: string }) => {
      setCalls(prev => prev.filter(c => c.id !== id))
    })

    socket.on('bill_requested', (b: BillRequest) => {
      vibrate()
      setBills(prev => [b, ...prev.filter(x => x.id !== b.id)])
    })

    socket.on('kds_order_updated', (p: { orderId: string; status: string }) => {
      if (p.status === 'DELIVERED') {
        fetch(`/api/orders?status=DELIVERED`, { headers: authHeader() })
          .then(r => r.ok ? r.json() : [])
          .then((orders: ReadyOrder[]) => setReady(orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())))
      }
      if (p.status === 'COMPLETED') {
        setReady(prev => prev.filter(o => o.id !== p.orderId))
      }
    })

    socket.on('order_status_updated', (p: { orderId: string; status: string }) => {
      if (p.status === 'COMPLETED') setReady(prev => prev.filter(o => o.id !== p.orderId))
    })

    return () => { socket.disconnect() }
  }, [authed, cafeId, vibrate])

  // ── actions ───────────────────────────────────────────────────────────────
  function ackCall(callId: string) {
    socketRef.current?.emit('ack_call', { cafeId, callId })
    setCalls(prev => prev.filter(c => c.id !== callId))
  }

  async function markServed(orderId: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' })
    })
    setReady(prev => prev.filter(o => o.id !== orderId))
  }

  function dismissBill(id: string) {
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const totalAlerts = calls.length + bills.length

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
                <div className="flex-1 min-w-0">
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
                    Table {tableNum ?? '?'} · Seat {order.seat?.seatNumber ?? '?'}
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
  const ring: Record<string, string> = {
    red: 'text-red-600', violet: 'text-violet-600', emerald: 'text-emerald-600'
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <h2 className={`font-extrabold text-sm ${ring[color]}`}>{title}</h2>
        {count > 0 && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            color === 'red'     ? 'bg-red-100 text-red-600' :
            color === 'violet'  ? 'bg-violet-100 text-violet-600' :
                                  'bg-emerald-100 text-emerald-600'
          }`}>{count}</span>
        )}
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
