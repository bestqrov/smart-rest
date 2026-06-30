'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Save, Send,
  Package, Search, Copy, RefreshCw, ChevronRight,
} from 'lucide-react'
import { useLang } from '../../../lang-context'

interface CartItem {
  productId: string; name: string; sku: string
  quantity: number; unitPrice: number; total: number
  image?: string
}

interface SearchProduct {
  id: string; name: string; sku: string; images: string[]
  pricing?: { basePrice: number; promotionalPrice?: number; discount?: number; currency: string }
}

interface PastOrder {
  id: string; orderNumber: string; status: string; total: number; createdAt: string
  items?: Array<{ productId: string; name: string; sku: string; unitPrice: number; quantity: number }>
}

const T = {
  ar: {
    title: 'طلب شراء جديد', back: 'رجوع', search: 'ابحث عن منتج للإضافة...',
    addItem: 'إضافة', qty: 'الكمية', price: 'السعر الوحدوي', total: 'الإجمالي',
    subtotal: 'المجموع', notes: 'ملاحظات للمورد (اختياري)',
    saveDraft: 'حفظ مسودة', submit: 'إرسال الطلب', submitting: 'جاري الإرسال...',
    empty: 'الطلب فارغ', emptyHint: 'ابحث عن منتج وأضفه للطلب',
    currency: 'د.م.', confirmSubmit: 'هل تريد إرسال هذا الطلب للمراجعة؟',
    duplicate: 'تكرار طلب سابق', selectOrder: 'اختر طلباً سابقاً للتكرار',
    loadingOrders: 'جاري تحميل الطلبات السابقة...', noOrders: 'لا توجد طلبات سابقة',
    duplicateBtn: 'تكرار', cancel: 'إلغاء',
    itemAdded: 'تم الإضافة', productSearch: 'نتائج البحث',
  },
  en: {
    title: 'New Purchase Order', back: 'Back', search: 'Search for a product to add...',
    addItem: 'Add', qty: 'Qty', price: 'Unit Price', total: 'Total',
    subtotal: 'Subtotal', notes: 'Notes for supplier (optional)',
    saveDraft: 'Save Draft', submit: 'Submit Order', submitting: 'Submitting...',
    empty: 'Order is empty', emptyHint: 'Search for a product and add it to the order',
    currency: 'MAD', confirmSubmit: 'Submit this order for review?',
    duplicate: 'Duplicate Previous Order', selectOrder: 'Select a previous order to duplicate',
    loadingOrders: 'Loading previous orders...', noOrders: 'No previous orders found',
    duplicateBtn: 'Duplicate', cancel: 'Cancel',
    itemAdded: 'Added', productSearch: 'Search Results',
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, 'Content-Type': 'application/json' } }

function effectivePrice(p?: SearchProduct['pricing']): number {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return (p as any).basePrice * (1 - p.discount / 100)
  return (p as any).basePrice
}

