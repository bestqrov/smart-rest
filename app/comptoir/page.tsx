'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LogOut, Bike } from 'lucide-react'
import { useCashierShift } from '../../src/hooks/useCashierShift'
import { useMarketplaceCart } from '../../src/hooks/useMarketplaceCart'
import CaisseDepartScreen from '../../src/components/pos/CaisseDepartScreen'
import ClotureModal from '../../src/components/pos/ClotureModal'
import ShiftTimingPill from '../../src/components/pos/ShiftTimingPill'
import LockedOverlay from '../../src/components/pos/LockedOverlay'
import MarketplaceOrderModal from '../../src/components/pos/MarketplaceOrderModal'
import PosPinLogin from '../../src/components/pos/PosPinLogin'
import { printReceipt } from '../../src/lib/posReceipt'
import { lineTotal, type MenuItem, type MenuCat, type CartItem } from '../../src/lib/posCart'

interface Staff { id: string; name: string; role: string }
interface TodaySummaryOrder { id: string; status: string; totalPrice: number; paymentMethod: string; createdAt: string; table: { tableNumber: number } | null }
interface ShiftLiveSummary  { openingFloat: number; totalCollectedCash: number; count: number; orders: TodaySummaryOrder[] }

function pName(item: { nameEn: string; nameAr: string; nameFr: string }) {
  return item.nameFr || item.nameEn || item.nameAr
}

