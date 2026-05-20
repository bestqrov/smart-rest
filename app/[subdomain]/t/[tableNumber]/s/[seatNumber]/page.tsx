'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useSearchParams } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  cafeId: string; tableId: string; tableNumber: number
  seatId: string; seatNumber: number; billingTableId: string
  isMerged: boolean; mergedIntoTableNumber?: number
}
type Product = {
  id: string; nameEn: string; nameAr: string; nameFr?: string
  price: number; imageUrl?: string | null; description?: string | null
}
type Category = { id: string; nameEn: string; nameAr: string; products: Product[] }
type CartItem = { product: Product; quantity: number }
type Toast = { id: number; message: string; type: 'success' | 'info' | 'error' }

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Offline cart ─────────────────────────────────────────────────────────────

const CART_KEY = 'sm_cart'
const loadCart = (): CartItem[] => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] } }
const saveCart = (c: CartItem[]) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)) } catch {} }

// ─── AI upsell rules ──────────────────────────────────────────────────────────

function getUpsells(cart: CartItem[], all: Product[]): Product[] {
  const inCart = new Set(cart.map(i => i.product.id))
  const names = cart.map(i => i.product.nameEn.toLowerCase())
  const hour = new Date().getHours()
  const picks: Product[] = []

  if (hour >= 12 && hour <= 18) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['juice', 'lemonade', 'iced', 'cold', 'smoothie', 'water', 'refresh'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 2))
  }
  if (names.some(n => n.includes('burger') || n.includes('sandwich'))) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['fries', 'cheese', 'onion', 'sauce', 'extra'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 1))
  }
  if (names.some(n => ['coffee', 'espresso', 'latte', 'cappuccino'].some(k => n.includes(k)))) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['cake', 'cookie', 'muffin', 'croissant', 'pastry', 'dessert'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 2))
  }

  const seen = new Set<string>()
  return picks.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }).slice(0, 3)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  return (
    <Suspense fallback={<Loader />}>
      <MenuPageInner />
    </Suspense>
  )
}

function MenuPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()

  const subdomain    = params.subdomain    as string
  const tableNumber  = params.tableNumber  as string
  const seatNumber   = params.seatNumber   as string
  const token        = searchParams.get('token') ?? ''

  const [status, setStatus]             = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [session, setSession]           = useState<Session | null>(null)
  const [categories, setCategories]     = useState<Category[]>([])
  const [cafeName, setCafeName]         = useState('')
  const [cafeLogoUrl, setCafeLogoUrl]   = useState<string | null>(null)
  const [currency, setCurrency]         = useState('MAD')
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch]             = useState('')
  const [cart, setCart]                 = useState<CartItem[]>([])
  const [showWaiter, setShowWaiter]     = useState(false)
  const [showCart, setShowCart]         = useState(false)
  const [showAI, setShowAI]             = useState(false)
  const [showPhoto, setShowPhoto]       = useState(false)
  const [upsells, setUpsells]           = useState<Product[]>([])
  const [ordering, setOrdering]         = useState(false)
  const [orderId, setOrderId]           = useState<string | null>(null)
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [photoFiltered, setPhotoFiltered] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)

  const socketRef   = useRef<Socket | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const toastIdRef  = useRef(0)
  const catBarRef   = useRef<HTMLDivElement>(null)

  // ─── Toast ────────────────────────────────────────────────────────────────
  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  // ─── Session validation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    fetch(`/api/qr/session?subdomain=${subdomain}&tableNumber=${tableNumber}&seatNumber=${seatNumber}&token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('invalid'); return }
        setSession(data)
        setStatus('valid')
        const cached = loadCart()
        if (cached.length) setCart(cached)
      })
      .catch(() => setStatus('invalid'))
  }, [subdomain, tableNumber, seatNumber, token])

  // ─── Menu fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    fetch(`/api/menu/public?tableId=${session.tableId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.categories) return
        setCategories(data.categories)
        setCafeName(data.cafeName ?? '')
        setCafeLogoUrl(data.cafeLogoUrl ?? null)
        setCurrency(data.currency ?? 'MAD')
        setActiveCategory(data.categories[0]?.id ?? '')
      })
      .catch(() => {})
  }, [session])

  // ─── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || !SOCKET_URL) return
    const socket = socketIO(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on('connect', () => {
      socket.emit('join_table_room', { cafeId: session.cafeId, tableId: session.tableId, seatToken: token })
    })
    socket.on('TABLES_MERGED', (p: any) => toast(`Your table has merged with Table ${p.targetTableNumber}`, 'info'))
    socket.on('your_order_updated', (p: any) => toast(`Order status: ${p.status}`, 'info'))
    return () => { socket.disconnect() }
  }, [session, token, toast])

  // ─── Cart persistence ─────────────────────────────────────────────────────
  useEffect(() => { saveCart(cart) }, [cart])

  // ─── Cart helpers ─────────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart(c => {
      const e = c.find(i => i.product.id === product.id)
      return e ? c.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
               : [...c, { product, quantity: 1 }]
    })
    toast(`${product.nameEn} added`, 'success')
  }, [toast])

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(i => i.product.id !== productId))
    else setCart(c => c.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const allProducts = categories.flatMap(c => c.products)

  // ─── Pre-order AI check ───────────────────────────────────────────────────
  const handlePreOrder = () => {
    if (!session || cart.length === 0) return
    const suggestions = getUpsells(cart, allProducts)
    if (suggestions.length > 0) {
      setUpsells(suggestions)
      setShowAI(true)
      setShowCart(false)
    } else {
      handlePlaceOrder()
    }
  }

  // ─── Place order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!session || cart.length === 0) return
    setOrdering(true)
    setShowAI(false)
    setShowCart(false)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatToken: token,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity }))
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderId(data.orderId)
      setCart([])
      saveCart([])
      toast('🎉 Order placed! We\'re on it.', 'success')
      setTimeout(() => setShowPhoto(true), 2000)
    } catch (err: any) {
      toast(err.message || 'Failed to place order', 'error')
    } finally {
      setOrdering(false)
    }
  }

  // ─── Waiter calls ─────────────────────────────────────────────────────────
  const callWaiter = (type: string, msg: string) => {
    if (!session || !socketRef.current) return
    socketRef.current.emit('waiter_call', { cafeId: session.cafeId, tableId: session.tableId, type, message: msg })
    setShowWaiter(false)
    toast(`✅ Waiter on the way to Seat ${session.seatNumber} · Table ${session.tableNumber}!`)
  }

  const requestBill = (method: string) => {
    if (!session || !socketRef.current) return
    socketRef.current.emit('request_bill', { cafeId: session.cafeId, tableId: session.tableId, message: `Bill via ${method}` })
    setShowWaiter(false)
    toast(`💳 Bill requested · Table ${session.tableNumber}`)
  }

  // ─── Photo capture ────────────────────────────────────────────────────────
  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => applyFilter(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const applyFilter = async (src: string) => {
    setPhotoLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) { setPhotoLoading(false); return }

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      // Warm vintage overlay
      ctx.fillStyle = 'rgba(255,140,40,0.12)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Vignette
      const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.75)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.35)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Logo or text watermark
      if (cafeLogoUrl) {
        const logo = new Image()
        logo.crossOrigin = 'anonymous'
        logo.onload = () => {
          const lw = canvas.width * 0.22
          const lh = (logo.height / logo.width) * lw
          ctx.globalAlpha = 0.75
          ctx.drawImage(logo, canvas.width - lw - 18, canvas.height - lh - 18, lw, lh)
          ctx.globalAlpha = 1
          setPhotoFiltered(canvas.toDataURL('image/jpeg', 0.88))
          setPhotoLoading(false)
        }
        logo.onerror = () => { addTextWatermark(ctx, canvas); setPhotoFiltered(canvas.toDataURL('image/jpeg', 0.88)); setPhotoLoading(false) }
        logo.src = cafeLogoUrl
      } else {
        addTextWatermark(ctx, canvas)
        setPhotoFiltered(canvas.toDataURL('image/jpeg', 0.88))
        setPhotoLoading(false)
      }
    }
    img.src = src
  }

  const addTextWatermark = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const fs = Math.max(18, canvas.width * 0.045)
    ctx.font = `bold ${fs}px -apple-system, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textAlign = 'right'
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 6
    ctx.fillText(`📍 ${cafeName}`, canvas.width - 16, canvas.height - 20)
    ctx.shadowBlur = 0
  }

  const handleShare = async () => {
    if (!photoFiltered) return
    try {
      const blob = await (await fetch(photoFiltered)).blob()
      const file = new File([blob], 'my-plate.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${cafeName} ✨`, text: '#SmartMenu #FoodVibes' })
        if (orderId) {
          fetch(`/api/orders/${orderId}/social-verified`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {})
        }
        toast('🎉 Shared! Enjoy your moment.', 'success')
      } else {
        const a = document.createElement('a'); a.href = photoFiltered; a.download = 'my-plate.jpg'; a.click()
        toast('📥 Photo saved to gallery!', 'info')
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast('Could not share', 'error')
    }
  }

  // ─── Filtered view ────────────────────────────────────────────────────────
  const displayCategories = search
    ? categories.map(c => ({ ...c, products: c.products.filter(p => p.nameEn.toLowerCase().includes(search.toLowerCase()) || p.nameAr.includes(search)) })).filter(c => c.products.length)
    : categories

  const visibleProducts = search
    ? displayCategories.flatMap(c => c.products)
    : categories.find(c => c.id === activeCategory)?.products ?? []

  // ─── Render guards ────────────────────────────────────────────────────────
  if (status === 'loading') return <Loader />
  if (status === 'invalid') return <InvalidQR />

  return (
    <div className="min-h-screen bg-[#f7f7f5] font-sans select-none">
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoFile} />

      {/* ── Sticky header ── */}
      <header className="bg-white sticky top-0 z-30 border-b border-gray-100">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {cafeLogoUrl && <img src={cafeLogoUrl} alt={cafeName} className="w-8 h-8 rounded-lg object-cover" />}
              <div>
                <h1 className="font-bold text-gray-900 leading-tight">{cafeName || 'Menu'}</h1>
                <p className="text-xs text-emerald-600 font-medium">📍 Table {tableNumber} · Seat {seatNumber}</p>
              </div>
            </div>
            {session?.isMerged && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                Merged → T{session.mergedIntoTableNumber}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full bg-gray-100 rounded-2xl px-4 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">×</button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div ref={catBarRef} className="flex gap-2 px-4 pb-3 pt-1 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat.id ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {cat.nameEn}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Post-order share card ── */}
      <AnimatePresence>
        {orderId && !showPhoto && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-4 rounded-3xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-base">📸 Share the vibe!</p>
                  <p className="text-xs opacity-80 mt-0.5">Snap your plate · Get a branded filter</p>
                </div>
                <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowPhoto(true)}
                  className="bg-white text-purple-600 font-bold px-4 py-2 rounded-2xl text-sm shadow">
                  Open Camera
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product list ── */}
      <main className="px-4 pt-4 pb-36 space-y-3">
        {visibleProducts.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <p className="text-4xl mb-2">🍽️</p>
            <p>No items found</p>
          </div>
        )}
        {visibleProducts.map(product => (
          <ProductCard key={product.id} product={product} currency={currency}
            cartQty={cart.find(i => i.product.id === product.id)?.quantity ?? 0}
            onAdd={() => addToCart(product)}
            onUpdateQty={qty => updateQty(product.id, qty)}
          />
        ))}
      </main>

      {/* ── Floating cart bar ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-[72px] left-4 right-4 z-20">
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowCart(true)}
              className="w-full bg-gray-900 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl">
              <span className="bg-emerald-400 text-gray-900 rounded-full px-2.5 py-0.5 text-sm font-bold">{cartCount}</span>
              <span className="font-semibold">View Cart</span>
              <span className="font-bold">{cartTotal.toFixed(2)} {currency}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call Waiter FAB ── */}
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowWaiter(true)}
        className="fixed bottom-5 right-4 z-20 bg-amber-400 text-white rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-2xl"
        aria-label="Call Waiter">
        <span className="text-xl">🔔</span>
        <span className="text-[9px] font-bold leading-none mt-0.5">WAITER</span>
      </motion.button>

      {/* ── Waiter sheet ── */}
      <Sheet open={showWaiter} onClose={() => setShowWaiter(false)} title="How can we help?">
        <div className="space-y-2.5 pb-2">
          <WaiterBtn icon="💳" label="Request Bill (Cash)" sub="We'll bring change" onClick={() => requestBill('cash')} />
          <WaiterBtn icon="📱" label="Request Bill (Card / Apple Pay)" sub="Card machine on the way" onClick={() => requestBill('card')} />
          <WaiterBtn icon="🧊" label="Extra Ice / Water" sub="Coming right up" onClick={() => callWaiter('WATER', 'Extra ice / water needed')} />
          <WaiterBtn icon="❓" label="I have a question" sub="Waiter will assist you" onClick={() => callWaiter('QUESTION', 'Customer has a question')} />
          <WaiterBtn icon="🧹" label="Table needs cleaning" sub="We'll tidy up" onClick={() => callWaiter('CLEAN', 'Table cleaning requested')} />
        </div>
      </Sheet>

      {/* ── Cart sheet ── */}
      <Sheet open={showCart} onClose={() => setShowCart(false)} title="Your Order">
        <div className="space-y-4">
          {cart.map(item => (
            <div key={item.product.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{item.product.nameEn}</p>
                <p className="text-emerald-600 text-sm font-semibold">{(item.product.price * item.quantity).toFixed(2)} {currency}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center">−</button>
                <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => updateQty(item.product.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-lg flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-center text-gray-400 py-8">Your cart is empty</p>}
        </div>
        {cart.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between mb-4">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-xl">{cartTotal.toFixed(2)} {currency}</span>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePreOrder} disabled={ordering}
              className="w-full bg-gray-900 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-50 shadow-lg">
              {ordering ? 'Placing Order…' : `Confirm Order · ${cartTotal.toFixed(2)} ${currency}`}
            </motion.button>
          </div>
        )}
      </Sheet>

      {/* ── AI upsell sheet ── */}
      <Sheet open={showAI} onClose={() => { setShowAI(false); handlePlaceOrder() }} title="✨ Complete your order">
        <p className="text-sm text-gray-500 mb-4">Customers who ordered the same also loved:</p>
        <div className="space-y-3">
          {upsells.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
              {p.imageUrl && <img src={p.imageUrl} alt={p.nameEn} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{p.nameEn}</p>
                <p className="text-xs text-gray-500">{p.nameAr}</p>
                <p className="text-emerald-600 font-bold text-sm mt-0.5">+{p.price.toFixed(2)} {currency}</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { addToCart(p); setUpsells(u => u.filter(x => x.id !== p.id)) }}
                className="bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm">
                Add
              </motion.button>
            </motion.div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={() => { setShowAI(false); handlePlaceOrder() }}
            className="flex-1 border-2 border-gray-200 text-gray-600 rounded-2xl py-3.5 font-semibold text-sm">
            Skip
          </button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowAI(false); handlePlaceOrder() }}
            className="flex-[2] bg-gray-900 text-white rounded-2xl py-3.5 font-bold text-sm shadow-md">
            Place Order 🎉
          </motion.button>
        </div>
      </Sheet>

      {/* ── Photo capture sheet ── */}
      <Sheet open={showPhoto} onClose={() => { setShowPhoto(false); setPhotoFiltered(null) }} title="📸 Share the Vibe">
        {!photoFiltered && !photoLoading && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-gray-600 mb-2 font-medium">Snap your plate!</p>
            <p className="text-sm text-gray-400 mb-6">We'll add a branded filter automatically</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-3.5 rounded-2xl font-bold text-base shadow-lg">
              Open Camera 📷
            </motion.button>
          </div>
        )}
        {photoLoading && (
          <div className="text-center py-10">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="text-5xl inline-block mb-4">✨</motion.div>
            <p className="font-semibold text-gray-700">Adding Cafe Branded Filter…</p>
            <p className="text-sm text-gray-400 mt-1">Just a moment</p>
          </div>
        )}
        {photoFiltered && !photoLoading && (
          <div>
            <div className="rounded-2xl overflow-hidden mb-4 shadow-lg">
              <img src={photoFiltered} alt="Filtered" className="w-full object-cover" />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleShare}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-2xl py-4 font-bold text-base shadow-lg mb-3">
              📤 Share to Instagram / Snapchat
            </motion.button>
            <button onClick={() => { setPhotoFiltered(null) }}
              className="w-full text-gray-500 text-sm py-2">Retake Photo</button>
          </div>
        )}
      </Sheet>

      {/* ── Toast stack ── */}
      <div className="fixed top-4 left-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl text-white ${
                t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
              }`}>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductCard({ product, currency, cartQty, onAdd, onUpdateQty }: {
  product: Product; currency: string; cartQty: number
  onAdd: () => void; onUpdateQty: (qty: number) => void
}) {
  return (
    <motion.div layout className="bg-white rounded-2xl shadow-sm overflow-hidden flex items-stretch">
      {product.imageUrl && (
        <div className="w-28 h-28 flex-shrink-0 bg-gray-100 overflow-hidden">
          <img src={product.imageUrl} alt={product.nameEn} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">{product.nameEn}</p>
          <p className="text-gray-400 text-xs mt-0.5" dir="rtl">{product.nameAr}</p>
          {product.description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-bold text-gray-900">{product.price.toFixed(2)} <span className="text-xs font-medium text-gray-400">{currency}</span></span>
          {cartQty === 0 ? (
            <motion.button whileTap={{ scale: 0.82 }} onClick={onAdd}
              className="bg-gray-900 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold shadow-md">
              +
            </motion.button>
          ) : (
            <div className="flex items-center gap-2">
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(cartQty - 1)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-lg">−</motion.button>
              <span className="w-5 text-center font-bold text-sm">{cartQty}</span>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(cartQty + 1)}
                className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-lg">+</motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-2">
              <h2 className="font-bold text-lg text-gray-900">{title}</h2>
            </div>
            <div className="px-5 pb-10">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function WaiterBtn({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-gray-50 active:bg-gray-100 rounded-2xl px-4 py-3.5 text-left transition-colors">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
      <span className="text-gray-300 text-lg flex-shrink-0">›</span>
    </motion.button>
  )
}

function Loader() {
  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center">
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-5xl mb-4 inline-block">🍽️</motion.div>
        <p className="text-gray-500 font-medium">Loading your menu…</p>
      </div>
    </div>
  )
}

function InvalidQR() {
  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-8">
      <div className="text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h2 className="font-bold text-xl text-gray-800 mb-2">Invalid QR Code</h2>
        <p className="text-gray-500 text-sm leading-relaxed">This QR code is invalid or has expired.<br />Please scan the code on your table again.</p>
      </div>
    </div>
  )
}
