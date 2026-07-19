'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import Image from 'next/image'
import {
  LogOut, Bell, BellOff, ChevronLeft, ShoppingCart,
  UtensilsCrossed, LayoutGrid, Plus, Minus, Trash2,
  Printer, Check, Loader2, AlertTriangle, RefreshCw, Bike, X
} from 'lucide-react'
import { tr, getLang, setLang as saveLang, isRTL, POS_LANGS, type Lang } from '../../src/lib/posI18n'
import { printReceipt, type ReceiptItem } from '../../src/lib/posReceipt'
import { useCashierShift } from '../../src/hooks/useCashierShift'
import CaisseDepartScreen from '../../src/components/pos/CaisseDepartScreen'
import ClotureModal from '../../src/components/pos/ClotureModal'
import ShiftTimingPill from '../../src/components/pos/ShiftTimingPill'
import LockedOverlay from '../../src/components/pos/LockedOverlay'

// ─── Types ────────────────────────────────────────────────────────────────────

type TableColor = 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'
type MobileTab  = 'tables' | 'menu' | 'cart'
type PayMethod  = 'CASH' | 'CARD' | 'ONLINE'

interface PosTable  { id: string; tableNumber: number; qrToken: string; isActive: boolean; capacity: number; status: TableColor }
interface Staff     { id: string; name: string; role: string }
interface OrderItem { id: string; productId: string; quantity: number; notes: string | null; unitPrice: number; commissionRate: number; product: { nameAr: string; nameEn: string; nameFr: string } }
interface TableOrder { id: string; totalPrice: number; totalCommission: number; payMethod: string; orderSource: string; billStatus: string; createdAt: string; items: OrderItem[] }
interface MenuItem   { id: string; nameEn: string; nameAr: string; nameFr: string; price: number; imageUrl: string | null; unitType?: string }
interface MenuCat    { id: string; nameEn: string; nameAr: string; nameFr: string; order: number; products: MenuItem[] }
interface CartItem   { productId: string; name: string; price: number; qty: number; unitType: string }

// Weight items: price is per KG, qty is grams — total = price/1000 * qty.
function lineTotal(item: { price: number; qty: number; unitType: string }) {
  return item.unitType === 'WEIGHT' ? (item.price / 1000) * item.qty : item.price * item.qty
}
interface TodaySummaryOrder { id: string; status: string; totalPrice: number; paymentMethod: string; createdAt: string; table: { tableNumber: number } | null }
interface ShiftLiveSummary  { openingFloat: number; totalCollectedCash: number; count: number; orders: TodaySummaryOrder[] }

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
// printReceipt + ReceiptItem now live in src/lib/posReceipt.ts (shared with /comptoir)

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
// TABLE_LABEL is now computed inside the component so it reacts to lang changes

// ─── Component ────────────────────────────────────────────────────────────────

