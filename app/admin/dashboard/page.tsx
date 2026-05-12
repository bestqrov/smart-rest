"use client"

import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { io, Socket } from 'socket.io-client'
import ErrorBoundary from '../../../src/components/ErrorBoundary'
import NProgressProvider from '../../../src/components/NProgressProvider'

type WaiterCall = { id: number; tableId: number; type: string; message?: string; createdAt: string }

type Daily = { date: string; total: number }

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [calls, setCalls] = useState<WaiterCall[]>([])
  const socketRef = React.useRef<Socket | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      setStats(data)
      setLoading(false)
    }
    load()
    // socket: join cafe room and listen for waiter calls
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '/'
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket
    // assume admin's cafeId is available in stats response; if not, admin token includes cafeId
    const tokenPayloadRaw = localStorage.getItem('token')
    let cafeId: number | null = null
    try {
      const payload = tokenPayloadRaw ? JSON.parse(atob((tokenPayloadRaw as string).split('.')[1])) : null
      cafeId = payload?.cafeId ?? null
    } catch {}
    if (cafeId) socket.emit('join', `room_${cafeId}`)

    socket.on('waiter_called', (payload: WaiterCall) => {
      setCalls((c) => [payload, ...c])
    })

    socket.on('waiter_acknowledged', (payload: any) => {
      // remove or mark acknowledged
      setCalls((c) => c.filter((x) => x.id !== payload.id))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  if (loading) return <div className="p-6">Loading...</div>
  if (!stats) return <div className="p-6">Failed to load stats</div>

  return (
    <ErrorBoundary>
      <NProgressProvider />
      <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Performance Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card label="Revenue (Today)" value={`${stats.revenue.today} MAD`} />
        <Card label="Orders (Today)" value={`${stats.ordersCountToday}`} />
        <Card label="New Customers (30d)" value={`${stats.newCustomers}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line chart */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Daily Sales (30 days)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={stats.dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top products & peak hours */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Top Selling Products</h3>
            <ul className="space-y-2">
              {stats.top.map((t: any) => (
                <li key={t.productId} className="flex justify-between">
                  <div>{t.name || `Product ${t.productId}`}</div>
                  <div className="text-sm text-gray-600">{t.quantity}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Peak Hours</h3>
            <div className="flex flex-col">
              {stats.peakHours.map((p: any) => (
                <div key={p.hour} className="flex justify-between">
                  <div>{p.hour}:00</div>
                  <div>{p.count} orders</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent completed orders table */}
      <div className="mt-6 bg-white p-4 rounded shadow">
        {/* Sticky waiter calls */}
        {calls.length > 0 && (
          <div className="fixed top-20 right-4 z-50 space-y-2">
            {calls.map((c: WaiterCall) => (
              <div key={c.id} className="bg-red-50 border-l-4 border-red-500 p-3 rounded shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">Customer needs help (Table {c.tableId})</div>
                  <div className="text-sm text-gray-500">{new Date(c.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => {
                    // emit ack
                    const socket = socketRef.current
                    if (!socket) return
                    // admin should know cafeId; try to decode token
                    const token = localStorage.getItem('token')
                    let cafeId: number | null = null
                    try { cafeId = token ? JSON.parse(atob(token.split('.')[1])).cafeId : null } catch (e) {}
                    socket.emit('ack_call', { cafeId, callId: c.id })
                  }}>Coming</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="font-semibold mb-2">Recently Completed Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="py-2">Order</th>
                <th>Date</th>
                <th>Table</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCompleted.map((o: any) => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">#{o.id}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>{o.tableId}</td>
                  <td>{o.totalPrice} MAD</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  )
}