export default function ComptoirPage() {
  // auth (mirrors app/pos/page.tsx's login flow)
  const [posToken,    setPosToken]    = useState<string | null>(null)
  const [staff,       setStaff]       = useState<Staff | null>(null)
  const [cafeId,      setCafeId]      = useState('')
  const [cafeName,    setCafeName]    = useState('Café')
  const [currency,    setCurrency]    = useState('MAD')
  const [pin,         setPin]         = useState('')
  const [subdomain,   setSubdomain]   = useState('')
  const [loginErr,    setLoginErr]    = useState('')
  const [logging,     setLogging]     = useState(false)
  const [isDemoMode,  setIsDemoMode]  = useState(false)
  const [demoStaff,   setDemoStaff]   = useState<{ id: string; name: string; role: string }[]>([])
  const lastPinRef = useRef('')

  const cashierShift = useCashierShift(posToken, subdomain)
  const [showCloture, setShowCloture] = useState(false)
  const [posView,     setPosView]     = useState<'live' | 'today'>('live')
  const [liveSummary, setLiveSummary] = useState<ShiftLiveSummary | null>(null)

  const [menuCats,  setMenuCats]  = useState<MenuCat[]>([])
  const [activeCat, setActiveCat] = useState('')
  const [cart,      setCart]      = useState<CartItem[]>([])

  interface PosCustomer { id: string; phone: string; name: string | null; customerType?: string; wholesaleDiscountPct?: number }
  const [client,       setClient]       = useState<PosCustomer | null>(null)
  const [clientPicker, setClientPicker] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<PosCustomer[]>([])
  const [clientNewName, setClientNewName] = useState('')
  const [clientBusy, setClientBusy] = useState(false)
  const [newIsWholesale, setNewIsWholesale] = useState(false)
  const [newWholesalePct, setNewWholesalePct] = useState('10')

  // marketplace order logging (Glovo, Uber Eats...) — shared hook, see src/hooks/useMarketplaceCart.ts
  const mp = useMarketplaceCart(posToken, pName, {
    choosePlatform: 'Choisis une plateforme', requestFailed: 'Échec', networkError: 'Erreur réseau',
  })

  const [orderType,   setOrderType]   = useState<'TAKEAWAY' | 'DINE_IN'>('TAKEAWAY')
  const [payMethod,   setPayMethod]   = useState<'CASH' | 'CARD'>('CASH')
  const [confirming,  setConfirming]  = useState(false)
  const [confirmErr,  setConfirmErr]  = useState('')
  const [lastSale,    setLastSale]    = useState<number | null>(null)

  // Boot — restore session
  useEffect(() => {
    const t = localStorage.getItem('posToken')
    if (!t) return
    try {
      const p = JSON.parse(atob(t.split('.')[1]))
      setPosToken(t); setCafeId(p.cafeId)
      setStaff({ id: p.staffId, name: localStorage.getItem('staffName') ?? '', role: p.staffRole })
    } catch { localStorage.removeItem('posToken') }
  }, [])

  // Auto-detect subdomain + branding + demo mode (same as /pos)
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
    fetch(`/api/public/cafe/${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCafeName(d.name)
    })
    fetch(`/api/public/demo-staff?subdomain=${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.staff?.length) { setIsDemoMode(true); setDemoStaff(d.staff) }
    }).catch(() => {})
  }, [])

  const fetchMenu = useCallback(async (token: string) => {
    const res = await fetch('/api/pos/menu', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setMenuCats(data.categories ?? [])
    setCurrency(data.currency ?? 'MAD')
    if (data.categories?.length) setActiveCat(data.categories[0].id)
  }, [])

  useEffect(() => {
    if (!posToken || !cashierShift.shift) return
    fetchMenu(posToken)
  }, [posToken, cashierShift.shift, fetchMenu])

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

  function addToCart(item: MenuItem) {
    const isWeight = item.unitType === 'WEIGHT'
    setCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + (isWeight ? 50 : 1) } : c)
      return [...prev, { productId: item.id, name: pName(item), price: item.price, qty: isWeight ? 250 : 1, unitType: item.unitType ?? 'PIECE' }]
    })
  }
  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(c => {
        if (c.productId !== productId) return c
        const isWeight = c.unitType === 'WEIGHT'
        return { ...c, qty: c.qty + (isWeight ? 50 * delta : delta) }
      })
      .filter(c => c.qty > 0))
  }
  const cartSubtotal = cart.reduce((s, c) => s + lineTotal(c), 0)
  const wholesaleDiscount = client?.customerType === 'WHOLESALE' ? cartSubtotal * (client.wholesaleDiscountPct ?? 0) / 100 : 0
  const cartTotal = Math.max(0, cartSubtotal - wholesaleDiscount)
  const activeItems = menuCats.find(c => c.id === activeCat)?.products ?? []

  async function searchClients(q: string) {
    setClientSearch(q)
    if (!posToken || q.trim().length < 2) { setClientResults([]); return }
    const res = await fetch(`/api/pos/customers?search=${encodeURIComponent(q.trim())}`, {
      headers: { Authorization: `Bearer ${posToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setClientResults(data.items ?? [])
    }
  }

  async function createClient() {
    if (!posToken || clientSearch.trim().length < 7) return
    setClientBusy(true)
    try {
      const res = await fetch('/api/pos/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({
          phone: clientSearch.trim(), name: clientNewName.trim() || undefined,
          customerType: newIsWholesale ? 'WHOLESALE' : 'RETAIL',
          wholesaleDiscountPct: newIsWholesale ? Number(newWholesalePct) || 0 : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setClient(data.customer)
        setClientPicker(false)
        setClientSearch(''); setClientNewName(''); setClientResults([])
        setNewIsWholesale(false); setNewWholesalePct('10')
      }
    } finally {
      setClientBusy(false)
    }
  }

  async function handleConfirm() {
    if (!posToken || !client || cart.length === 0) return
    setConfirming(true); setConfirmErr('')
    try {
      const createRes = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({
          items: cart.map(c => ({ productId: c.productId, quantity: c.qty })),
          paymentMethod: payMethod,
          customerPhone: client.phone,
          orderType,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setConfirmErr(createData.error ?? 'Échec de la création'); return }

      const orderId = createData.order.id
      const checkoutRes = await fetch(`/api/pos/orders/${orderId}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({ paymentMethod: payMethod, printReceipt: true }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutRes.ok) { setConfirmErr(checkoutData.error ?? 'Échec du paiement'); return }

      printReceipt(
        cafeName,
        orderType === 'TAKEAWAY' ? 'Emporter' : 'Sur place',
        checkoutData.order.items.map((i: any) => ({ name: i.product?.nameFr || i.product?.nameEn || i.product?.nameAr, quantity: i.quantity, unitPrice: i.unitPrice })),
        checkoutData.order.totalPrice,
        currency
      )

      setLastSale(checkoutData.order.totalPrice)
      setCart([]); setClient(null)
      setTimeout(() => setLastSale(null), 2500)
    } finally {
      setConfirming(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(''); setLogging(true)
    try {
      const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), pinCode: pin.trim(), action: 'login' }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      lastPinRef.current = pin.trim()
      localStorage.setItem('posToken', data.token)
      localStorage.setItem('cafeId', payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomain.trim())
      localStorage.setItem('staffName', data.staff?.name ?? '')
      setPin('')
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

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
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  function logout() {
    localStorage.removeItem('posToken'); localStorage.removeItem('cafeId')
    setPosToken(null); setStaff(null); setCafeId('')
  }

  // ─── PIN Login ──────────────────────────────────────────────────────────────
  if (!posToken) {
    return (
      <PosPinLogin
        cafeName={cafeName}
        icon="🧾"
        subtitle="Comptoir — Staff Login"
        subdomain={subdomain} setSubdomain={setSubdomain}
        pin={pin} setPin={setPin}
        loginErr={loginErr} logging={logging}
        isDemoMode={isDemoMode} demoStaff={demoStaff} demoLabel="🧪 Demo"
        onDemoLogin={handleDemoLogin}
        onSubmit={handleLogin}
      />
    )
  }

  // ─── Caisse de départ ───────────────────────────────────────────────────────
  if (!cashierShift.loading && !cashierShift.shift) {
    return (
      <CaisseDepartScreen
        staffName={staff?.name ?? ''}
        onSubmit={async ({ initialCash, plannedEndTime }) => {
          const result = await cashierShift.openShift({
            pinCode: isDemoMode ? undefined : lastPinRef.current,
            demoStaffId: isDemoMode ? staff?.id : undefined,
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

  // ─── Main Comptoir UI ───────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-4 h-16 flex items-center justify-between shrink-0">
        <div>
          <p className="text-white font-extrabold text-sm leading-none">{cafeName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{staff?.name} · {staff?.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {liveSummary && (
            <div className="hidden md:flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Caisse</span>
              <span className="text-xs text-gray-400">{liveSummary.openingFloat.toFixed(2)}</span>
              <span className="text-gray-700">+</span>
              <span className="text-xs text-emerald-400 font-bold">{liveSummary.totalCollectedCash.toFixed(2)}</span>
              <span className="text-[10px] text-gray-600">{currency}</span>
            </div>
          )}
          <button onClick={() => { mp.setShowMarketplace(true); if (menuCats.length && !mp.mpCat) mp.setMpCat(menuCats[0].id) }}
            title="Enregistrer une commande d'une app de livraison (Glovo, Uber Eats...)"
            className="p-2 rounded-xl text-amber-500 hover:bg-amber-950 transition-colors">
            <Bike className="w-4 h-4" />
          </button>
          <ShiftTimingPill timing={cashierShift.timing} />
          <div className="flex items-center gap-0.5 bg-gray-950 border border-gray-800 rounded-lg p-0.5">
            <button onClick={() => setPosView('live')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${posView === 'live' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Live
            </button>
            <button onClick={() => { setPosView('today'); if (posToken) fetchLiveSummary(posToken) }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${posView === 'today' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Aujourd'hui {liveSummary && liveSummary.count > 0 && <span className="ml-1 opacity-80">({liveSummary.count})</span>}
            </button>
          </div>
          {cashierShift.shift && (
            <button onClick={() => setShowCloture(true)}
              className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors">
              Clôture
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-400 text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {posView === 'today' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto space-y-3">
            {(!liveSummary || liveSummary.orders.length === 0) && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-3xl mb-3">🧾</p>
                <p className="text-sm">Aucune vente enregistrée aujourd'hui</p>
              </div>
            )}
            {liveSummary?.orders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-bold">{o.table ? `Table ${o.table.tableNumber}` : 'Comptoir'} <span className="text-gray-600 font-normal">· {o.paymentMethod}</span></p>
                  <p className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="text-emerald-400 font-extrabold text-sm">{o.totalPrice.toFixed(2)} {currency}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      <div className="flex-1 flex overflow-hidden">
        {/* Left: categories */}
        <div className="w-44 shrink-0 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 pb-2">Catégories</div>
          {menuCats.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeCat === cat.id ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}>
              {pName(cat)}
            </button>
          ))}
        </div>

        {/* Center: products */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {activeItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-2xl p-3 text-left transition-colors active:scale-95">
                <p className="text-white font-bold text-sm truncate">{pName(item)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-emerald-400 font-extrabold text-sm">{item.price.toFixed(2)} {currency}{item.unitType === 'WEIGHT' ? '/kg' : ''}</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-900/60 text-emerald-400 flex items-center justify-center font-bold">+</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: facture */}
        <div className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            {client ? (
              <div>
                <p className="text-white text-sm font-bold flex items-center gap-1.5">
                  {client.name || 'Client'}
                  {client.customerType === 'WHOLESALE' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 border border-amber-700/50">
                      Gros −{client.wholesaleDiscountPct}%
                    </span>
                  )}
                </p>
                <p className="text-gray-500 text-xs font-mono">{client.phone}</p>
              </div>
            ) : (
              <p className="text-amber-400 text-xs font-bold">⚠ Sélectionnez un client</p>
            )}
            <button onClick={() => setClientPicker(true)} className="px-3 py-2 -m-1 text-emerald-400 text-xs font-bold hover:text-emerald-300 active:scale-95 transition-all">
              {client ? 'Changer' : 'Choisir'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center gap-2 bg-gray-950 rounded-xl px-3 py-2">
                <button onClick={() => updateQty(item.productId, -1)}
                  className="w-11 h-11 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold active:scale-90 transition-all shrink-0">−</button>
                <span className="w-10 text-center text-white font-bold text-sm shrink-0">{item.unitType === 'WEIGHT' ? `${item.qty}g` : item.qty}</span>
                <button onClick={() => updateQty(item.productId, 1)}
                  className="w-11 h-11 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-400 font-bold active:scale-90 transition-all shrink-0">+</button>
                <span className="flex-1 text-white text-sm font-semibold truncate">{item.name}</span>
                <span className="text-gray-400 text-sm font-mono shrink-0">{lineTotal(item).toFixed(2)}</span>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-10">Aucun article — touchez un produit pour l'ajouter</p>
            )}
          </div>
          {wholesaleDiscount > 0 && (
            <div className="px-4 pt-2 flex items-baseline justify-between text-xs">
              <span className="text-gray-500">Sous-total</span>
              <span className="text-gray-400 font-mono">{cartSubtotal.toFixed(2)} {currency}</span>
            </div>
          )}
          {wholesaleDiscount > 0 && (
            <div className="px-4 flex items-baseline justify-between text-xs">
              <span className="text-amber-500">Remise gros (−{client?.wholesaleDiscountPct}%)</span>
              <span className="text-amber-400 font-mono">−{wholesaleDiscount.toFixed(2)} {currency}</span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-800 px-4 py-3 flex items-baseline justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</span>
            <span className="text-white font-extrabold text-xl font-mono">{cartTotal.toFixed(2)} {currency}</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          <button onClick={() => setOrderType('TAKEAWAY')}
            className={`px-4 py-2.5 text-xs font-bold ${orderType === 'TAKEAWAY' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Emporter
          </button>
          <button onClick={() => setOrderType('DINE_IN')}
            className={`px-4 py-2.5 text-xs font-bold ${orderType === 'DINE_IN' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Sur place
          </button>
        </div>

        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          <button onClick={() => setPayMethod('CASH')}
            className={`px-4 py-2.5 text-xs font-bold ${payMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Cash
          </button>
          <button onClick={() => setPayMethod('CARD')}
            className={`px-4 py-2.5 text-xs font-bold ${payMethod === 'CARD' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Carte
          </button>
        </div>

        {confirmErr && <span className="text-red-400 text-xs font-semibold">{confirmErr}</span>}
        {lastSale !== null && <span className="text-emerald-400 text-xs font-bold">✓ Vente enregistrée — {lastSale.toFixed(2)} {currency}</span>}

        <span className="flex-1" />

        <button
          onClick={handleConfirm}
          disabled={confirming || !client || cart.length === 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-extrabold text-sm rounded-xl active:scale-95 transition-all"
        >
          {confirming ? 'Traitement…' : `Confirmer & Imprimer — ${cartTotal.toFixed(2)} ${currency}`}
        </button>
      </div>
      </>
      )}

      {clientPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setClientPicker(false)}>
          <div className="bg-gray-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-white mb-3">Client</h3>
            <input
              type="text" autoFocus value={clientSearch} onChange={e => searchClients(e.target.value)}
              placeholder="Nom ou téléphone (+212...)"
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
              {clientResults.map(c => (
                <button key={c.id} onClick={() => { setClient(c); setClientPicker(false); setClientSearch(''); setClientResults([]) }}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{c.name || 'Sans nom'}</span>
                  <span className="text-gray-500 text-xs font-mono">{c.phone}</span>
                </button>
              ))}
            </div>
            {clientResults.length === 0 && /^\+?\d{7,15}$/.test(clientSearch.replace(/[\s\-().]/g, '')) && (
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <p className="text-gray-500 text-xs">Nouveau client — {clientSearch}</p>
                <input type="text" value={clientNewName} onChange={e => setClientNewName(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={newIsWholesale} onChange={e => setNewIsWholesale(e.target.checked)}
                    className="w-4 h-4 accent-amber-500" />
                  Client grossiste (revendeur)
                </label>
                {newIsWholesale && (
                  <div className="flex items-center gap-2">
                    <input type="number" value={newWholesalePct} onChange={e => setNewWholesalePct(e.target.value)}
                      min="0" max="100" placeholder="10"
                      className="w-20 px-3 py-2 bg-gray-950 border border-amber-700/50 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    <span className="text-xs text-amber-500">% de remise sur chaque commande</span>
                  </div>
                )}
                <button onClick={createClient} disabled={clientBusy}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm">
                  {clientBusy ? 'Création…' : 'Créer et sélectionner'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCloture && cashierShift.shift && (
        <ClotureModal
          shift={cashierShift.shift}
          currency={currency}
          onClose={() => setShowCloture(false)}
          onConfirm={async (countedCash) => {
            return await cashierShift.closeShift({
              pinCode: isDemoMode ? undefined : lastPinRef.current,
              demoStaffId: isDemoMode ? staff?.id : undefined,
              countedCash,
            })
          }}
        />
      )}

      {/* ── Marketplace Order Modal (Glovo, Uber Eats...) — shared with /pos ────── */}
      <MarketplaceOrderModal
        locale="fr"
        open={mp.showMarketplace}
        onClose={() => mp.setShowMarketplace(false)}
        menuCats={menuCats}
        pName={pName}
        currency={currency}
        mpPlatform={mp.mpPlatform} setMpPlatform={mp.setMpPlatform}
        mpPlatformOther={mp.mpPlatformOther} setMpPlatformOther={mp.setMpPlatformOther}
        mpRef={mp.mpRef} setMpRef={mp.setMpRef}
        mpCat={mp.mpCat} setMpCat={mp.setMpCat}
        mpCart={mp.mpCart} addToMpCart={mp.addToMpCart} updateMpQty={mp.updateMpQty} removeFromMpCart={mp.removeFromMpCart}
        mpCartTotal={mp.mpCartTotal}
        mpSubmitting={mp.mpSubmitting} mpError={mp.mpError}
        onSubmit={mp.submitMarketplaceOrder}
      />
    </div>
  )
}
