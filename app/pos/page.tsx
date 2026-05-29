'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'
import {
  LogOut, Bell, BellOff, ChevronLeft, ShoppingCart,
  UtensilsCrossed, LayoutGrid, Plus, Minus, Trash2,
  Banknote, CreditCard, Smartphone, Printer, Check,
  Loader2, AlertTriangle, RefreshCw, Clock3
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type TableColor = 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'
type MobileTab  = 'tables' | 'menu' | 'cart'
type PayMethod  = 'CASH' | 'CARD' | 'ONLINE'

interface PosTable  { id: string; tableNumber: number; qrToken: string; isActive: boolean; status: TableColor }
interface Staff     { id: string; name: string; role: string }
interface OrderItem { id: string; quantity: number; notes: string | null; unitPrice: number; commissionRate: number; product: { nameAr: string; nameEn: string; nameFr: string } }
interface TableOrder { id: string; totalPrice: number; totalCommission: number; payMethod: string; orderSource: string; billStatus: string; createdAt: string; items: OrderItem[] }
interface MenuItem   { id: string; nameEn: string; nameAr: string; nameFr: string; price: number; imageUrl: string | null }
interface MenuCat    { id: string; nameEn: string; nameAr: string; order: number; products: MenuItem[] }
interface CartItem   { productId: string; name: string; price: number; qty: number }

// ─── Audio ────────────────────────────────────────────────────────────────────

function beep(ctx: AudioContext, freq = 880, dur = 0.18, vol = 0.4) {
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.type = 'sine'; osc.frequency.value = freq
  g.gain.setValueAtTime(vol, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  osc.start(); osc.stop(ctx.currentTime + dur + 0.05)
}
function alertBeep(ctx: AudioContext) { beep(ctx, 880, 0.15, 0.35); setTimeout(() => beep(ctx, 660, 0.15, 0.35), 200) }

// ─── Receipt ──────────────────────────────────────────────────────────────────

function printReceipt(cafeName: string, tableNumber: number, order: TableOrder, currency: string) {
  const lines = order.items.map(i => `<tr>
    <td>${i.product.nameEn || i.product.nameAr}</td>
    <td style="text-align:center">${i.quantity}</td>
    <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td>
  </tr>`).join('')
  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.d{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  td{padding:2px 0;vertical-align:top}.tot td{font-weight:bold;border-top:1px dashed #000;padding-top:4px}
  @media print{body{width:80mm}@page{margin:0;size:80mm auto}}</style></head>
  <body><div class="c b" style="font-size:16px">☕ ${cafeName}</div>
  <div class="c" style="font-size:10px;color:#555">Smart Menu POS</div><div class="d"></div>
  <div>Table: <b>${tableNumber}</b></div><div>Date: ${new Date().toLocaleString()}</div><div class="d"></div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${lines}</tbody>
  <tfoot><tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${order.totalPrice.toFixed(2)} ${currency}</td></tr></tfoot>
  </table><div class="d"></div><div class="c" style="font-size:10px">Thank you · شكراً · Merci</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`)
  win.document.close()
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL      = process.env.NEXT_PUBLIC_SOCKET_URL || ''
const BEEP_INTERVAL   = 5000

const TABLE_STYLE: Record<TableColor, string> = {
  INACTIVE:       'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed',
  EMPTY:          'bg-gray-800/60 border-gray-700 hover:border-gray-500 cursor-pointer active:scale-95',
  OPEN_QR:        'bg-sky-900/50 border-sky-500 hover:border-sky-300 cursor-pointer active:scale-95',
  OPEN_MANUAL:    'bg-amber-900/50 border-amber-500 hover:border-amber-300 cursor-pointer active:scale-95',
  BILL_REQUESTED: 'bg-red-900/70 border-red-500 cursor-pointer active:scale-95',
}
const TABLE_LABEL: Record<TableColor, string> = {
  INACTIVE: '—', EMPTY: '', OPEN_QR: 'QR', OPEN_MANUAL: 'POS', BILL_REQUESTED: '💳'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function POSPage() {
  // auth
  const [posToken,    setPosToken]    = useState<string | null>(null)
  const [staff,       setStaff]       = useState<Staff | null>(null)
  const [cafeId,      setCafeId]      = useState('')
  const [cafeName,    setCafeName]    = useState('Café')
  const [cafeLogoUrl, setCafeLogoUrl] = useState<string | null>(null)
  const [currency,    setCurrency]    = useState('MAD')
  // login
  const [pin,         setPin]         = useState('')
  const [subdomain,   setSubdomain]   = useState('')
  const [loginErr,    setLoginErr]    = useState('')
  const [logging,     setLogging]     = useState(false)
  const [loadingCafe, setLoadingCafe] = useState(false)
  // tables
  const [tables,      setTables]      = useState<PosTable[]>([])
  const [loadTables,  setLoadTables]  = useState(false)
  const [alertIds,    setAlertIds]    = useState<Set<string>>(new Set())
  const [muted,       setMuted]       = useState(false)
  // menu
  const [menuCats,    setMenuCats]    = useState<MenuCat[]>([])
  const [activeCat,   setActiveCat]   = useState('')
  // selected table / order
  const [selTable,    setSelTable]    = useState<PosTable | null>(null)
  const [tableOrder,  setTableOrder]  = useState<TableOrder | null>(null)
  const [loadOrder,   setLoadOrder]   = useState(false)
  // cart (for manual POS orders on empty tables)
  const [cart,        setCart]        = useState<CartItem[]>([])
  // checkout
  const [payMethod,   setPayMethod]   = useState<PayMethod>('CASH')
  const [cashInput,   setCashInput]   = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutErr, setCheckoutErr] = useState('')
  const [doneTable,   setDoneTable]   = useState<number | null>(null)
  // ui
  const [mobileTab,   setMobileTab]   = useState<MobileTab>('tables')
  const [clock,       setClock]       = useState('')
  const [priceBanner, setPriceBanner] = useState(false)
  // refs
  const mutedRef    = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const beepRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef   = useRef<Socket | null>(null)

  useEffect(() => { mutedRef.current = muted }, [muted])

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    tick(); const id = setInterval(tick, 10000); return () => clearInterval(id)
  }, [])

  // Boot — restore session
  useEffect(() => {
    const t = localStorage.getItem('posToken')
    if (!t) return
    try {
      const p = JSON.parse(atob(t.split('.')[1]))
      if (p.staffRole === 'WAITER') { window.location.href = '/waiter'; return }
      setPosToken(t); setCafeId(p.cafeId)
      setStaff({ id: p.staffId, name: localStorage.getItem('staffName') ?? '', role: p.staffRole })
    } catch { localStorage.removeItem('posToken') }
  }, [])

  // Auto-detect subdomain + fetch cafe branding
  useEffect(() => {
    const parts = window.location.hostname.split('.')
    const det   = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : ''
    const saved = localStorage.getItem('posLastSubdomain') ?? ''
    const sub   = det || saved
    if (sub) setSubdomain(sub)
    if (!sub) return
    setLoadingCafe(true)
    fetch(`/api/public/cafe/${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setCafeName(d.name); setCafeLogoUrl(d.logoUrl ?? null) }
    }).finally(() => setLoadingCafe(false))
  }, [])

  // Audio
  const stopBeeps = useCallback(() => { if (beepRef.current) { clearInterval(beepRef.current); beepRef.current = null } }, [])
  const startBeeps = useCallback(() => {
    if (beepRef.current) return
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtxRef.current
    const fire = () => { if (!mutedRef.current) alertBeep(ctx) }
    fire(); beepRef.current = setInterval(fire, BEEP_INTERVAL)
  }, [])
  useEffect(() => { alertIds.size === 0 ? stopBeeps() : startBeeps() }, [alertIds, startBeeps, stopBeeps])

  // Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(''); setLogging(true)
    try {
      const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), pinCode: pin.trim(), action: 'login' }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      localStorage.setItem('posToken', data.token)
      localStorage.setItem('cafeId', payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomain.trim())
      localStorage.setItem('staffName', data.staff?.name ?? '')
      setPin('')
      if (data.staff?.role === 'WAITER') { window.location.href = '/waiter'; return }
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  // Fetch tables
  const fetchTables = useCallback(async (token: string) => {
    setLoadTables(true)
    try {
      const res = await fetch('/api/pos/tables-status', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (res.status === 401) logout(); return }
      const data = await res.json()
      setTables(data.tables ?? [])
      setAlertIds(prev => {
        const next = new Set(prev)
        ;(data.tables as PosTable[]).forEach(t => { if (t.status === 'BILL_REQUESTED') next.add(t.id) })
        return next
      })
    } finally { setLoadTables(false) }
  }, [])

  // Fetch menu
  const fetchMenu = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/pos/menu', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setMenuCats(data.categories ?? [])
      setCurrency(data.currency ?? 'MAD')
      if (data.categories?.length) setActiveCat(data.categories[0].id)
    } catch {}
  }, [])

  useEffect(() => {
    if (!posToken || !cafeId) return
    fetchTables(posToken); fetchMenu(posToken)
    const id = setInterval(() => fetchTables(posToken), 30_000)
    return () => clearInterval(id)
  }, [posToken, cafeId, fetchTables, fetchMenu])

  // Socket
  useEffect(() => {
    if (!posToken || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, { auth: { token: posToken }, transports: ['polling', 'websocket'] })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('join', `room_${cafeId}`))
    socket.on('price_updated', () => setPriceBanner(true))
    socket.on('bill_requested', (p: { tableId: string }) => {
      setTables(prev => prev.map(t => t.id === p.tableId ? { ...t, status: 'BILL_REQUESTED' as TableColor } : t))
      setAlertIds(prev => new Set(prev).add(p.tableId))
    })
    socket.on('new_order', (o: { tableId?: string; orderSource?: string }) => {
      if (!o.tableId) return
      const color: TableColor = o.orderSource === 'QR_CODE' ? 'OPEN_QR' : 'OPEN_MANUAL'
      setTables(prev => prev.map(t => t.id === o.tableId ? { ...t, status: color } : t))
    })
    return () => { socket.disconnect(); socketRef.current = null }
  }, [posToken, cafeId])

  function logout() {
    localStorage.removeItem('posToken'); localStorage.removeItem('cafeId')
    setPosToken(null); setStaff(null); setCafeId(''); stopBeeps()
  }

  // Open table
  async function openTable(table: PosTable) {
    if (table.status === 'INACTIVE') return
    setSelTable(table); setTableOrder(null); setCheckoutErr(''); setCart([])
    setPayMethod('CASH'); setCashInput(''); setDoneTable(null)
    setMobileTab('cart')
    if (table.status === 'EMPTY') return
    setLoadOrder(true)
    try {
      const res = await fetch(`/api/pos/orders/table/${table.id}`, { headers: { Authorization: `Bearer ${posToken}` } })
      if (res.ok) { const data = await res.json(); setTableOrder(data.orders?.[0] ?? null) }
    } finally { setLoadOrder(false) }
  }

  // Cart helpers
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { productId: item.id, name: item.nameEn || item.nameAr, price: item.price, qty: 1 }]
    })
    if (mobileTab === 'menu') setMobileTab('cart')
  }
  function updateQty(productId: string, delta: number) {
    setCart(prev => prev.map(c => c.productId === productId ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }
  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(c => c.productId !== productId))
  }

  // Checkout
  async function handleCheckout(doPrint: boolean) {
    if (!selTable || !posToken) return
    setCheckingOut(true); setCheckoutErr('')
    try {
      // Manual order (empty table or cart)
      if (!tableOrder && cart.length > 0) {
        const createRes = await fetch('/api/pos/orders', {
          method: 'POST', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: selTable.id, items: cart.map(c => ({ productId: c.productId, quantity: c.qty })), payMethod })
        })
        if (!createRes.ok) { const d = await createRes.json(); setCheckoutErr(d.error ?? 'Failed'); return }
        const created = await createRes.json()
        const orderId  = created.order?.id
        if (orderId) {
          const coRes = await fetch(`/api/pos/orders/${orderId}/checkout`, {
            method: 'PATCH', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ payMethod, printReceipt: doPrint })
          })
          if (!coRes.ok) { const d = await coRes.json(); setCheckoutErr(d.error ?? 'Checkout failed'); return }
          if (doPrint) {
            const fakeOrder: TableOrder = { id: orderId, totalPrice: cart.reduce((s,c)=>s+c.price*c.qty,0), totalCommission:0, payMethod, orderSource:'POS_MANUAL', billStatus:'PAID', createdAt: new Date().toISOString(),
              items: cart.map(c=>({ id:c.productId, quantity:c.qty, notes:null, unitPrice:c.price, commissionRate:0, product:{nameEn:c.name,nameAr:c.name,nameFr:c.name} })) }
            printReceipt(cafeName, selTable.tableNumber, fakeOrder, currency)
          }
        }
      } else if (tableOrder) {
        // Existing order checkout
        const res = await fetch(`/api/pos/orders/${tableOrder.id}/checkout`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payMethod, printReceipt: doPrint })
        })
        if (!res.ok) { const d = await res.json(); setCheckoutErr(d.error ?? 'Failed'); return }
        if (doPrint) printReceipt(cafeName, selTable.tableNumber, tableOrder, currency)
      }

      setDoneTable(selTable.tableNumber)
      setTables(prev => prev.map(t => t.id === selTable.id ? { ...t, status: 'EMPTY' } : t))
      setAlertIds(prev => { const n = new Set(prev); n.delete(selTable.id); return n })
      setCart([]); setTableOrder(null)
      setTimeout(() => { setSelTable(null); setDoneTable(null); setMobileTab('tables') }, 2000)
    } finally { setCheckingOut(false) }
  }

  const cartTotal   = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const orderTotal  = tableOrder?.totalPrice ?? cartTotal
  const cashVal     = parseFloat(cashInput) || 0
  const change      = payMethod === 'CASH' && cashVal > 0 ? cashVal - orderTotal : null
  const cartCount   = cart.reduce((s, c) => s + c.qty, 0)
  const alertCount  = alertIds.size
  const activeItems = menuCats.find(c => c.id === activeCat)?.products ?? []
  const isManual    = !tableOrder && cart.length === 0
  const hasOrder    = !!tableOrder || cart.length > 0

  // ─── PIN Login ──────────────────────────────────────────────────────────────
  if (!posToken) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" dir="ltr">
        {cafeLogoUrl && (
          <div className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: `url(${cafeLogoUrl})` }} />
        )}
        <div className="relative z-10 w-full max-w-sm">
          {/* Branding */}
          <div className="text-center mb-6">
            {loadingCafe ? (
              <div className="w-20 h-20 rounded-2xl bg-gray-800 animate-pulse mx-auto mb-3" />
            ) : cafeLogoUrl ? (
              <img src={cafeLogoUrl} alt={cafeName} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-xl" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3 text-4xl shadow-xl">☕</div>
            )}
            <h1 className="text-2xl font-extrabold text-white">{cafeName}</h1>
            <p className="text-gray-500 text-sm mt-1">Point of Sale — Staff Login</p>
            {subdomain && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-gray-800 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-400">{subdomain}</span>
                <button onClick={() => setSubdomain('')} className="text-gray-600 hover:text-gray-400 text-xs ml-1">×</button>
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Subdomain (if not detected) */}
            {!subdomain && (
              <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)}
                placeholder="Cafe subdomain" required
                className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            )}

            {/* PIN display */}
            <div className="flex justify-center gap-3 py-2">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-5 h-5 rounded-full transition-all ${pin.length > i ? 'bg-emerald-500 scale-110' : 'bg-gray-700'}`} />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','',  '0','⌫'].map((k, i) => (
                <button key={i} type="button"
                  onClick={() => {
                    if (k === '⌫') setPin(p => p.slice(0, -1))
                    else if (k && pin.length < 6) setPin(p => p + k)
                  }}
                  className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
                    k === '' ? 'invisible' :
                    k === '⌫' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' :
                    'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {loginErr && (
              <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {loginErr}
              </div>
            )}

            <button type="submit" disabled={logging || !subdomain || pin.length < 4}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-900/40">
              {logging ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'LOGIN'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Main POS ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden select-none" dir="ltr">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 h-14 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          {cafeLogoUrl
            ? <img src={cafeLogoUrl} alt={cafeName} className="w-8 h-8 rounded-lg object-cover" />
            : <Image src="/assets/logo.png" alt="SmartMenu" width={32} height={32} className="rounded-lg" />}
          <div className="hidden sm:block">
            <p className="text-white font-extrabold text-sm leading-none">{cafeName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{staff?.name} · {staff?.role}</p>
          </div>
          {/* Selected table chip */}
          {selTable && (
            <div className="flex items-center gap-1.5 bg-emerald-900/50 border border-emerald-700 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
              <LayoutGrid className="w-3 h-3" />
              Table {selTable.tableNumber}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-sm font-mono mr-2 hidden sm:block">{clock}</span>
          {alertCount > 0 && (
            <div className="flex items-center gap-1 bg-red-950 border border-red-800 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse mr-1">
              <Bell className="w-3.5 h-3.5" /> {alertCount}
            </div>
          )}
          <button onClick={() => setMuted(m => !m)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${muted ? 'text-gray-600 hover:text-gray-400' : 'text-emerald-500 hover:bg-emerald-950'}`}>
            {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          <button onClick={() => fetchTables(posToken!)} disabled={loadTables}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loadTables ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-400 text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Price update banner */}
      {priceBanner && (
        <div className="flex items-center justify-between bg-amber-950/80 border-b border-amber-800/50 px-4 py-2 text-xs text-amber-400 shrink-0">
          <span>⚠️ Menu prices updated — manual orders may need repricing</span>
          <button onClick={() => setPriceBanner(false)} className="text-amber-600 hover:text-amber-400 ml-4">✕</button>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL: Tables + Menu Browser */}
        <div className={`flex flex-col border-r border-gray-800 overflow-hidden
          ${selTable ? 'hidden md:flex md:w-[55%]' : 'flex w-full md:w-[55%]'}`}>

          {/* Table map */}
          <div className="shrink-0 border-b border-gray-800 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tables</span>
              <div className="flex gap-2 text-[10px] text-gray-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block"/>QR</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>POS</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Bill</span>
              </div>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-7 gap-2">
              {tables.map(t => {
                const isAlert = alertIds.has(t.id)
                const isSelected = selTable?.id === t.id
                return (
                  <button key={t.id} disabled={t.status === 'INACTIVE' || t.status === 'EMPTY'}
                    onClick={() => openTable(t)}
                    className={`relative rounded-xl border-2 p-2 flex flex-col items-center transition-all
                      ${TABLE_STYLE[t.status]}
                      ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-gray-950' : ''}
                      ${isAlert ? 'animate-pulse' : ''}`}>
                    <span className={`text-base font-extrabold ${
                      t.status === 'INACTIVE' ? 'text-gray-700' :
                      t.status === 'EMPTY'    ? 'text-gray-500' : 'text-white'
                    }`}>{t.tableNumber}</span>
                    {TABLE_LABEL[t.status] && (
                      <span className={`text-[9px] font-bold mt-0.5 ${
                        t.status === 'OPEN_QR'        ? 'text-sky-400' :
                        t.status === 'OPEN_MANUAL'    ? 'text-amber-400' :
                        t.status === 'BILL_REQUESTED' ? 'text-red-400' : 'text-gray-600'
                      }`}>{TABLE_LABEL[t.status]}</span>
                    )}
                    {isAlert && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-gray-950" />}
                  </button>
                )
              })}
              {tables.length === 0 && !loadTables && (
                <p className="col-span-full text-gray-600 text-xs text-center py-4">No tables — set up from admin panel</p>
              )}
            </div>
          </div>

          {/* Menu Browser */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="shrink-0 border-b border-gray-800 flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
              {menuCats.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeCat === cat.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}>
                  {cat.nameEn || cat.nameAr}
                </button>
              ))}
              {menuCats.length === 0 && (
                <span className="text-gray-600 text-xs py-2">No menu — create from admin panel</span>
              )}
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {activeItems.map(item => (
                  <button key={item.id} onClick={() => { if (selTable) addToCart(item) }}
                    disabled={!selTable}
                    className={`bg-gray-900 border border-gray-800 rounded-2xl p-3 text-left transition-all active:scale-95
                      ${selTable ? 'hover:border-emerald-700 hover:bg-gray-800 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.nameEn} className="w-full h-16 object-cover rounded-xl mb-2" />
                    ) : (
                      <div className="w-full h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2 text-2xl">
                        <UtensilsCrossed className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                    <p className="text-white font-bold text-xs leading-tight truncate">{item.nameEn || item.nameAr}</p>
                    <p className="text-emerald-400 font-extrabold text-sm mt-1">{item.price.toFixed(2)} <span className="text-xs font-normal text-gray-500">{currency}</span></p>
                    <div className={`mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-colors
                      ${selTable ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800/60' : 'bg-gray-800 text-gray-600'}`}>
                      <Plus className="w-3 h-3" /> Add
                    </div>
                  </button>
                ))}
              </div>
              {menuCats.length > 0 && activeItems.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">No items in this category</p>
              )}
              {!selTable && menuCats.length > 0 && (
                <div className="mt-4 bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <LayoutGrid className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Select a table to add items</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Order + Checkout */}
        <div className={`flex flex-col overflow-hidden
          ${selTable ? 'flex w-full md:w-[45%]' : 'hidden md:flex md:w-[45%]'}`}>

          {selTable ? (
            <>
              {/* Panel header */}
              <div className="shrink-0 border-b border-gray-800 px-4 h-12 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelTable(null); setMobileTab('tables') }}
                    className="md:hidden w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-extrabold text-white">Table {selTable.tableNumber}</span>
                  {selTable.status !== 'EMPTY' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selTable.status === 'OPEN_QR'     ? 'bg-sky-900 text-sky-300' :
                      selTable.status === 'OPEN_MANUAL' ? 'bg-amber-900 text-amber-300' :
                      'bg-red-900 text-red-300'
                    }`}>{selTable.status === 'OPEN_QR' ? 'QR Order' : selTable.status === 'OPEN_MANUAL' ? 'POS Order' : '⚡ Bill Req.'}</span>
                  )}
                </div>
                {(cart.length > 0 || tableOrder) && (
                  <span className="text-emerald-400 font-extrabold text-sm">{orderTotal.toFixed(2)} {currency}</span>
                )}
              </div>

              {/* Order items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadOrder && (
                  <div className="flex items-center justify-center py-12 gap-2 text-gray-500 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading order…
                  </div>
                )}

                {/* Done state */}
                {doneTable && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-white font-extrabold text-lg">Table {doneTable} — Done!</p>
                    <p className="text-gray-400 text-sm">Payment recorded</p>
                  </div>
                )}

                {!loadOrder && !doneTable && (
                  <>
                    {/* QR/existing order items */}
                    {tableOrder && tableOrder.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                          <span className="text-white font-extrabold text-sm">{item.quantity}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{item.product.nameEn || item.product.nameAr}</p>
                          {item.notes && <p className="text-gray-500 text-xs">{item.notes}</p>}
                        </div>
                        <span className="text-gray-300 tabular-nums text-sm font-medium shrink-0">
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* Cart items (manual) */}
                    {cart.map(item => (
                      <div key={item.productId} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item.productId, -1)}
                            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white active:scale-95 transition-all">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-white font-extrabold text-sm">{item.qty}</span>
                          <button onClick={() => updateQty(item.productId, 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 flex items-center justify-center text-emerald-400 hover:text-white active:scale-95 transition-all">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-gray-500 text-xs">{item.price.toFixed(2)} × {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-300 tabular-nums text-sm">{(item.price * item.qty).toFixed(2)}</span>
                          <button onClick={() => removeFromCart(item.productId)}
                            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-red-900/50 flex items-center justify-center text-gray-600 hover:text-red-400 active:scale-95 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Empty state */}
                    {!tableOrder && cart.length === 0 && !loadOrder && (
                      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                        <ShoppingCart className="w-10 h-10 text-gray-700" />
                        <p className="text-gray-500 text-sm font-medium">No order yet</p>
                        <p className="text-gray-600 text-xs">Browse the menu on the left<br/>to add items to this table</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Checkout panel */}
              {!doneTable && hasOrder && (
                <div className="shrink-0 border-t border-gray-800 p-4 space-y-3">
                  {/* Total row */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-semibold">TOTAL</span>
                    <span className="text-2xl font-extrabold text-white">{orderTotal.toFixed(2)} <span className="text-base font-bold text-gray-400">{currency}</span></span>
                  </div>

                  {/* Payment method */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'CASH',   icon: Banknote,    label: 'Cash'   },
                      { key: 'CARD',   icon: CreditCard,  label: 'Card'   },
                      { key: 'ONLINE', icon: Smartphone,  label: 'Online' },
                    ] as const).map(({ key, icon: Icon, label }) => (
                      <button key={key} onClick={() => setPayMethod(key)}
                        className={`py-3 rounded-xl flex flex-col items-center gap-1 text-xs font-bold transition-all active:scale-95 border-2 ${
                          payMethod === key
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                        }`}>
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Cash amount + change */}
                  {payMethod === 'CASH' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
                          placeholder={`Amount received (${currency})`}
                          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 text-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        {[1, 5, 10].map(add => (
                          <button key={add} onClick={() => setCashInput(v => String((parseFloat(v)||0) + add))}
                            className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-colors active:scale-95">
                            +{add}
                          </button>
                        ))}
                      </div>
                      {change !== null && (
                        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold ${change >= 0 ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                          <span>Change</span>
                          <span>{change >= 0 ? change.toFixed(2) : `Short ${Math.abs(change).toFixed(2)}`} {currency}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {checkoutErr && (
                    <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-xs rounded-xl px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {checkoutErr}
                    </div>
                  )}

                  {/* Checkout buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleCheckout(true)} disabled={checkingOut}
                      className="py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex flex-col items-center gap-1">
                      <Printer className="w-5 h-5" />
                      Print & Pay
                    </button>
                    <button onClick={() => handleCheckout(false)} disabled={checkingOut}
                      className="py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-extrabold text-base active:scale-95 transition-all shadow-lg shadow-emerald-900/50 flex flex-col items-center gap-1">
                      {checkingOut
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <Check className="w-5 h-5" />}
                      {checkingOut ? 'Processing…' : 'CHARGE'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No table selected */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center">
                <LayoutGrid className="w-8 h-8 text-gray-700" />
              </div>
              <div>
                <p className="text-gray-400 font-semibold">No table selected</p>
                <p className="text-gray-600 text-sm mt-1">Tap a table on the left to view or create an order</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tabs ──────────────────────────────────────────────── */}
      <div className="md:hidden shrink-0 border-t border-gray-800 bg-gray-900 flex items-stretch h-16">
        {([
          { key: 'tables', icon: LayoutGrid,  label: 'Tables',  badge: alertCount },
          { key: 'menu',   icon: UtensilsCrossed, label: 'Menu', badge: 0 },
          { key: 'cart',   icon: ShoppingCart, label: 'Order',  badge: cartCount + (tableOrder ? 1 : 0) },
        ] as const).map(({ key, icon: Icon, label, badge }) => (
          <button key={key} onClick={() => {
            setMobileTab(key)
            if (key === 'tables') setSelTable(null)
          }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${
              mobileTab === key ? 'text-emerald-400' : 'text-gray-600'
            }`}>
            <div className="relative">
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
