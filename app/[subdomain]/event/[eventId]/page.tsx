'use client'

/**
 * Guest Event Page — SmartTraiteur
 *
 * URL:  /{subdomain}/event/{eventId}?guest={guestQrToken}
 * Flow: guest scans place card QR
 *       → POST /api/traiteur/events/:id/guest-scan { qrToken, deviceId }
 *       → receives sessionId + seatNumber + event info
 *       → renders event welcome + menu (reuses existing order flow)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CalendarDays, MapPin, Users, Loader2, AlertCircle, CheckCircle2, Utensils } from 'lucide-react'

type EventInfo = {
  id: string; name: string; type: string; date: string; venue: string; status: string
}

type ScanResult = {
  sessionId:  string
  seatNumber: number
  tableId:    string
  guestName:  string
  event:      EventInfo
  subdomain:  string
  isNew:      boolean
}

const TYPE_EMOJI: Record<string, string> = {
  WEDDING: '💍', CORPORATE: '🏢', BIRTHDAY: '🎂',
  REUNION: '☕', GALA: '🎭', OTHER: '🎪'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function getOrCreateDeviceId(): string {
  const KEY = 'sm_device_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export default function GuestEventPage() {
  const { subdomain, eventId } = useParams<{ subdomain: string; eventId: string }>()
  const searchParams = useSearchParams()
  const guestToken   = searchParams.get('guest')

  const [phase,  setPhase]  = useState<'scanning' | 'welcome' | 'menu' | 'error'>('scanning')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [errMsg, setErrMsg] = useState('')

  const scan = useCallback(async () => {
    if (!guestToken) { setErrMsg('رمز QR غير صالح'); setPhase('error'); return }

    const deviceId = getOrCreateDeviceId()

    // Check for existing session in localStorage
    const storedSession = localStorage.getItem(`sm_event_session_${eventId}`)
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as ScanResult
        if (parsed.sessionId) {
          // Validate the stored session
          const check = await fetch(
            `/api/qr/table-session/${parsed.sessionId}`
          )
          if (check.ok) {
            setResult(parsed)
            setPhase('welcome')
            return
          }
        }
      } catch {}
      localStorage.removeItem(`sm_event_session_${eventId}`)
    }

    const r = await fetch(`/api/traiteur/events/${eventId}/guest-scan`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ qrToken: guestToken, deviceId })
    })

    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      setErrMsg(body.error ?? 'فشل التحقق من بطاقتك')
      setPhase('error')
      return
    }

    const data: ScanResult = await r.json()
    localStorage.setItem(`sm_event_session_${eventId}`, JSON.stringify(data))
    localStorage.setItem('sm_session_id',  data.sessionId)
    localStorage.setItem('sm_seat_number', String(data.seatNumber))
    localStorage.setItem('sm_table_id',    data.tableId)

    setResult(data)
    setPhase('welcome')
  }, [guestToken, eventId])

  useEffect(() => { scan() }, [scan])

  // ── SCANNING ────────────────────────────────────────────────────────────────
  if (phase === 'scanning') return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 to-gray-950 flex items-center justify-center px-4">
      <div className="text-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-violet-400 mx-auto mb-4" />
        <p className="text-lg font-semibold">جارٍ التحقق من بطاقتك…</p>
        <p className="text-violet-300 text-sm mt-1">لحظة من فضلك</p>
      </div>
    </div>
  )

  // ── ERROR ───────────────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 to-gray-950 flex items-center justify-center px-4">
      <div className="text-center text-white max-w-sm">
        <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">تعذّر التحقق</h2>
        <p className="text-violet-300 text-sm">{errMsg}</p>
        <p className="text-gray-500 text-xs mt-3">يرجى التواصل مع المنظّم</p>
      </div>
    </div>
  )

  // ── WELCOME + MENU ──────────────────────────────────────────────────────────
  if (!result) return null

  const { event, guestName, seatNumber } = result
  const emoji = TYPE_EMOJI[event.type] ?? '🎪'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-gray-950 to-gray-900" dir="rtl">

      {/* Hero welcome card */}
      <div className="relative overflow-hidden">
        {/* bg glow */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(circle at 50% 0%, #7c3aed, transparent 60%)' }} />

        <div className="relative max-w-lg mx-auto px-4 pt-12 pb-8 text-center text-white">
          <div className="text-6xl mb-4">{emoji}</div>

          <div className="inline-flex items-center gap-2 bg-violet-800/50 border border-violet-600/40 text-violet-200 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" /> بطاقتك صالحة
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
            مرحباً {guestName}
          </h1>
          <p className="text-violet-200 text-base mb-5">
            تم حجز مقعدك بنجاح
          </p>

          {/* Seat badge */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-6 py-4 mb-6">
            <div className="text-center">
              <p className="text-violet-300 text-xs font-semibold uppercase tracking-wide">المقعد</p>
              <p className="text-4xl font-black text-white">{seatNumber}</p>
            </div>
          </div>

          {/* Event info */}
          <div className="bg-white/8 backdrop-blur border border-white/10 rounded-2xl p-4 text-right space-y-2">
            <h2 className="font-extrabold text-white text-base">{event.name}</h2>
            <div className="flex items-center gap-2 text-violet-200 text-xs">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>{fmtDate(event.date)}</span>
            </div>
            {event.venue && (
              <div className="flex items-center gap-2 text-violet-200 text-xs">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <div className="flex items-center gap-1.5 text-violet-300 text-xs font-semibold">
            <Utensils className="w-3.5 h-3.5" /> قائمة المأكولات
          </div>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      </div>

      {/* Menu — reuse existing menu via iframe / redirect to menu page with sessionId */}
      <div className="max-w-lg mx-auto px-4 pb-16">
        <MenuEmbed
          subdomain={subdomain}
          sessionId={result.sessionId}
          tableId={result.tableId}
          seatNumber={seatNumber}
        />
      </div>

    </div>
  )
}

// ─── MenuEmbed ─────────────────────────────────────────────────────────────────
// Lightweight inline menu loader — fetches categories + products
// and lets the guest place an order using their sessionId.

type Category = { id: string; nameAr: string; nameEn: string; nameFr: string; products: Product[] }
type Product  = { id: string; nameAr: string; nameEn: string; price: number; imageUrl: string | null; isAvailable: boolean }
type CartItem = { product: Product; qty: number }

function MenuEmbed({
  subdomain, sessionId, tableId, seatNumber
}: {
  subdomain: string; sessionId: string; tableId: string; seatNumber: number
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [placing,    setPlacing]    = useState(false)
  const [placed,     setPlaced]     = useState(false)
  const [orderError, setOrderError] = useState('')

  useEffect(() => {
    fetch(`/api/client/menu?subdomain=${subdomain}`)
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => { setCategories(d.categories ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [subdomain])

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.flatMap(i =>
      i.product.id === productId
        ? i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []
        : [i]
    ))
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true); setOrderError('')
    const r = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.qty }))
      })
    })
    if (r.ok) { setCart([]); setPlaced(true) }
    else {
      const body = await r.json().catch(() => ({}))
      setOrderError(body.error ?? 'فشل إرسال الطلب')
    }
    setPlacing(false)
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)

  if (loading) return (
    <div className="text-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
    </div>
  )

  if (placed) return (
    <div className="bg-emerald-900/40 border border-emerald-600/40 rounded-2xl p-8 text-center text-white">
      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
      <h3 className="text-lg font-bold mb-1">تم إرسال طلبك! 🎉</h3>
      <p className="text-emerald-300 text-sm">سيصل طلبك قريباً — استمتع بالحفلة</p>
      <button
        onClick={() => setPlaced(false)}
        className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 underline"
      >
        + طلب إضافي
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        cat.products.filter(p => p.isAvailable).length === 0 ? null : (
          <div key={cat.id}>
            <h3 className="text-violet-300 text-xs font-bold uppercase tracking-widest mb-2 px-1">
              {cat.nameAr || cat.nameEn}
            </h3>
            <div className="space-y-2">
              {cat.products.filter(p => p.isAvailable).map(p => {
                const inCart = cart.find(i => i.product.id === p.id)
                return (
                  <div key={p.id} className="bg-white/6 backdrop-blur border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.nameAr} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{p.nameAr || p.nameEn}</p>
                      <p className="text-violet-300 text-xs font-bold">{p.price.toLocaleString()}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => removeFromCart(p.id)} className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center font-bold transition-colors">−</button>
                        <span className="text-white font-bold w-4 text-center">{inCart.qty}</span>
                        <button onClick={() => addToCart(p)} className="w-7 h-7 bg-violet-600 hover:bg-violet-500 text-white rounded-full flex items-center justify-center font-bold transition-colors">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(p)} className="w-7 h-7 bg-violet-600 hover:bg-violet-500 text-white rounded-full flex items-center justify-center font-bold transition-colors shrink-0">+</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      ))}

      {/* Cart / Order */}
      {cart.length > 0 && (
        <div className="sticky bottom-4 bg-violet-900/95 backdrop-blur border border-violet-600/40 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="space-y-0.5">
              {cart.map(i => (
                <p key={i.product.id} className="text-xs text-violet-200">
                  {i.product.nameAr} ×{i.qty}
                </p>
              ))}
            </div>
            <span className="text-white font-extrabold text-base">{total.toLocaleString()}</span>
          </div>
          {orderError && <p className="text-red-400 text-xs mb-2">{orderError}</p>}
          <button
            onClick={placeOrder}
            disabled={placing}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-violet-900 font-extrabold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🎉'}
            {placing ? 'جارٍ الإرسال…' : 'تأكيد الطلب'}
          </button>
        </div>
      )}
    </div>
  )
}