function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default function NewOrderPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cart,        setCart]        = useState<CartItem[]>([])
  const [notes,       setNotes]       = useState('')
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<SearchProduct[]>([])
  const [searching,   setSearching]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [showDup,     setShowDup]     = useState(false)
  const [pastOrders,  setPastOrders]  = useState<PastOrder[]>([])
  const [loadingPast, setLoadingPast] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // Pre-load products from URL params (from catalog or bundle page)
  useEffect(() => {
    const productIds = searchParams.getAll('productId')
    if (productIds.length === 0) return
    const h = authHeader()
    Promise.all(
      productIds.map(pid =>
        fetch(`/api/restaurant/marketplace/catalog/${pid}`, { headers: h })
          .then(r => r.json())
          .then(d => d.product as SearchProduct | null)
          .catch(() => null)
      )
    ).then(products => {
      const items: CartItem[] = (products.filter(Boolean) as SearchProduct[]).map(p => ({
        productId: p.id,
        name:      p.name,
        sku:       p.sku,
        quantity:  1,
        unitPrice: effectivePrice(p.pricing),
        total:     effectivePrice(p.pricing),
        image:     p.images[0],
      }))
      setCart(items)
    }).catch(() => {})
  }, [])

  // Search debounced
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`/api/restaurant/marketplace/catalog?q=${encodeURIComponent(query)}&limit=8`, { headers: authHeader() })
        const data = await res.json()
        setResults(data.products ?? [])
      } catch {}
      setSearching(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Duplicate modal — load past orders
  const openDuplicate = async () => {
    setShowDup(true)
    if (pastOrders.length > 0) return
    setLoadingPast(true)
    try {
      const res  = await fetch('/api/restaurant/marketplace/orders?status=FULFILLED&limit=10', { headers: authHeader() })
      const data = await res.json()
      setPastOrders(data.orders ?? [])
    } catch {}
    setLoadingPast(false)
  }

  const duplicateOrder = async (order: PastOrder) => {
    setShowDup(false)
    // Fetch order detail if items aren't loaded
    let items = order.items
    if (!items) {
      try {
        const res  = await fetch(`/api/restaurant/marketplace/orders/${order.id}`, { headers: authHeader() })
        const data = await res.json()
        items = data.order?.items ?? []
      } catch { items = [] }
    }
    if (!items || items.length === 0) { showToast(lang === 'ar' ? 'لا توجد منتجات في هذا الطلب' : 'No items found'); return }

    // Load product details to get current prices
    const h = authHeader()
    const products = await Promise.all(
      items.map((item: any) =>
        fetch(`/api/restaurant/marketplace/catalog/${item.productId}`, { headers: h })
          .then(r => r.json()).then(d => d.product as SearchProduct | null).catch(() => null)
      )
    )

    const newCart: CartItem[] = items.map((item: any, i: number) => {
      const p = products[i]
      const up = p ? effectivePrice(p.pricing) : item.unitPrice
      return {
        productId: item.productId,
        name:      item.name,
        sku:       item.sku,
        quantity:  item.quantity,
        unitPrice: up,
        total:     up * item.quantity,
        image:     p?.images[0],
      }
    })
    setCart(newCart)
    showToast(lang === 'ar' ? 'تم تكرار الطلب' : 'Order duplicated')
  }

  const addToCart = (p: SearchProduct) => {
    const ep = effectivePrice(p.pricing)
    setCart(prev => {
      const existing = prev.find(i => i.productId === p.id)
      if (existing) {
        return prev.map(i => i.productId === p.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i)
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, quantity: 1, unitPrice: ep, total: ep, image: p.images[0] }]
    })
    showToast(t.itemAdded)
    setQuery(''); setResults([])
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty, total: qty * i.unitPrice } : i))
  }

  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId))

  const subtotal = cart.reduce((s, i) => s + i.total, 0)

  const createOrder = async (submit: boolean) => {
    if (cart.length === 0) { showToast(lang === 'ar' ? 'الطلب فارغ' : 'Order is empty'); return }
    if (submit && !confirm(t.confirmSubmit)) return

    setSubmitting(true)
    try {
      const h = authHeader()
      // 1. Create order
      const orderRes  = await fetch('/api/restaurant/marketplace/orders', {
        method: 'POST',
        headers: h,
        body:   JSON.stringify({ notes }),
      })
      const orderData = await orderRes.json()
      const orderId   = orderData.order?.id
      if (!orderId) throw new Error('Order creation failed')

      // 2. Add items
      await fetch(`/api/restaurant/marketplace/orders/${orderId}/items`, {
        method: 'POST',
        headers: h,
        body:   JSON.stringify({ items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) }),
      })

      // 3. Submit if requested
      if (submit) {
        await fetch(`/api/restaurant/marketplace/orders/${orderId}/submit`, { method: 'POST', headers: h })
      }

      router.push(`/admin/marketplace/orders/${orderId}`)
    } catch (err: any) {
      showToast(lang === 'ar' ? 'حدث خطأ، حاول مجدداً' : 'An error occurred, please try again')
    }
    setSubmitting(false)
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/marketplace/orders"
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors">
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{t.title}</h1>
            <p className="text-xs text-gray-400">{cart.length} {lang === 'ar' ? 'منتج' : 'items'}</p>
          </div>
        </div>
        <button onClick={openDuplicate}
          className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors">
          <Copy className="w-4 h-4" />
          {t.duplicate}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: Search + Cart ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t.search}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl ps-10 pe-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            {searching && <RefreshCw className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
          </div>

          {/* Search results dropdown */}
          {results.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
              <p className="text-xs text-gray-500 px-4 py-2 border-b border-gray-800">{t.productSearch} ({results.length})</p>
              {results.map(p => {
                const ep = effectivePrice(p.pricing)
                return (
                  <div key={p.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                      {p.images[0]
                        ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.sku}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-200 shrink-0">{fmt(ep, t.currency)}</span>
                    <button onClick={() => addToCart(p)}
                      className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0">
                      <Plus className="w-3 h-3" /> {t.addItem}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-2xl">
              <ShoppingCart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{t.empty}</p>
              <p className="text-gray-600 text-xs mt-1">{t.emptyHint}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.productId}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors">
                  {/* Thumb */}
                  <div className="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.sku} · {fmt(item.unitPrice, t.currency)}</p>
                  </div>
                  {/* Qty stepper */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.productId, item.quantity - 1)}
                      className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-gray-300 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm text-white font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, item.quantity + 1)}
                      className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-gray-300 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Total */}
                  <span className="text-sm font-bold text-white w-24 text-end shrink-0">{fmt(item.total, t.currency)}</span>
                  {/* Remove */}
                  <button onClick={() => removeItem(item.productId)}
                    className="text-red-500 hover:text-red-400 p-1 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{t.notes}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none" />
          </div>
        </div>

        {/* ── Right: Order Summary ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sticky top-20">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">{t.subtotal}</h2>

            {/* Line items summary */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {cart.map(i => (
                <div key={i.productId} className="flex justify-between text-xs text-gray-400">
                  <span className="truncate me-2">{i.name} ×{i.quantity}</span>
                  <span className="shrink-0">{fmt(i.total, t.currency)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-700 pt-3 mb-5">
              <div className="flex justify-between text-base font-bold text-white">
                <span>{t.subtotal}</span>
                <span>{fmt(subtotal, t.currency)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={() => createOrder(true)} disabled={submitting || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? t.submitting : t.submit}
              </button>
              <button onClick={() => createOrder(false)} disabled={submitting || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 text-gray-300 py-3 rounded-xl text-sm transition-colors">
                <Save className="w-4 h-4" />
                {t.saveDraft}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Duplicate Order Modal ─────────────────────────────────────────────── */}
      {showDup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowDup(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">{t.duplicate}</h3>
              <button onClick={() => setShowDup(false)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              <p className="text-xs text-gray-400 mb-3">{t.selectOrder}</p>
              {loadingPast ? (
                <p className="text-sm text-gray-500 text-center py-6">{t.loadingOrders}</p>
              ) : pastOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">{t.noOrders}</p>
              ) : (
                <div className="space-y-2">
                  {pastOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between bg-gray-800 rounded-xl p-3 hover:bg-gray-750 border border-gray-700">
                      <div>
                        <p className="text-sm text-gray-200 font-medium">{o.orderNumber}</p>
                        <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB')} · {fmt(o.total, t.currency)}</p>
                      </div>
                      <button onClick={() => duplicateOrder(o)}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                        {t.duplicateBtn}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-emerald-700 text-white text-sm px-5 py-3 rounded-full shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
