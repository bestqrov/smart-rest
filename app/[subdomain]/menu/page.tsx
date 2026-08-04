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
import CertifiedBadge from './components/CertifiedBadge'

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

type MarketType = 'Local' | 'Global' | 'Africa' | 'Gulf'

type MenuData = {
  cafeId:               string
  tableId:              string
  marketType?:          MarketType
  localIp?:             string | null
  reservationsEnabled?: boolean
  certificationStatus?: string
  cafe:                 { name: string; logoUrl?: string | null }
  categories:           Category[]
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

// ── Multilingual error/UI strings ────────────────────────────────────────────

const UI_STRINGS = {
  noToken:       { ar: 'رمز الطاولة غير موجود. يرجى مسح رمز QR مجدداً.', fr: 'Code de table introuvable. Veuillez scanner à nouveau le QR code.', en: 'Table token not found. Please scan the QR code again.', es: 'Token de mesa no encontrado. Por favor escanee el QR de nuevo.' },
  noGeo:         { ar: 'متصفحك لا يدعم تحديد الموقع. يرجى استخدام متصفح حديث.', fr: 'Votre navigateur ne supporte pas la géolocalisation.', en: 'Your browser does not support geolocation. Please use a modern browser.', es: 'Su navegador no soporta geolocalización.' },
  gpsDenied:     { ar: 'يجب السماح بالوصول إلى موقعك للتأكد من وجودك داخل المقهى.', fr: "Veuillez autoriser l'accès à votre localisation pour confirmer votre présence.", en: 'Please allow location access to confirm you are inside the venue.', es: 'Por favor permita acceso a su ubicación para confirmar que está en el local.' },
  loadFailed:    { ar: 'فشل تحميل القائمة. يرجى المحاولة مجدداً.', fr: 'Échec du chargement du menu. Veuillez réessayer.', en: 'Failed to load the menu. Please try again.', es: 'Error al cargar el menú. Por favor inténtelo de nuevo.' },
  networkErr:    { ar: 'خطأ في الشبكة. يرجى التحقق من اتصالك بالإنترنت.', fr: "Erreur réseau. Vérifiez votre connexion internet.", en: 'Network error. Please check your internet connection.', es: 'Error de red. Por favor verifique su conexión.' },
  orderFailed:   { ar: 'فشل إرسال الطلب. يرجى المحاولة مجدداً.', fr: "Échec de l'envoi de la commande. Veuillez réessayer.", en: 'Failed to send order. Please try again.', es: 'Error al enviar el pedido. Por favor inténtelo de nuevo.' },
  resFailed:     { ar: 'فشل إرسال الحجز', fr: 'Échec de la réservation', en: 'Reservation failed', es: 'Reserva fallida' },
  billSent:      { ar: 'تم إرسال طلب الحساب. سيأتي النادل قريباً.', fr: "Demande d'addition envoyée. Le serveur arrive bientôt.", en: 'Bill requested. A waiter will come shortly.', es: 'Cuenta solicitada. Un mesero vendrá pronto.' },
  billFailed:    { ar: 'فشل إرسال طلب الحساب.', fr: "Échec de la demande d'addition.", en: 'Failed to request the bill.', es: 'Error al solicitar la cuenta.' },
  loading:       { ar: 'جارٍ تحميل القائمة…', fr: 'Chargement du menu…', en: 'Loading menu…', es: 'Cargando menú…' },
  unexpectedErr: { ar: 'حدث خطأ غير متوقع.', fr: 'Une erreur inattendue s\'est produite.', en: 'An unexpected error occurred.', es: 'Ocurrió un error inesperado.' },
  gpsHint:       { ar: 'يرجى تفعيل خدمة الموقع في إعدادات المتصفح وإعادة تحميل الصفحة.', fr: 'Veuillez activer la géolocalisation dans les paramètres du navigateur et recharger la page.', en: 'Please enable location services in your browser settings and reload the page.', es: 'Active los servicios de ubicación en su navegador y recargue la página.' },
}

// ── Reservation modal strings — was hardcoded Arabic-only despite this page
// supporting AR/FR/EN/ES everywhere else ──────────────────────────────────────
const RES_STRINGS = {
  title:      { ar: '📅 حجز طاولة', fr: '📅 Réserver une table', en: '📅 Book a table', es: '📅 Reservar mesa' },
  name:       { ar: 'الاسم *', fr: 'Nom *', en: 'Name *', es: 'Nombre *' },
  namePh:     { ar: 'اسمك الكامل', fr: 'Votre nom complet', en: 'Your full name', es: 'Tu nombre completo' },
  phone:      { ar: 'رقم الهاتف *', fr: 'Téléphone *', en: 'Phone *', es: 'Teléfono *' },
  guests:     { ar: 'عدد الأشخاص *', fr: 'Nombre de personnes *', en: 'Number of guests *', es: 'Número de personas *' },
  guestsUnit: { ar: (n: number) => n === 1 ? 'شخص' : 'أشخاص', fr: (n: number) => n === 1 ? 'personne' : 'personnes', en: (n: number) => n === 1 ? 'guest' : 'guests', es: (n: number) => n === 1 ? 'persona' : 'personas' },
  date:       { ar: 'التاريخ والوقت *', fr: 'Date et heure *', en: 'Date & time *', es: 'Fecha y hora *' },
  notes:      { ar: 'ملاحظات (اختياري)', fr: 'Notes (optionnel)', en: 'Notes (optional)', es: 'Notas (opcional)' },
  notesPh:    { ar: 'حساسية غذائية، مناسبة خاصة...', fr: 'Allergie, occasion spéciale...', en: 'Allergy, special occasion...', es: 'Alergia, ocasión especial...' },
  sending:    { ar: 'جاري الإرسال…', fr: 'Envoi en cours…', en: 'Sending…', es: 'Enviando…' },
  confirm:    { ar: 'تأكيد الحجز', fr: 'Confirmer la réservation', en: 'Confirm Reservation', es: 'Confirmar Reserva' },
  sentTitle:  { ar: 'تم إرسال الحجز!', fr: 'Réservation envoyée !', en: 'Reservation sent!', es: '¡Reserva enviada!' },
  sentSub:    { ar: 'سيتواصل معك المطعم للتأكيد', fr: 'Le restaurant vous contactera pour confirmer', en: 'The restaurant will contact you to confirm', es: 'El restaurante te contactará para confirmar' },
}

function MenuContent({ params }: { params: { subdomain: string } }) {
  const searchParams = useSearchParams()
  const tableToken = searchParams.get('token') ?? ''

  const { lang, tCategory, tProduct } = useTranslation()
  const isRtl = lang === 'ar'

  // Helper: pick string for current lang
  function s(key: keyof typeof UI_STRINGS): string {
    const map = UI_STRINGS[key]
    return (map as Record<string, string>)[lang] ?? map.en
  }
  function rs(key: Exclude<keyof typeof RES_STRINGS, 'guestsUnit'>): string {
    const map = RES_STRINGS[key]
    return (map as Record<string, string>)[lang] ?? map.en
  }
  function guestsUnit(n: number): string {
    const fn = (RES_STRINGS.guestsUnit as Record<string, (n: number) => string>)[lang] ?? RES_STRINGS.guestsUnit.en
    return fn(n)
  }

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
  // In-app toast — replaces native alert() which blocks the page and reads as
  // a broken/cheap experience on a customer-facing menu.
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showToast(text: string, kind: 'success' | 'error' = 'error') {
    setToast({ text, kind })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }

  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})

  // ── Offline + LAN fallback ───────────────────────────────────────────────────
  const { conn, lanEndpoint, queuedOrders } = useOffline({
    localIp: menuData?.localIp ?? null,
  })
  const { smartPost } = useLocalRouter({ conn, lanEndpoint })

  // Step 1: fetch menu immediately — GPS check is soft (informational only, never blocks)
  useEffect(() => {
    if (!tableToken) {
      setMenuError(s('noToken'))
      setLoadingMenu(false)
      return
    }

    async function fetchMenu() {
      try {
        const res = await fetch(`/api/menu/public?tableToken=${tableToken}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setMenuError(body.error ?? s('loadFailed'))
          setLoadingMenu(false)
          return
        }
        const raw = await res.json()
        const data: MenuData = {
          cafeId:               raw.cafeId,
          tableId:              raw.tableId,
          marketType:           raw.marketType as MarketType | undefined,
          localIp:              raw.localIp ?? null,
          reservationsEnabled:  raw.reservationsEnabled ?? true,
          certificationStatus:  raw.certificationStatus ?? 'PENDING',
          cafe:                 { name: raw.cafeName, logoUrl: raw.cafeLogoUrl ?? null },
          categories:           raw.categories,
        }
        setMenuData(data)
      } catch {
        setMenuError(s('networkErr'))
      } finally {
        setLoadingMenu(false)
      }
    }

    fetchMenu()

    // GPS is optional — request in background for analytics only, never blocks menu
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsState('granted'),
        () => setGpsState('denied'),
        { timeout: 8000, maximumAge: 60000 }
      )
    } else {
      setGpsState('unavailable')
    }
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

  // QR session heartbeat — pings every 2 min so anti-fraud engine tracks active duration
  useEffect(() => {
    if (!tableToken) return
    const ping = () => {
      fetch('/api/v1/integrations/qr-heartbeat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tableToken }),
      }).catch(() => null) // fire-and-forget, never block UI
    }
    ping() // immediate first ping on mount
    const id = setInterval(ping, 2 * 60 * 1000) // every 2 minutes
    return () => clearInterval(id)
  }, [tableToken])

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
        showToast(s('orderFailed'))
        return
      }

      setOrderSent(true)
      setCart({})
      setDrawerOpen(false)

      // Mark this session as "has placed an order" for anti-fraud tracking
      fetch('/api/v1/integrations/qr-heartbeat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tableToken, hasOrder: true }),
      }).catch(() => null)

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
      showToast(s('networkErr'))
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
        showToast(d.error || s('resFailed'))
      }
    } catch {
      showToast(s('networkErr'))
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
      showToast(s('billSent'), 'success')
    } catch {
      showToast(s('billFailed'))
    }
  }

  // Loading / error states
  if (loadingMenu) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{s('loading')}</p>
      </div>
    )
  }

  if (menuError || !menuData) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50 text-center">
        <Bell className="w-12 h-12 text-red-400" />
        <p className="text-red-600 font-medium">{menuError ?? s('unexpectedErr')}</p>
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

      {/* ── Action toast — order/reservation/bill success or failure ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] text-center text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg ${
              toast.kind === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

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

        {/* Certified badge — only visible when restaurant is certified */}
        <CertifiedBadge
          certified={menuData?.certificationStatus === 'CERTIFIED'}
          lang={lang as 'ar' | 'fr' | 'en'}
        />

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

        {/* SmartMenu attribution */}
        <div className="text-center py-4 text-xs text-gray-400/50 select-none">
          Powered by <span className="font-semibold">SmartMenu</span>
        </div>

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
        {!orderSent && totalQty === 0 && menuData?.reservationsEnabled !== false && (
          <button
            onClick={() => setResOpen(true)}
            className="fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-full shadow-xl transition-all"
          >
            📅 {{ ar: 'حجز طاولة', fr: 'Réserver une table', en: 'Book a table', es: 'Reservar mesa' }[lang] ?? 'Book a table'}
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
                    <p className="font-bold text-lg text-gray-800">{rs('sentTitle')}</p>
                    <p className="text-sm text-gray-500">{rs('sentSub')}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-gray-900">{rs('title')}</h3>
                      <button onClick={() => setResOpen(false)} className="w-10 h-10 -m-1.5 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{rs('name')}</label>
                        <input
                          type="text" placeholder={rs('namePh')}
                          value={resForm.name}
                          onChange={e => setResForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{rs('phone')}</label>
                        <input
                          type="tel" placeholder="06XXXXXXXX"
                          value={resForm.phone}
                          onChange={e => setResForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">{rs('guests')}</label>
                          <select
                            value={resForm.guests}
                            onChange={e => setResForm(f => ({ ...f, guests: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                          >
                            {[1,2,3,4,5,6,7,8,10,12,15,20].map(n => (
                              <option key={n} value={n}>{n} {guestsUnit(n)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">{rs('date')}</label>
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
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{rs('notes')}</label>
                        <textarea
                          placeholder={rs('notesPh')}
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
                      {resSending ? rs('sending') : rs('confirm')}
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
