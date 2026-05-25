"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ShoppingCart, X, Plus, Minus, Bell } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { io as socketIO } from 'socket.io-client'
import useTranslation from '../../../src/hooks/useTranslation'
import LanguageSwitcher from './LanguageSwitcher'
import ReviewPrompt from './ReviewPrompt'
import SmartWifiCard from './SmartWifiCard'
import ErrorBoundary from '../../../src/components/ErrorBoundary'
import NProgressProvider from '../../../src/components/NProgressProvider'
import { useOffline } from './hooks/useOffline'
import { useLocalRouter } from './hooks/useLocalRouter'
import OfflineModal from './components/OfflineModal'

const theme = {
  primary: 'bg-emerald-600',
  primaryText: 'text-white',
  secondary: 'bg-amber-500'
}

type Product = {
  id: number
  nameAr: string
  nameEn: string
  nameFr: string
  description?: string
  price: number
  imageUrl?: string
}

type Category = {
  id: number
  nameAr: string
  nameEn: string
  nameFr: string
  products: Product[]
}

type MenuData = {
  cafeId:      number
  tableId:     number
  marketType?: 'Local' | 'Global'
  localIp?:    string | null
  cafe:        { id: number; name: string; logoUrl?: string | null }
  categories:  Category[]
}

type CartItem = { product: Product; qty: number }

type GpsState = 'pending' | 'granted' | 'denied' | 'unavailable'

