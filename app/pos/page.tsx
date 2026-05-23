'use client'

/**
 * Mini POS — Cashier Screen
 *
 * Flow:
 *  1. PIN login → POST /api/pos/shift { action:'login' } → posToken stored
 *  2. Tables grid fetched from GET /api/pos/tables-status (refreshed every 30s + socket updates)
 *  3. Socket joins room_{cafeId}, listens for bill_requested → flashes table red + beeps
 *  4. Click a table → checkout modal (load order, choose CASH/CARD + print option)
 *  5. Checkout → PATCH /api/pos/orders/:id/checkout → table turns grey, alarm cleared
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

type TableColor = 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'

interface PosTable {
  id:          string
  tableNumber: number
  qrToken:     string
  isActive:    boolean
  status:      TableColor
}

interface OrderItem {
  id:            string
  quantity:      number
  notes:         string | null
  unitPrice:     number
  commissionRate: number
  product:       { nameAr: string; nameEn: string; nameFr: string }
}

interface TableOrder {
  id:            string
  totalPrice:    number
  totalCommission: number
  paymentMethod: string
  orderSource:   string
  billStatus:    string
  createdAt:     string
  items:         OrderItem[]
}

interface Staff {
  id:   string
  name: string
  role: string
}

// ─── Audio helpers (Web Audio API — no file needed) ───────────────────────────

function createBeep(ctx: AudioContext, freq = 880, duration = 0.18, vol = 0.4) {
  const osc   = ctx.createOscillator()
  const gain  = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type      = 'sine'
  osc.frequency.value  = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration + 0.05)
}

function playAlertBeep(ctx: AudioContext) {
  // Two-tone beep: high + lower
  createBeep(ctx, 880, 0.15, 0.35)
  setTimeout(() => createBeep(ctx, 660, 0.15, 0.35), 200)
}

// ─── Receipt formatter for window.print() ────────────────────────────────────

function printReceipt(cafeName: string, tableNumber: number, order: TableOrder) {
  const lines = order.items.map(i =>
    `<tr>
      <td>${i.product.nameEn || i.product.nameAr}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join('')

  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 8px; }
    .center { text-align: center; }
    .logo { font-size: 16px; font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
    td { padding: 2px 0; vertical-align: top; }
    .total-row td { font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; }
    .footer { text-align: center; font-size: 10px; margin-top: 8px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center logo">☕ ${cafeName}</div>
  <div class="center" style="font-size:10px;color:#555;margin:2px 0">Smart Menu POS</div>
  <div class="divider"></div>
  <div>Table: <strong>${tableNumber}</strong></div>
  <div>Date: ${new Date().toLocaleString()}</div>
  <div class="divider"></div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td style="text-align:right">${order.totalPrice.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="divider"></div>
  <div class="footer">Thank you · شكراً · Merci</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`)
  win.document.close()
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''
const BEEP_INTERVAL_MS = 5000

// ─── Component ────────────────────────────────────────────────────────────────

export default function POSPage() {
  // auth
  const [posToken,  setPosToken]  = useState<string | null>(null)
  const [staff,     setStaff]     = useState<Staff | null>(null)
  const [cafeId,    setCafeId]    = useState('')
  const [cafeName,  setCafeName]  = useState('Café')
  const [cafeLogoUrl, setCafeLogoUrl] = useState<string | null>(null)

  // PIN login form — subdomain auto-detected from hostname
  const [pinInput,       setPinInput]       = useState('')
  const [subdomainInput, setSubdomainInput] = useState('')
  const [loginErr,       setLoginErr]       = useState('')
  const [logging,        setLogging]        = useState(false)
  const [loadingCafe,    setLoadingCafe]    = useState(false)

  // tables
  const [tables,    setTables]    = useState<PosTable[]>([])
  const [loading,   setLoading]   = useState(false)

  // alerts — tableIds with active bill_requested alert
  const [alertIds,  setAlertIds]  = useState<Set<string>>(new Set())

  // mute
  const [muted,     setMuted]     = useState(false)
  const mutedRef = useRef(false)

  // audio
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const beepTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // checkout modal
  const [selectedTable,  setSelectedTable]  = useState<PosTable | null>(null)
  const [tableOrder,     setTableOrder]     = useState<TableOrder | null>(null)
  const [loadingOrder,   setLoadingOrder]   = useState(false)
  const [checkingOut,    setCheckingOut]    = useState(false)
  const [checkoutErr,    setCheckoutErr]    = useState('')

  // socket
  const socketRef = useRef<Socket | null>(null)

  // price update banner — shown when admin changes a product price
  const [priceUpdateBanner, setPriceUpdateBanner] = useState(false)

  // ── sync muted ref ──────────────────────────────────────────────────────────
  useEffect(() => { mutedRef.current = muted }, [muted])

  // ── boot: read stored posToken — redirect WAITER to their dedicated screen ──
  useEffect(() => {
    const t = localStorage.getItem('posToken')
    if (!t) return
    try {
      const p = JSON.parse(atob(t.split('.')[1]))
      if (p.staffRole === 'WAITER') { window.location.href = '/waiter'; return }
      const savedName = localStorage.getItem('staffName') ?? ''
      setPosToken(t)
      setCafeId(p.cafeId)
      setStaff({ id: p.staffId, name: savedName, role: p.staffRole })
    } catch {
      localStorage.removeItem('posToken')
    }
  }, [])

  // ── Auto-detect subdomain from hostname, then fetch cafe branding ──────────
  useEffect(() => {
    const hostname = window.location.hostname   // e.g. "plage.smartrestau.digima.cloud"
    const parts    = hostname.split('.')
    // subdomain exists when there are 3+ parts and the first part isn't "www"
    const detected = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : ''
    const saved    = localStorage.getItem('posLastSubdomain') ?? ''
    const sub      = detected || saved
    if (sub) setSubdomainInput(sub)

    if (!sub) return
    setLoadingCafe(true)
    fetch(`/api/public/cafe/${sub}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setCafeName(d.name); setCafeLogoUrl(d.logoUrl ?? null) }
      })
      .finally(() => setLoadingCafe(false))
  }, [])

  // ── PIN login ───────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr('')
    setLogging(true)
    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomainInput.trim(), pinCode: pinInput.trim(), action: 'login' })
      })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      localStorage.setItem('posToken',         data.token)
      localStorage.setItem('cafeId',           payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomainInput.trim())
      localStorage.setItem('staffName',        data.staff?.name ?? '')
      setPinInput('')
      // Route each role to its dedicated screen
      if (data.staff?.role === 'WAITER') { window.location.href = '/waiter'; return }
      setPosToken(data.token)
      setCafeId(payload.cafeId)
      setStaff(data.staff)
    } catch {
      setLoginErr('Network error')
    } finally {
      setLogging(false)
    }
  }

  // ── fetch tables ────────────────────────────────────────────────────────────
  const fetchTables = useCallback(async (token: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/tables-status', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) { if (res.status === 401) logout(); return }
      const data = await res.json()
      setTables(data.tables ?? [])
      // re-apply existing alerts on refresh
      setAlertIds(prev => {
        const next = new Set(prev)
        ;(data.tables as PosTable[]).forEach(t => {
          if (t.status === 'BILL_REQUESTED') next.add(t.id)
        })
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!posToken || !cafeId) return
    fetchTables(posToken)
    const interval = setInterval(() => fetchTables(posToken), 30_000)
    return () => clearInterval(interval)
  }, [posToken, cafeId, fetchTables])

  // ── audio: start / stop beep loop ──────────────────────────────────────────
  const stopBeeps = useCallback(() => {
    if (beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null }
  }, [])

  const startBeeps = useCallback(() => {
    if (beepTimerRef.current) return          // already running
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    const fire = () => { if (!mutedRef.current) playAlertBeep(ctx) }
    fire()   // immediate first beep
    beepTimerRef.current = setInterval(fire, BEEP_INTERVAL_MS)
  }, [])

  // stop beeps when alertIds becomes empty
  useEffect(() => {
    if (alertIds.size === 0) stopBeeps()
    else startBeeps()
  }, [alertIds, startBeeps, stopBeeps])

  // ── socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!posToken || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth:       { token: posToken },
      transports: ['polling', 'websocket']
    })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join', `room_${cafeId}`))

    // Admin updated a product price — surface a dismissible banner so cashier
    // knows the menu changed (relevant for manual POS order quoting).
    socket.on('price_updated', () => {
      setPriceUpdateBanner(true)
    })

    socket.on('bill_requested', (payload: { id: string; tableId: string; tableNumber: number; createdAt: string }) => {
      // Update table status in-place + add to alertIds
      setTables(prev => prev.map(t =>
        t.id === payload.tableId ? { ...t, status: 'BILL_REQUESTED' as TableColor } : t
      ))
      setAlertIds(prev => new Set(prev).add(payload.tableId))
    })

    // When a QR or POS order arrives → update table color
    socket.on('new_order', (o: { tableId?: string; orderSource?: string }) => {
      if (!o.tableId) return
      const color: TableColor = o.orderSource === 'QR_CODE' ? 'OPEN_QR' : 'OPEN_MANUAL'
      setTables(prev => prev.map(t =>
        t.id === o.tableId ? { ...t, status: color } : t
      ))
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [posToken, cafeId])

  // ── logout ──────────────────────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem('posToken')
    localStorage.removeItem('cafeId')
    setPosToken(null)
    setStaff(null)
    setCafeId('')
    stopBeeps()
  }

  // ── open table modal ────────────────────────────────────────────────────────
  async function openTable(table: PosTable) {
    if (table.status === 'EMPTY') return    // nothing to show
    setSelectedTable(table)
    setTableOrder(null)
    setCheckoutErr('')
    setLoadingOrder(true)
    try {
      const res = await fetch(`/api/pos/orders/table/${table.id}`, {
        headers: { Authorization: `Bearer ${posToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const orders: TableOrder[] = data.orders ?? []
        setTableOrder(orders[0] ?? null)
      }
    } finally {
      setLoadingOrder(false)
    }
  }

  // ── checkout ────────────────────────────────────────────────────────────────
  async function handleCheckout(printR: boolean, method: 'CASH' | 'CARD' | 'ONLINE' = 'CASH') {
    if (!tableOrder || !selectedTable || !posToken) return
    setCheckingOut(true)
    setCheckoutErr('')
    try {
      const res = await fetch(`/api/pos/orders/${tableOrder.id}/checkout`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentMethod: method, printReceipt: printR })
      })
      const data = await res.json()
      if (!res.ok) { setCheckoutErr(data.error ?? 'Checkout failed'); return }

      if (printR) printReceipt(cafeName, selectedTable.tableNumber, tableOrder)

      // Clear table state immediately — no need to wait for next poll
      setTables(prev => prev.map(t =>
        t.id === selectedTable.id ? { ...t, status: 'EMPTY' } : t
      ))
      setAlertIds(prev => {
        const next = new Set(prev); next.delete(selectedTable.id); return next
      })
      setSelectedTable(null)
    } finally {
      setCheckingOut(false)
    }
  }

  // ── PIN login screen ────────────────────────────────────────────────────────
  if (!posToken) {
    return (
      <div className="relative min-h-screen bg-gray-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Watermark background logo */}
        {cafeLogoUrl && (
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: `url(${cafeLogoUrl})`, filter: 'blur(2px)' }}
          />
        )}

        <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-sm p-8">
          {/* Cafe branding */}
          <div className="flex flex-col items-center mb-8">
            {loadingCafe ? (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 animate-pulse mb-3" />
            ) : cafeLogoUrl ? (
              <img src={cafeLogoUrl} alt={cafeName} className="w-16 h-16 rounded-2xl object-cover shadow mb-3" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center mb-3 text-3xl shadow">☕</div>
            )}
            <h1 className="text-xl font-extrabold text-gray-900">{cafeName}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Smart Resto — Staff Login</p>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">CASHIER</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">WAITER</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">SUPERVISOR</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Subdomain — hidden if auto-detected, shown as small editable field otherwise */}
            {!subdomainInput ? (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cafe ID</label>
                <input
                  type="text"
                  value={subdomainInput}
                  onChange={e => {
                    setSubdomainInput(e.target.value)
                    setLoginErr('')
                    if (e.target.value.length > 2) {
                      fetch(`/api/public/cafe/${e.target.value.trim().toLowerCase()}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(d => { if (d) { setCafeName(d.name); setCafeLogoUrl(d.logoUrl ?? null) } })
                    }
                  }}
                  placeholder="cafe-subdomain"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-xs text-amber-700 font-medium">📍 {subdomainInput}</span>
                <button type="button" onClick={() => setSubdomainInput('')} className="text-xs text-gray-400 hover:text-gray-600 underline">change</button>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">PIN Code</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
                autoFocus
              />
            </div>

            {loginErr && <p className="text-red-500 text-sm text-center">{loginErr}</p>}

            <button
              type="submit"
              disabled={logging || !subdomainInput}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 text-base"
            >
              {logging ? 'Logging in…' : 'Login →'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Main POS screen ─────────────────────────────────────────────────────────
  const alertCount = alertIds.size

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="ltr">

      {/* ── Header ── */}
      <header className={`border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 ${
        staff?.role === 'SUPERVISOR'
          ? 'bg-violet-950 border-violet-800'
          : 'bg-gray-900 border-gray-800'
      }`}>
        <div className="flex items-center gap-3">
          <Image src="/assets/logo.png" alt="Smart Resto" width={32} height={32} className="rounded-lg" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-extrabold text-white leading-none text-sm">Mini POS</p>
              {staff?.role === 'SUPERVISOR' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white">SUPERVISOR</span>
              )}
              {staff?.role === 'CASHIER' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">CASHIER</span>
              )}
            </div>
            {staff && <p className="text-xs text-gray-400 mt-0.5">{staff.name || staff.role}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {alertCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-extrabold w-7 h-7 rounded-full flex items-center justify-center animate-pulse">
              {alertCount}
            </span>
          )}
          <button
            onClick={() => setMuted(m => !m)}
            title={muted ? 'Unmute alerts' : 'Mute alerts'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${
              muted ? 'bg-gray-700 text-gray-400' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            }`}
          >
            {muted ? '🔇' : '🔔'}
          </button>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Price-update banner ── */}
      {priceUpdateBanner && (
        <div className="flex items-center justify-between bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300">
          <span>⚠️ Menu prices updated by admin — manual orders may need repricing.</span>
          <button
            onClick={() => setPriceUpdateBanner(false)}
            className="ml-4 text-amber-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1 text-xs flex-wrap">
        <LegendDot color="bg-gray-600 opacity-50" label="Inactive" />
        <LegendDot color="bg-gray-700" label="Empty" />
        <LegendDot color="bg-sky-500"  label="QR Order" />
        <LegendDot color="bg-amber-500" label="Manual" />
        <LegendDot color="bg-red-500 animate-pulse" label="Bill Requested" />
        {loading && <span className="text-gray-500 ml-auto">↻ refreshing…</span>}
      </div>

      {/* ── Tables Grid ── */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map(table => (
          <TableCard
            key={table.id}
            table={table}
            isAlerting={alertIds.has(table.id)}
            onClick={() => openTable(table)}
          />
        ))}
        {tables.length === 0 && !loading && (
          <p className="col-span-full text-center text-gray-500 py-16 text-sm">No tables found.</p>
        )}
      </div>

      {/* ── Checkout Modal ── */}
      {selectedTable && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedTable(null) }}
        >
          <div className="bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="font-extrabold text-white">Table {selectedTable.tableNumber}</h2>
                <p className="text-xs text-gray-400 capitalize">{selectedTable.status.toLowerCase().replace('_', ' ')}</p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="text-gray-500 hover:text-white w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center transition-colors"
              >✕</button>
            </div>

            {/* Order items */}
            <div className="px-5 py-4 max-h-72 overflow-y-auto">
              {loadingOrder && <p className="text-gray-400 text-sm text-center py-6">Loading order…</p>}

              {!loadingOrder && !tableOrder && (
                <p className="text-gray-400 text-sm text-center py-6">No open order found for this table.</p>
              )}

              {tableOrder && (
                <>
                  <ul className="space-y-2 mb-4">
                    {tableOrder.items.map(item => (
                      <li key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-200">
                          <span className="font-bold text-white">{item.quantity}×</span>{' '}
                          {item.product.nameEn || item.product.nameAr}
                          {item.notes && <span className="text-gray-500 text-xs ml-1">({item.notes})</span>}
                        </span>
                        <span className="text-gray-400 tabular-nums">
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-dashed border-gray-700 pt-3 flex justify-between font-extrabold text-base">
                    <span>Total</span>
                    <span className="text-amber-400">{tableOrder.totalPrice.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Checkout actions */}
            {tableOrder && (
              <div className="px-5 pb-5 space-y-2">
                {checkoutErr && <p className="text-red-400 text-xs text-center">{checkoutErr}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCheckout(true, 'CASH')}
                    disabled={checkingOut}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-extrabold py-3.5 rounded-2xl text-sm active:scale-95 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xl">🖨️</span>
                    <span>Print Receipt</span>
                    <span className="text-xs font-normal opacity-75">Cash</span>
                  </button>
                  <button
                    onClick={() => handleCheckout(false, 'CASH')}
                    disabled={checkingOut}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm active:scale-95 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xl">✅</span>
                    <span>Digital Only</span>
                    <span className="text-xs font-normal opacity-75">Cash</span>
                  </button>
                  <button
                    onClick={() => handleCheckout(false, 'CARD')}
                    disabled={checkingOut}
                    className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm active:scale-95 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xl">💳</span>
                    <span>Card</span>
                    <span className="text-xs font-normal opacity-75">No print</span>
                  </button>
                  <button
                    onClick={() => handleCheckout(false, 'ONLINE')}
                    disabled={checkingOut}
                    className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm active:scale-95 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xl">📱</span>
                    <span>Online</span>
                    <span className="text-xs font-normal opacity-75">No print</span>
                  </button>
                </div>
                {checkingOut && <p className="text-center text-gray-400 text-xs">Processing…</p>}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableCard({ table, isAlerting, onClick }: {
  table:     PosTable
  isAlerting: boolean
  onClick:   () => void
}) {
  const base   = 'rounded-2xl p-3 flex flex-col items-center gap-1 select-none transition-all border-2'
  const styles: Record<TableColor, string> = {
    INACTIVE:       'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed',
    EMPTY:          'bg-gray-800 border-gray-700 hover:border-gray-500 cursor-pointer active:scale-95',
    OPEN_QR:        'bg-sky-900/60 border-sky-500 hover:border-sky-300 cursor-pointer active:scale-95',
    OPEN_MANUAL:    'bg-amber-900/60 border-amber-500 hover:border-amber-300 cursor-pointer active:scale-95',
    BILL_REQUESTED: 'bg-red-900/80 border-red-500 hover:border-red-300 cursor-pointer active:scale-95',
  }
  const icons: Record<TableColor, string> = {
    INACTIVE: '🔒', EMPTY: '🪑', OPEN_QR: '📱', OPEN_MANUAL: '🖊️', BILL_REQUESTED: '💳'
  }

  return (
    <button
      onClick={table.status === 'INACTIVE' ? undefined : onClick}
      className={`${base} ${styles[table.status]} ${isAlerting ? 'pos-pulse' : ''}`}
      disabled={table.status === 'INACTIVE' || table.status === 'EMPTY'}
      title={table.status === 'INACTIVE' ? 'Table inactive — activate from admin panel' : undefined}
    >
      <span className="text-2xl">{icons[table.status]}</span>
      <span className={`font-extrabold text-sm ${
        table.status === 'INACTIVE' ? 'text-gray-600' :
        table.status === 'EMPTY'    ? 'text-gray-500' : 'text-white'
      }`}>
        {table.tableNumber}
      </span>
      {table.status === 'INACTIVE' && (
        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">inactive</span>
      )}
      {isAlerting && (
        <span className="text-[10px] font-bold text-red-300 uppercase tracking-wide animate-pulse">Bill!</span>
      )}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-400">
      <span className={`w-2.5 h-2.5 rounded-full inline-block ${color}`} />
      {label}
    </span>
  )
}