export default function POSPage() {
  const [lang, setLangState] = useState<Lang>('ar')
  useEffect(() => { setLangState(getLang()) }, [])
  const L = (key: Parameters<typeof tr>[0]) => tr(key, lang)

  const TABLE_LABEL: Record<TableColor, string> = {
    INACTIVE: '—', EMPTY: '', OPEN_QR: L('table_qr'), OPEN_MANUAL: L('table_manual'), BILL_REQUESTED: L('table_bill'),
  }

  function pName(item: { nameAr: string; nameEn: string; nameFr: string }) {
    return lang === 'ar' ? (item.nameAr || item.nameEn)
         : lang === 'fr' ? (item.nameFr || item.nameEn)
         : item.nameEn || item.nameAr
  }

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
  const cashierShift = useCashierShift(posToken, subdomain)
  const [showCloture, setShowCloture] = useState(false)
  const [loginErr,    setLoginErr]    = useState('')
  const [logging,     setLogging]     = useState(false)
  const [loadingCafe, setLoadingCafe] = useState(false)
  // demo mode
  const [isDemoMode,  setIsDemoMode]  = useState(false)
  const [demoStaff,   setDemoStaff]   = useState<{ id: string; name: string; role: string }[]>([])
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
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([])
  const [loadOrder,   setLoadOrder]   = useState(false)
  // cart (for manual POS orders on empty tables)
  const [cart,        setCart]        = useState<CartItem[]>([])
  // checkout
  const [payMethod,   setPayMethod]   = useState<PayMethod>('CASH')
  const [payLabel,    setPayLabel]    = useState('Espèces')
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payPending,  setPayPending]  = useState<{ method: PayMethod; label: string; icon: string } | null>(null)
  const [cashInput,   setCashInput]   = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutErr, setCheckoutErr] = useState('')
  const [doneTable,   setDoneTable]   = useState<number | null>(null)
  // split bill
  const [splitOpen,   setSplitOpen]   = useState(false)
  const [splitSeats,  setSplitSeats]  = useState<number[]>([])
  // ui
  const [mobileTab,   setMobileTab]   = useState<MobileTab>('tables')
  const [clock,       setClock]       = useState('')
  const [priceBanner, setPriceBanner] = useState(false)
  // today history + live cash summary
  const [posView,      setPosView]      = useState<'live' | 'today'>('live')
  const [liveSummary,  setLiveSummary]  = useState<ShiftLiveSummary | null>(null)

  // marketplace order logging (Glovo, Uber Eats...)
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [mpPlatform,      setMpPlatform]      = useState('Glovo')
  const [mpPlatformOther, setMpPlatformOther] = useState('')
  const [mpRef,           setMpRef]           = useState('')
  const [mpCart,          setMpCart]          = useState<CartItem[]>([])
  const [mpCat,           setMpCat]           = useState('')
  const [mpSubmitting,    setMpSubmitting]    = useState(false)
  const [mpError,         setMpError]         = useState('')
  // refs
  const mutedRef    = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const beepRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef   = useRef<Socket | null>(null)
  const lastPinRef  = useRef('')

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

  // Auto-detect subdomain + fetch cafe branding + detect demo mode
  // Priority: ?sub= link from the admin dashboard (always correct, no DNS
  // wildcard required) → real subdomain host → last-known cached value.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('sub') ?? ''
    const parts = window.location.hostname.split('.')
    const det   = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : ''
    const saved = localStorage.getItem('posLastSubdomain') ?? ''
    const sub   = fromQuery || det || saved
    if (sub) { setSubdomain(sub); localStorage.setItem('posLastSubdomain', sub) }
    if (!sub) return
    setLoadingCafe(true)
    fetch(`/api/public/cafe/${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setCafeName(d.name); setCafeLogoUrl(d.logoUrl ?? null) }
    }).finally(() => setLoadingCafe(false))
    // Check demo mode
    fetch(`/api/public/demo-staff?subdomain=${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.staff?.length) { setIsDemoMode(true); setDemoStaff(d.staff) }
    }).catch(() => {})
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
      lastPinRef.current = pin.trim()
      setPin('')
      if (data.staff?.role === 'WAITER') { window.location.href = '/waiter'; return }
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  // Demo login — no PIN required
  async function handleDemoLogin(staffId: string) {
    setLoginErr(''); setLogging(true)
    try {
      const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), demoStaffId: staffId, action: 'login' }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      localStorage.setItem('posToken', data.token)
      localStorage.setItem('cafeId', payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomain.trim())
      localStorage.setItem('staffName', data.staff?.name ?? '')
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

  const fetchLiveSummary = useCallback(async (tok: string) => {
    try {
      const res = await fetch('/api/pos/shift/live-summary', { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) setLiveSummary(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    if (!posToken || !cashierShift.shift) return
    fetchLiveSummary(posToken)
    const id = setInterval(() => fetchLiveSummary(posToken), 20_000)
    return () => clearInterval(id)
  }, [posToken, cashierShift.shift, fetchLiveSummary])

  // Socket
  useEffect(() => {
    if (!posToken || !cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      auth: { token: posToken },
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1500, reconnectionDelayMax: 8000,
    })
    socketRef.current = socket
    socket.on('connect',   () => socket.emit('join', `room_${cafeId}`))
    socket.on('reconnect', () => socket.emit('join', `room_${cafeId}`))
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
    socket.on('order_status_updated', (p: { status: string; tableId?: string }) => {
      if ((p.status === 'COMPLETED' || p.status === 'CANCELLED') && p.tableId) {
        setTables(prev => prev.map(t => t.id === p.tableId ? { ...t, status: 'EMPTY' as TableColor } : t))
        setAlertIds(prev => { const n = new Set(prev); n.delete(p.tableId!); return n })
      }
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
    setSelTable(table); setTableOrders([]); setCheckoutErr(''); setCart([])
    setPayMethod('CASH'); setCashInput(''); setDoneTable(null)
    setMobileTab('menu')
    if (table.status === 'EMPTY') return
    setLoadOrder(true)
    try {
      const res = await fetch(`/api/pos/orders/table/${table.id}`, { headers: { Authorization: `Bearer ${posToken}` } })
      if (res.ok) { const data = await res.json(); setTableOrders(data.orders ?? []) }
    } finally { setLoadOrder(false) }
  }

  // Cart helpers
  function addToCart(item: MenuItem) {
    const isWeight = item.unitType === 'WEIGHT'
    setCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + (isWeight ? 50 : 1) } : c)
      return [...prev, { productId: item.id, name: pName(item), price: item.price, qty: isWeight ? 250 : 1, unitType: item.unitType ?? 'PIECE' }]
    })
    if (mobileTab === 'menu') setMobileTab('cart')
  }
  function updateQty(productId: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.productId !== productId) return c
      const isWeight = c.unitType === 'WEIGHT'
      const step = isWeight ? 50 * delta : delta
      return { ...c, qty: Math.max(isWeight ? 50 : 1, c.qty + step) }
    }))
  }
  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(c => c.productId !== productId))
  }

  // Marketplace order cart — separate from the table cart above (no table involved)
  function addToMpCart(item: MenuItem) {
    const isWeight = item.unitType === 'WEIGHT'
    setMpCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + (isWeight ? 50 : 1) } : c)
      return [...prev, { productId: item.id, name: pName(item), price: item.price, qty: isWeight ? 250 : 1, unitType: item.unitType ?? 'PIECE' }]
    })
  }
  function updateMpQty(productId: string, delta: number) {
    setMpCart(prev => prev.map(c => {
      if (c.productId !== productId) return c
      const isWeight = c.unitType === 'WEIGHT'
      const step = isWeight ? 50 * delta : delta
      return { ...c, qty: Math.max(isWeight ? 50 : 1, c.qty + step) }
    }))
  }
  function removeFromMpCart(productId: string) {
    setMpCart(prev => prev.filter(c => c.productId !== productId))
  }
  const mpCartTotal = mpCart.reduce((s, c) => s + lineTotal(c), 0)

  async function submitMarketplaceOrder() {
    if (!posToken || mpCart.length === 0) return
    const platform = mpPlatform === 'Other' ? mpPlatformOther.trim() : mpPlatform
    if (!platform) { setMpError('Choose a platform'); return }
    setMpSubmitting(true); setMpError('')
    try {
      const res = await fetch('/api/pos/orders/marketplace', {
        method: 'POST', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: mpCart.map(c => ({ productId: c.productId, quantity: c.qty })),
          platform,
          externalOrderRef: mpRef.trim() || undefined,
        })
      })
      if (!res.ok) { const d = await res.json(); setMpError(d.error ?? 'Failed'); return }
      setMpCart([]); setMpRef(''); setShowMarketplace(false)
    } catch { setMpError('Network error') }
    finally { setMpSubmitting(false) }
  }

  // Checkout
  async function handleCheckout(doPrint: boolean) {
    if (!selTable || !posToken) return
    setCheckingOut(true); setCheckoutErr('')
    try {
      // If cart has new items, submit them first (smart-merge or create)
      if (cart.length > 0) {
        const createRes = await fetch('/api/pos/orders', {
          method: 'POST', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: selTable.id, items: cart.map(c => ({ productId: c.productId, quantity: c.qty })), paymentMethod: payMethod })
        })
        if (!createRes.ok) { const d = await createRes.json(); setCheckoutErr(d.error ?? 'Failed'); return }
      }

      // Close ALL open orders for this table in one call
      const res = await fetch(`/api/pos/tables/${selTable.id}/checkout`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: payMethod, printReceipt: doPrint })
      })
      if (!res.ok) { const d = await res.json(); setCheckoutErr(d.error ?? 'Checkout failed'); return }

      const d = await res.json()
      if (doPrint) {
        // checkout endpoint returns items already as { name, quantity, unitPrice }
        printReceipt(cafeName, selTable.tableNumber, d.items as ReceiptItem[], d.totalPrice, currency)
      }

      setDoneTable(selTable.tableNumber)
      setTables(prev => prev.map(t => t.id === selTable.id ? { ...t, status: 'EMPTY' } : t))
      setAlertIds(prev => { const n = new Set(prev); n.delete(selTable.id); return n })
      setCart([]); setTableOrders([])
      setTimeout(() => { setSelTable(null); setDoneTable(null); setMobileTab('tables') }, 2000)
    } finally { setCheckingOut(false) }
  }

  // Split checkout — close only the selected seats
  async function handleSplitCheckout() {
    if (!selTable || !posToken || splitSeats.length === 0) return
    setCheckingOut(true); setCheckoutErr('')
    try {
      const res = await fetch('/api/pos/checkout/by-seats', {
        method:  'POST',
        headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tableId: selTable.id, seatNumbers: splitSeats, paymentMethod: payMethod }),
      })
      if (!res.ok) {
        const d = await res.json()
        setCheckoutErr(d.error ?? 'Split checkout failed')
        return
      }
      const d = await res.json()
      setSplitOpen(false); setSplitSeats([])
      if (d.closed > 0) {
        setDoneTable(selTable.tableNumber)
        setTables(prev => prev.map(t => t.id === selTable!.id ? { ...t, status: 'EMPTY' } : t))
        setAlertIds(prev => { const n = new Set(prev); n.delete(selTable!.id); return n })
        setCart([]); setTableOrders([])
        setTimeout(() => { setSelTable(null); setDoneTable(null); setMobileTab('tables') }, 2000)
      }
    } finally { setCheckingOut(false) }
  }

  // Merge all DB order items by productId for unified display
  const mergedItems = (() => {
    const map = new Map<string, ReceiptItem & { productId: string }>()
    for (const order of tableOrders) {
      for (const item of order.items) {
        const existing = map.get(item.productId)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          map.set(item.productId, { productId: item.productId, name: pName(item.product), quantity: item.quantity, unitPrice: item.unitPrice })
        }
      }
    }
    return Array.from(map.values())
  })()

  const STATUS_PRIORITY: Record<TableColor, number> = {
    BILL_REQUESTED: 0,
    OPEN_QR:        1,
    OPEN_MANUAL:    2,
    EMPTY:          3,
    INACTIVE:       4,
  }
  const sortedTables = [...tables].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status], pb = STATUS_PRIORITY[b.status]
    return pa !== pb ? pa - pb : a.tableNumber - b.tableNumber
  })

  const cartTotal        = cart.reduce((s, c) => s + lineTotal(c), 0)
  const tableOrdersTotal = tableOrders.reduce((s, o) => s + o.totalPrice, 0)
  const orderTotal       = tableOrdersTotal + cartTotal
  const cashVal          = parseFloat(cashInput) || 0
  const change           = payMethod === 'CASH' && cashVal > 0 ? cashVal - orderTotal : null
  const cartCount        = cart.reduce((s, c) => s + c.qty, 0)
  const alertCount       = alertIds.size
  const activeItems      = menuCats.find(c => c.id === activeCat)?.products ?? []
  const hasOrder         = tableOrders.length > 0 || cart.length > 0

  // ─── Caisse de départ — required before entering the POS once logged in ─────
  if (posToken && !cashierShift.loading && !cashierShift.shift) {
    return (
      <CaisseDepartScreen
        staffName={staff?.name ?? ''}
        onSubmit={async ({ initialCash, plannedEndTime }) => {
          const isDemo = isDemoMode
          const result = await cashierShift.openShift({
            pinCode: isDemo ? undefined : lastPinRef.current,
            demoStaffId: isDemo ? staff?.id : undefined,
            initialCash,
            plannedEndTime,
          })
          localStorage.setItem('posToken', result.token)
          setPosToken(result.token)
        }}
      />
    )
  }

  // ─── Poste verrouillé ────────────────────────────────────────────────────────
  if (cashierShift.isLocked) {
    return <LockedOverlay staffName={staff?.name ?? ''} plannedEndTime={cashierShift.shift?.plannedEndTime ?? null} />
  }

  // ─── PIN Login ──────────────────────────────────────────────────────────────
  if (!posToken) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
        {/* Lang selector */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {POS_LANGS.map(l => (
            <button key={l.code} onClick={() => { saveLang(l.code); setLangState(l.code) }}
              className={`w-8 h-8 rounded-lg text-sm transition-all ${lang === l.code ? 'bg-emerald-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {l.flag}
            </button>
          ))}
        </div>
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

          {/* Demo mode — tap to login, no PIN */}
          {isDemoMode ? (
            <div className="space-y-3">
              <p className="text-center text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-1">
                🧪 Demo — اختر موظفاً للدخول
              </p>
              {demoStaff.map(s => (
                <button key={s.id} onClick={() => handleDemoLogin(s.id)} disabled={logging}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500 rounded-2xl transition-all active:scale-95 disabled:opacity-50">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                    {s.role === 'CASHIER' ? '💳' : s.role === 'SUPERVISOR' ? '👔' : '🛎️'}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">{s.name}</p>
                    <p className="text-gray-500 text-xs">{s.role}</p>
                  </div>
                  {logging ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400 ml-auto" /> : (
                    <ChevronLeft className="w-4 h-4 text-gray-600 ml-auto rotate-180" />
                  )}
                </button>
              ))}
              {loginErr && (
                <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {loginErr}
                </div>
              )}
            </div>
          ) : (
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
          )}
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
          <button onClick={() => { setShowMarketplace(true); if (menuCats.length && !mpCat) setMpCat(menuCats[0].id) }}
            title="Log a delivery-app order (Glovo, Uber Eats...)"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-950 transition-colors">
            <Bike className="w-4 h-4" />
          </button>
          <button onClick={() => setMuted(m => !m)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${muted ? 'text-gray-600 hover:text-gray-400' : 'text-emerald-500 hover:bg-emerald-950'}`}>
            {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          <button onClick={() => fetchTables(posToken!)} disabled={loadTables}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loadTables ? 'animate-spin' : ''}`} />
          </button>
          {liveSummary && (
            <div className="hidden md:flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1 mr-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Caisse</span>
              <span className="text-xs text-gray-400">{liveSummary.openingFloat.toFixed(2)}</span>
              <span className="text-gray-700">+</span>
              <span className="text-xs text-emerald-400 font-bold">{liveSummary.totalCollectedCash.toFixed(2)}</span>
              <span className="text-[10px] text-gray-600">{currency}</span>
            </div>
          )}
          <ShiftTimingPill timing={cashierShift.timing} />
          <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-lg p-0.5 mr-1">
            <button onClick={() => setPosView('live')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${posView === 'live' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Live
            </button>
            <button onClick={() => { setPosView('today'); if (posToken) fetchLiveSummary(posToken) }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${posView === 'today' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {L('nav_today')} {liveSummary && liveSummary.count > 0 && <span className="ml-1 opacity-80">({liveSummary.count})</span>}
            </button>
          </div>
          {cashierShift.shift && (
            <button onClick={() => setShowCloture(true)}
              className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors">
              Clôture
            </button>
          )}
          {/* Lang selector */}
          <div className="hidden sm:flex gap-1">
            {POS_LANGS.map(l => (
              <button key={l.code} onClick={() => { saveLang(l.code); setLangState(l.code) }}
                className={`w-10 h-10 rounded-lg text-sm transition-all ${lang === l.code ? 'bg-emerald-700' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {l.flag}
              </button>
            ))}
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-400 text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{L('nav_logout')}</span>
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
      {posView === 'today' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {(!liveSummary || liveSummary.orders.length === 0) && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-3xl mb-3">🧾</p>
                <p className="text-sm">{L('today_empty')}</p>
              </div>
            )}
            {liveSummary?.orders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-bold">{o.table ? `Table ${o.table.tableNumber}` : '—'} <span className="text-gray-600 font-normal">· {o.paymentMethod}</span></p>
                  <p className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="text-emerald-400 font-extrabold text-sm">{o.totalPrice.toFixed(2)} {currency}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL: Tables + Menu Browser */}
        <div className={`flex flex-col border-r border-gray-800 overflow-hidden
          ${selTable ? 'hidden md:flex md:w-[55%]' : 'flex w-full md:w-[55%]'}`}>

          {/* Table strip — horizontal scroll, one row */}
          <div className="shrink-0 border-b border-gray-800 px-3 pt-2 pb-2.5">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{L('nav_tables')}</span>
              <span className="flex-1" />
              <span className="flex items-center gap-1 text-[10px] text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"/>QR</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>POS</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/>Bill</span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none" style={{touchAction:'pan-x'}}>
              {sortedTables.map(t => {
                const isAlert    = alertIds.has(t.id)
                const isSelected = selTable?.id === t.id
                const dotColor =
                  t.status === 'OPEN_QR'        ? 'bg-sky-400' :
                  t.status === 'OPEN_MANUAL'    ? 'bg-amber-400' :
                  t.status === 'BILL_REQUESTED' ? 'bg-red-400 animate-ping' : 'bg-transparent'
                return (
                  <button
                    key={t.id}
                    disabled={t.status === 'INACTIVE'}
                    onClick={() => openTable(t)}
                    className={`relative shrink-0 w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90
                      ${TABLE_STYLE[t.status]}
                      ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-gray-950' : ''}
                      ${isAlert ? 'animate-pulse' : ''}`}
                  >
                    <span className={`text-lg font-extrabold leading-none ${
                      t.status === 'INACTIVE' ? 'text-gray-700' :
                      t.status === 'EMPTY'    ? 'text-gray-500' : 'text-white'
                    }`}>{t.tableNumber}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {isAlert && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-gray-950" />}
                  </button>
                )
              })}
              {tables.length === 0 && !loadTables && (
                <span className="text-gray-600 text-xs py-4">{L('loading')}</span>
              )}
            </div>
          </div>

          {/* Menu Browser */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="shrink-0 border-b border-gray-800 flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none" style={{touchAction:'pan-x'}}>
              {menuCats.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeCat === cat.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}>
                  {pName(cat)}
                </button>
              ))}
              {menuCats.length === 0 && (
                <span className="text-gray-600 text-xs py-2">{L('loading')}</span>
              )}
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-3" style={{touchAction:'pan-y'}}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeItems.map(item => (
                  <button key={item.id} onClick={() => { if (selTable) addToCart(item) }}
                    disabled={!selTable}
                    className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden text-left transition-all active:scale-95
                      ${selTable ? 'hover:border-emerald-700 hover:bg-gray-800 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.nameEn} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-gray-800 flex items-center justify-center">
                        <UtensilsCrossed className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-white font-bold text-xs leading-tight truncate">{pName(item)}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-emerald-400 font-extrabold text-sm">{item.price.toFixed(2)} <span className="text-[10px] font-normal text-gray-500">{currency}{item.unitType === 'WEIGHT' ? '/kg' : ''}</span></p>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors
                          ${selTable ? 'bg-emerald-900/60 text-emerald-400' : 'bg-gray-800 text-gray-600'}`}>
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
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
                {(cart.length > 0 || tableOrders.length > 0) && (
                  <span className="text-emerald-400 font-extrabold text-sm">{orderTotal.toFixed(2)} {currency}</span>
                )}
              </div>

              {/* Order items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{touchAction:'pan-y'}}>
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
                    {/* All DB order items merged by product */}
                    {mergedItems.map(item => (
                      <div key={item.productId} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                          <span className="text-white font-extrabold text-sm">{item.quantity}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                        </div>
                        <span className="text-gray-300 tabular-nums text-sm font-medium shrink-0">
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* Cart items (manual) */}
                    {cart.map(item => (
                      <div key={item.productId} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item.productId, -1)}
                            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white active:scale-95 transition-all">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center text-white font-extrabold text-sm">
                            {item.unitType === 'WEIGHT' ? `${item.qty}g` : item.qty}
                          </span>
                          <button onClick={() => updateQty(item.productId, 1)}
                            className="w-10 h-10 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 flex items-center justify-center text-emerald-400 hover:text-white active:scale-95 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-gray-500 text-xs">
                            {item.unitType === 'WEIGHT' ? `${item.price.toFixed(2)}/kg` : item.price.toFixed(2)} × {item.unitType === 'WEIGHT' ? `${item.qty}g` : item.qty}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-300 tabular-nums text-sm">{lineTotal(item).toFixed(2)}</span>
                          <button onClick={() => removeFromCart(item.productId)}
                            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-red-900/50 flex items-center justify-center text-gray-600 hover:text-red-400 active:scale-95 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Empty state */}
                    {tableOrders.length === 0 && cart.length === 0 && !loadOrder && (
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

                  {/* Payment method — trigger */}
                  <button
                    onClick={() => { setPayPending(null); setPayModalOpen(true) }}
                    className="w-full py-3 bg-gray-900 border-2 border-gray-700 hover:border-emerald-600 rounded-xl flex items-center justify-between px-4 transition-all active:scale-95"
                  >
                    <span className="text-gray-400 text-xs font-semibold">Paiement</span>
                    <span className="text-white font-extrabold text-sm flex items-center gap-2">
                      {payLabel}
                      <span className="text-gray-500 text-xs">▾</span>
                    </span>
                  </button>

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

                  {/* Split bill button — shown when table has active sessions (capacity > 1) */}
                  {selTable && selTable.capacity > 1 && (
                    <button
                      onClick={() => { setSplitSeats([]); setSplitOpen(true) }}
                      disabled={checkingOut}
                      className="w-full py-3 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 text-blue-300 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      🪑 Split Bill by Seat
                    </button>
                  )}

                  {/* Checkout buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleCheckout(true)} disabled={checkingOut}
                      className="py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex flex-col items-center gap-1">
                      {checkingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                      {checkingOut ? 'Processing…' : 'Print & Pay'}
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
          <p className="hidden md:block text-[10px] text-center text-gray-700 opacity-40 select-none py-1 bg-gray-950 shrink-0">
            © 2026 Smart Restau
          </p>
        </div>
      </div>
      )}

      <p className="md:hidden text-[10px] text-center text-gray-700 opacity-40 select-none py-0.5 bg-gray-900">
        © 2026 Smart Restau
      </p>
      {/* ── Mobile bottom tabs ──────────────────────────────────────────────── */}
      <div className="md:hidden shrink-0 border-t border-gray-800 bg-gray-900 flex items-stretch h-16">
        {([
          { key: 'tables', icon: LayoutGrid,  label: 'Tables',  badge: alertCount },
          { key: 'menu',   icon: UtensilsCrossed, label: 'Menu', badge: 0 },
          { key: 'cart',   icon: ShoppingCart, label: 'Order',  badge: cartCount + (tableOrders.length > 0 ? 1 : 0) },
        ] as const).map(({ key, icon: Icon, label, badge }) => (
          <button key={key} onClick={() => {
            setPosView('live')
            setMobileTab(key)
            if (key === 'tables') setSelTable(null)
          }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${
              mobileTab === key && posView === 'live' ? 'text-emerald-400' : 'text-gray-600'
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

      {/* ── Payment Method Modal ─────────────────────────────────────────────── */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => { setPayModalOpen(false); setPayPending(null) }}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {!payPending ? (
              <>
                <h3 className="font-black text-lg text-white mb-1">Mode de paiement</h3>
                <p className="text-gray-500 text-sm mb-5">Choisissez le mode utilisé par le client</p>
                <div className="space-y-2">
                  {([
                    { method: 'CASH'   as PayMethod, label: 'Espèces',      icon: '💵', sub: 'Cash / نقدي' },
                    { method: 'CARD'   as PayMethod, label: 'TPE / Visa',   icon: '💳', sub: 'Carte bancaire' },
                    { method: 'ONLINE' as PayMethod, label: 'Apple Pay',    icon: '🍎', sub: 'NFC · iPhone' },
                    { method: 'ONLINE' as PayMethod, label: 'Google Pay',   icon: '🤖', sub: 'NFC · Android' },
                    { method: 'ONLINE' as PayMethod, label: 'Orange Money', icon: '🟠', sub: 'Paiement mobile' },
                  ]).map((opt, i) => (
                    <button key={i} onClick={() => setPayPending(opt)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-2xl transition-all active:scale-95 text-left">
                      <span className="text-2xl">{opt.icon}</span>
                      <div>
                        <p className="text-white font-bold text-sm">{opt.label}</p>
                        <p className="text-gray-500 text-xs">{opt.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => { setPayModalOpen(false); setPayPending(null) }}
                  className="w-full mt-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  Annuler
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <span className="text-5xl">{payPending.icon}</span>
                  <h3 className="font-black text-xl text-white mt-3">{payPending.label}</h3>
                  <p className="text-gray-400 text-sm mt-1">Confirmez-vous ce mode de paiement ?</p>
                </div>
                <div className="bg-amber-950/40 border border-amber-800/50 rounded-2xl px-4 py-3 mb-5 text-center">
                  <p className="text-amber-300 text-xs font-semibold">
                    {payPending.method === 'CASH'
                      ? '✔ Assurez-vous d\'avoir reçu les espèces avant de confirmer'
                      : payPending.method === 'CARD'
                      ? '✔ Assurez-vous que le TPE a validé le paiement avant de confirmer'
                      : '✔ Assurez-vous que le paiement mobile est confirmé avant de continuer'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPayPending(null)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-sm active:scale-95 transition-all">
                    ← Retour
                  </button>
                  <button onClick={() => {
                    setPayMethod(payPending.method)
                    setPayLabel(payPending.label)
                    setPayModalOpen(false)
                    setPayPending(null)
                  }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Confirmer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Clôture Modal ──────────────────────────────────────────────────────── */}
      {showCloture && cashierShift.shift && (
        <ClotureModal
          shift={cashierShift.shift}
          currency={currency}
          onClose={() => setShowCloture(false)}
          onConfirm={async (countedCash) => {
            const isDemo = isDemoMode
            return await cashierShift.closeShift({
              pinCode: isDemo ? undefined : lastPinRef.current,
              demoStaffId: isDemo ? staff?.id : undefined,
              countedCash,
            })
          }}
        />
      )}

      {/* ── Marketplace Order Modal (Glovo, Uber Eats...) ───────────────────────── */}
      {showMarketplace && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowMarketplace(false)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              <h3 className="font-black text-lg text-white flex items-center gap-2"><Bike className="w-5 h-5 text-amber-500" /> Delivery App Order</h3>
              <button onClick={() => setShowMarketplace(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3 border-b border-gray-800 shrink-0">
              <div className="flex flex-wrap gap-2">
                {['Glovo', 'Uber Eats', 'Jumia Food', 'Other'].map(p => (
                  <button key={p} onClick={() => setMpPlatform(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${mpPlatform === p ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {mpPlatform === 'Other' && (
                  <input type="text" value={mpPlatformOther} onChange={e => setMpPlatformOther(e.target.value)}
                    placeholder="Platform name" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                )}
                <input type="text" value={mpRef} onChange={e => setMpRef(e.target.value)}
                  placeholder="Order # (optional)" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <div className="w-1/2 border-r border-gray-800 overflow-y-auto p-3">
                <div className="flex gap-1.5 overflow-x-auto mb-2 pb-1">
                  {menuCats.map(cat => (
                    <button key={cat.id} onClick={() => setMpCat(cat.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${mpCat === cat.id ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {pName(cat)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(menuCats.find(c => c.id === mpCat)?.products ?? []).map(item => (
                    <button key={item.id} onClick={() => addToMpCart(item)}
                      className="bg-gray-800 hover:bg-gray-700 rounded-xl p-2 text-left transition-colors">
                      <p className="text-white text-xs font-bold truncate">{pName(item)}</p>
                      <p className="text-amber-400 text-xs font-bold">{item.price.toFixed(2)} {currency}{item.unitType === 'WEIGHT' ? '/kg' : ''}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-1/2 overflow-y-auto p-3 space-y-2">
                {mpCart.map(item => (
                  <div key={item.productId} className="flex items-center gap-2 bg-gray-800 rounded-xl px-2.5 py-1.5">
                    <button onClick={() => updateMpQty(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-700 text-gray-300 font-bold shrink-0">−</button>
                    <span className="w-10 text-center text-white text-xs font-bold shrink-0">{item.unitType === 'WEIGHT' ? `${item.qty}g` : item.qty}</span>
                    <button onClick={() => updateMpQty(item.productId, 1)} className="w-7 h-7 rounded-lg bg-amber-900/70 text-amber-400 font-bold shrink-0">+</button>
                    <span className="flex-1 text-white text-xs font-semibold truncate">{item.name}</span>
                    <button onClick={() => removeFromMpCart(item.productId)} className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {mpCart.length === 0 && <p className="text-gray-600 text-xs text-center py-8">Tap products to add them</p>}
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 shrink-0 space-y-2">
              {mpError && <p className="text-red-400 text-xs font-semibold">{mpError}</p>}
              <button onClick={submitMarketplaceOrder} disabled={mpSubmitting || mpCart.length === 0}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2">
                {mpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Log Order — ${mpCartTotal.toFixed(2)} ${currency}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Split Bill Modal ──────────────────────────────────────────────────── */}
      {splitOpen && selTable && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSplitOpen(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg text-white mb-1">
              Split Bill — Table {selTable.tableNumber}
            </h3>
            <p className="text-gray-400 text-sm mb-5">Select seats to close</p>

            <div className="grid grid-cols-4 gap-3 mb-6">
              {Array.from({ length: selTable.capacity || 6 }, (_, i) => i + 1).map(seat => (
                <button
                  key={seat}
                  onClick={() => setSplitSeats(prev =>
                    prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]
                  )}
                  className={`h-14 rounded-2xl flex items-center justify-center text-sm font-black transition-all active:scale-90
                    ${splitSeats.includes(seat)
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                  {seat}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSplitOpen(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-sm active:scale-95 transition-all">
                Cancel
              </button>
              <button
                onClick={handleSplitCheckout}
                disabled={checkingOut || splitSeats.length === 0}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {checkingOut
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Check className="w-4 h-4" />}
                Close {splitSeats.length > 0 ? `${splitSeats.length} seat${splitSeats.length > 1 ? 's' : ''}` : '…'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