export default function MenuPage({ params }: { params: { subdomain: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MenuContent params={params} />
    </Suspense>
  )
}

function MenuContent({ params }: { params: { subdomain: string } }) {
  const searchParams = useSearchParams()
  const tableToken = searchParams.get('token') ?? ''

  const { lang, tCategory, tProduct } = useTranslation()
  const isRtl = lang === 'ar'

  // ── PWA: register service worker once ───────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(reg => {
          // When a new SW is waiting, activate it immediately
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing
            sw?.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch(() => {}) // SW not supported in dev / HTTP — silent fail
    }
  }, [])

  const [menuData, setMenuData] = useState<MenuData | null>(null)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [gpsState, setGpsState] = useState<GpsState>('pending')

  const [cart, setCart] = useState<Record<number, CartItem>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [orderSent, setOrderSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [wifiData, setWifiData] = useState<{ ssid: string; password: string } | null>(null)
  const [resOpen, setResOpen]   = useState(false)
  const [resSent, setResSent]   = useState(false)
  const [resForm, setResForm]   = useState({ name: '', phone: '', guests: 2, date: '', notes: '' })
  const [resSending, setResSending] = useState(false)
  // Set of productIds whose price just changed — used to flash the price tag
  const [flashedPrices, setFlashedPrices] = useState<Set<string>>(new Set())

  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})

  // ── Offline + LAN fallback ───────────────────────────────────────────────────
  const { conn, lanEndpoint, queuedOrders } = useOffline({
    localIp: menuData?.localIp ?? null,
  })
  const { smartPost } = useLocalRouter({ conn, lanEndpoint })

  // Step 1: request GPS then fetch menu with location headers
  useEffect(() => {
    if (!tableToken) {
      setMenuError('رمز الطاولة غير موجود. يرجى مسح رمز QR مجدداً.')
      setLoadingMenu(false)
      return
    }

    if (!navigator.geolocation) {
      setGpsState('unavailable')
      setMenuError('متصفحك لا يدعم تحديد الموقع. يرجى استخدام متصفح حديث.')
      setLoadingMenu(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsState('granted')
        try {
          const res = await fetch(`/${params.subdomain}/menu?tableToken=${tableToken}`, {
            headers: {
              'x-user-lat': String(pos.coords.latitude),
              'x-user-lng': String(pos.coords.longitude),
              'x-table-token': tableToken
            }
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            setMenuError(body.error ?? 'فشل تحميل القائمة. يرجى المحاولة مجدداً.')
            setLoadingMenu(false)
            return
          }
          const data: MenuData = await res.json()
          setMenuData(data)
        } catch {
          setMenuError('خطأ في الشبكة. يرجى التحقق من اتصالك بالإنترنت.')
        } finally {
          setLoadingMenu(false)
        }
      },
      () => {
        setGpsState('denied')
        setMenuError('يجب السماح بالوصول إلى موقعك للتأكد من وجودك داخل المقهى.')
        setLoadingMenu(false)
      },
      { timeout: 10000, maximumAge: 30000 }
    )
  }, [params.subdomain, tableToken])

  // Live price sync — join menu_room after menu data is available
  useEffect(() => {
    if (!menuData) return

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
    const socket = socketIO(SOCKET_URL, { transports: ['polling', 'websocket'] })

    socket.on('connect', () => {
      socket.emit('join_menu_room', {
        cafeId: String(menuData.cafeId),
        tableToken
      })
    })

    socket.on('price_updated', ({ productId, price }: { productId: string; price: number }) => {
      // Update live price in menu state
      setMenuData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          categories: prev.categories.map(cat => ({
            ...cat,
            products: cat.products.map(p =>
              String(p.id) === productId ? { ...p, price } : p
            )
          }))
        }
      })
      // Sync price in cart so totals stay correct
      setCart(prev => {
        const numId = Number(productId)
        const item = prev[numId]
        if (!item) return prev
        return { ...prev, [numId]: { ...item, product: { ...item.product, price } } }
      })
      // Flash the updated price badge for 2 s
      setFlashedPrices(prev => {
        const next = new Set(prev)
        next.add(productId)
        return next
      })
      setTimeout(() => {
        setFlashedPrices(prev => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }, 2000)
    })

    return () => { socket.disconnect() }
  }, [menuData?.cafeId, tableToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const itemsArray = useMemo(() => Object.values(cart), [cart])
  const totalQty = itemsArray.reduce((s, it) => s + it.qty, 0)
  const totalPrice = itemsArray.reduce((s, it) => s + it.qty * it.product.price, 0)

  function addToCart(product: Product) {
    setCart((c) => {
      const existing = c[product.id]
      return { ...c, [product.id]: { product, qty: (existing?.qty ?? 0) + 1 } }
    })
  }

  function changeQty(productId: number, delta: number) {
    setCart((c) => {
      const item = c[productId]
      if (!item) return c
      const newQty = item.qty + delta
      if (newQty <= 0) {
        const next = { ...c }
        delete next[productId]
        return next
      }
      return { ...c, [productId]: { ...item, qty: newQty } }
    })
  }

  function scrollToCategory(id: number) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function sendOrder() {
    if (!menuData || itemsArray.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const payload = {
        tableToken,
        items: itemsArray.map((it) => ({ productId: it.product.id, quantity: it.qty }))
      }

      // smartPost: tries cloud → LAN → SW offline queue automatically
      const result = await smartPost({
        url:  '/api/orders',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
      })

      if (!result.ok && !result.queued) {
        alert('فشل إرسال الطلب. يرجى المحاولة مجدداً.')
        return
      }

      setOrderSent(true)
      setCart({})
      setDrawerOpen(false)

      // After order confirmed, try to fetch Smart WiFi credentials (best-effort)
      if (result.via !== 'sw-queue') {
        try {
          const wifiRes = await fetch(`/api/menu/wifi?tableToken=${encodeURIComponent(tableToken)}`)
          if (wifiRes.ok) {
            const wifi = await wifiRes.json()
            if (wifi.ssid) setWifiData(wifi)
          }
        } catch {
          // WiFi feature unavailable — silently ignore
        }
      }
    } catch {
      alert('خطأ في الشبكة. يرجى المحاولة مجدداً.')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendReservation() {
    if (!tableToken || !resForm.name || !resForm.phone || !resForm.date) return
    setResSending(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resForm, tableToken })
      })
      if (res.ok) {
        setResSent(true)
        setResForm({ name: '', phone: '', guests: 2, date: '', notes: '' })
        setTimeout(() => { setResOpen(false); setResSent(false) }, 2500)
      } else {
        const d = await res.json()
        alert(d.error || 'فشل إرسال الحجز')
      }
    } catch {
      alert('خطأ في الشبكة')
    } finally {
      setResSending(false)
    }
  }

  async function requestBill() {
    if (!tableToken) return
    try {
      await fetch('/api/bill-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableToken })
      })
      alert('تم إرسال طلب الحساب. سيأتي النادل قريباً.')
    } catch {
      alert('فشل إرسال طلب الحساب.')
    }
  }

  // Loading / error states
  if (loadingMenu) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">جارٍ تحميل القائمة…</p>
      </div>
    )
  }

  if (menuError || !menuData) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50 text-center">
        <Bell className="w-12 h-12 text-red-400" />
        <p className="text-red-600 font-medium">{menuError ?? 'حدث خطأ غير متوقع.'}</p>
        {gpsState === 'denied' && (
          <p className="text-sm text-gray-500">يرجى تفعيل خدمة الموقع في إعدادات المتصفح وإعادة تحميل الصفحة.</p>
        )}
      </div>
    )
  }

  const { cafe, categories } = menuData

  return (
    <ErrorBoundary>
      <NProgressProvider />

      {/* ── Offline modal / LAN toast ──────────────────────────────────────── */}
      <OfflineModal
        conn={conn}
        marketType={menuData?.marketType ?? 'Local'}
        lang={lang}
        queuedOrders={queuedOrders}
      />

      <div dir={isRtl ? 'rtl' : 'ltr'} className="relative min-h-screen bg-gray-50 text-gray-900">

        {/* Watermark — cafe logo at 5% opacity, fixed behind all content */}
        {cafe.logoUrl && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-[0.05]"
            style={{ backgroundImage: `url(${cafe.logoUrl})` }}
          />
        )}

        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {cafe.logoUrl && (
                <img
                  src={cafe.logoUrl}
                  alt={cafe.name}
                  className="w-9 h-9 aspect-square object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0"
                />
              )}
              <div className="font-bold text-lg leading-tight">{cafe.name}</div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={requestBill}
                className={`${theme.primary} ${theme.primaryText} px-3 py-2 rounded-lg flex items-center gap-2 text-sm`}
              >
                <Phone className="w-4 h-4" />
                <span>طلب الحساب</span>
              </button>
            </div>
          </div>
        </header>

        {/* Category tabs */}
        <div className="sticky top-16 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto">
            <div className="flex gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => scrollToCategory(c.id)}
                  className="whitespace-nowrap px-3 py-2 rounded-full bg-white shadow-sm text-sm hover:bg-emerald-50 transition-colors"
                >
                  {tCategory(c)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product grid */}
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-28">
          {categories.map((cat) => (
            <section key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el }}>
              <h3 className="text-xl font-semibold mb-4">{tCategory(cat)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                {cat.products.map((p) => (
                  <article key={p.id} className="bg-white rounded-xl shadow-sm p-3 flex flex-col">
                    {p.imageUrl && (
                      <div className="h-36 bg-gray-100 rounded-lg overflow-hidden mb-3">
                        <img
                          src={p.imageUrl}
                          alt={tProduct(p)}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{tProduct(p)}</h4>
                      {p.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className={`text-base font-semibold transition-colors duration-500 ${flashedPrices.has(String(p.id)) ? 'text-emerald-600 scale-110' : ''}`}>
                        {Number(p.price).toFixed(2)} MAD
                      </div>
                      {cart[p.id] ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeQty(p.id, -1)}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{cart[p.id].qty}</span>
                          <button
                            onClick={() => changeQty(p.id, 1)}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          className={`${theme.primary} ${theme.primaryText} px-3 py-1 rounded-lg text-sm`}
                        >
                          إضافة
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>

        {/* Floating cart button */}
        <AnimatePresence>
          {totalQty > 0 && (
            <motion.div
              className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none z-30"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
            >
              <button
                onClick={() => setDrawerOpen(true)}
                className={`${theme.primary} ${theme.primaryText} pointer-events-auto py-3 px-6 rounded-full shadow-xl flex items-center gap-3`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="font-medium">{totalQty} عناصر</span>
                <span className="opacity-75">·</span>
                <span>{totalPrice.toFixed(2)} MAD</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cart drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/40 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: isRtl ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: isRtl ? '-100%' : '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`fixed inset-y-0 ${isRtl ? 'left-0' : 'right-0'} w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col`}
              >
                <div className="p-4 border-b flex items-center justify-between">
                  <h4 className="font-semibold text-lg">سلة الطلبات</h4>
                  <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {itemsArray.length === 0 ? (
                    <p className="text-gray-400 text-center mt-8">السلة فارغة</p>
                  ) : (
                    itemsArray.map((it) => (
                      <div key={it.product.id} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{tProduct(it.product)}</div>
                          <div className="text-sm text-gray-500">{Number(it.product.price).toFixed(2)} MAD</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => changeQty(it.product.id, -1)} className="p-1 rounded bg-gray-100">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-medium">{it.qty}</span>
                          <button onClick={() => changeQty(it.product.id, 1)} className="p-1 rounded bg-gray-100">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-600">الإجمالي</span>
                    <span className="font-bold text-lg">{totalPrice.toFixed(2)} MAD</span>
                  </div>
                  <button
                    className={`${theme.secondary} text-white w-full py-3 rounded-xl font-medium disabled:opacity-60`}
                    onClick={sendOrder}
                    disabled={submitting || itemsArray.length === 0}
                  >
                    {submitting ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Floating reservation button */}
        {!orderSent && totalQty === 0 && (
          <button
            onClick={() => setResOpen(true)}
            className="fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-full shadow-xl transition-all"
          >
            📅 حجز طاولة
          </button>
        )}

        {/* Reservation modal */}
        <AnimatePresence>
          {resOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-50"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setResOpen(false)}
              />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {resSent ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-5xl">✅</p>
                    <p className="font-bold text-lg text-gray-800">تم إرسال الحجز!</p>
                    <p className="text-sm text-gray-500">سيتواصل معك المطعم للتأكيد</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-gray-900">📅 حجز طاولة</h3>
                      <button onClick={() => setResOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">الاسم *</label>
                        <input
                          type="text" placeholder="اسمك الكامل"
                          value={resForm.name}
                          onChange={e => setResForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">رقم الهاتف *</label>
                        <input
                          type="tel" placeholder="06XXXXXXXX"
                          value={resForm.phone}
                          onChange={e => setResForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">عدد الأشخاص *</label>
                          <select
                            value={resForm.guests}
                            onChange={e => setResForm(f => ({ ...f, guests: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                          >
                            {[1,2,3,4,5,6,7,8,10,12,15,20].map(n => (
                              <option key={n} value={n}>{n} {n === 1 ? 'شخص' : 'أشخاص'}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">التاريخ والوقت *</label>
                          <input
                            type="datetime-local"
                            min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                            value={resForm.date}
                            onChange={e => setResForm(f => ({ ...f, date: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">ملاحظات (اختياري)</label>
                        <textarea
                          placeholder="حساسية غذائية، مناسبة خاصة..."
                          value={resForm.notes}
                          onChange={e => setResForm(f => ({ ...f, notes: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={sendReservation}
                      disabled={resSending || !resForm.name || !resForm.phone || !resForm.date}
                      className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                    >
                      {resSending ? 'جاري الإرسال…' : 'تأكيد الحجز'}
                    </button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Review prompt + Smart WiFi card after successful order */}
        <AnimatePresence>
          {orderSent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md p-4 space-y-3">
                {wifiData && (
                  <SmartWifiCard
                    ssid={wifiData.ssid}
                    password={wifiData.password}
                    onClose={() => setWifiData(null)}
                  />
                )}
                <ReviewPrompt
                  cafeName={cafe.name}
                  socialLinks={{}}
                  onClose={() => setOrderSent(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ErrorBoundary>
  )
}
