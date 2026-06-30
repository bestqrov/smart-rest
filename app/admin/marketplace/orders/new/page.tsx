'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Save, Send, Package, RefreshCw } from 'lucide-react'
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

const T = {
  ar: {
    title: 'طلب شراء جديد', back: 'رجوع', search: 'ابحث عن منتج للإضافة...',
    addItem: 'إضافة', qty: 'الكمية', price: 'السعر', total: 'الإجمالي',
    subtotal: 'المجموع الفرعي', notes: 'ملاحظات للمورد',
    saveDraft: 'حفظ كمسودة', submit: 'إرسال الطلب', submitting: 'جاري الإرسال...',
    empty: 'لا توجد منتجات في الطلب', emptyHint: 'ابحث عن منتج وأضفه',
    currency: 'د.م.', confirmSubmit: 'هل تريد إرسال هذا الطلب للمراجعة؟',
    success: 'تم إرسال الطلب بنجاح', draft: 'تم حفظ المسودة',
  },
  en: {
    title: 'New Purchase Order', back: 'Back', search: 'Search for a product to add...',
    addItem: 'Add', qty: 'Qty', price: 'Price', total: 'Total',
    subtotal: 'Subtotal', notes: 'Notes for supplier',
    saveDraft: 'Save Draft', submit: 'Submit Order', submitting: 'Submitting...',
    empty: 'No products in order', emptyHint: 'Search for a product to add',
    currency: 'MAD', confirmSubmit: 'Submit this order for review?',
    success: 'Order submitted successfully', draft: 'Draft saved',
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

function effectivePrice(p?: SearchProduct['pricing']): number {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

export default function NewOrderPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const params = useSearchParams()
  const router = useRouter()

  const [items, setItems]       = useState<CartItem[]>([])
  const [notes, setNotes]       = useState('')
  const [search, setSearch]     = useState('')
  const [results, setResults]   = useState<SearchProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage]   = useState('')
  const [orderId, setOrderId]   = useState<string | null>(null)

  // Pre-load product from query param
  useEffect(() => {
    const pid = params.get('productId')
    if (!pid) return
    fetch(`/api/restaurant/marketplace/catalog/${pid}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        const p = d.product
        if (!p) return
        addProduct(p)
      })
  }, [])

  function addProduct(p: any) {
    const price = effectivePrice(p.pricing)
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id)
      if (existing) {
        return prev.map(i => i.productId === p.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i)
      }
      return [...prev, {
        productId: p.id, name: p.name, sku: p.sku,
        quantity: 1, unitPrice: price, total: price,
        image: p.images?.[0],
      }]
    })
    setResults([])
    setSearch('')
  }

  async function doSearch(q: string) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/restaurant/marketplace/catalog?search=${encodeURIComponent(q)}&limit=5`, { headers: authHeader() })
      const json = await res.json()
      setResults(json.products ?? [])
    } finally { setSearching(false) }
  }

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { removeItem(productId); return }
    setItems(prev => prev.map(i => i.productId === productId
      ? { ...i, quantity: qty, total: qty * i.unitPrice } : i))
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0)

  async function createOrGetOrder(): Promise<string> {
    if (orderId) return orderId
    const res  = await fetch('/api/restaurant/marketplace/orders', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'RESTAURANT', notes }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    const oid  = json.order.id
    setOrderId(oid)
    return oid
  }

  async function saveDraft() {
    if (items.length === 0) return
    setSubmitting(true)
    try {
      const oid = await createOrGetOrder()
      for (const item of items) {
        await fetch(`/api/restaurant/marketplace/orders/${oid}/items`, {
          method: 'POST',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }),
        })
      }
      setMessage(t.draft)
      setTimeout(() => router.push(`/admin/marketplace/orders/${oid}`), 1200)
    } catch (err: any) { setMessage(err.message) } finally { setSubmitting(false) }
  }

  async function submitOrder() {
    if (items.length === 0 || !confirm(t.confirmSubmit)) return
    setSubmitting(true)
    try {
      const oid = await createOrGetOrder()
      for (const item of items) {
        await fetch(`/api/restaurant/marketplace/orders/${oid}/items`, {
          method: 'POST',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }),
        })
      }
      const res = await fetch(`/api/restaurant/marketplace/orders/${oid}/submit`, {
        method: 'POST', headers: authHeader(),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setMessage(t.success)
      setTimeout(() => router.push(`/admin/marketplace/orders/${oid}`), 1200)
    } catch (err: any) { setMessage(err.message) } finally { setSubmitting(false) }
  }

  const currency = t.currency

  return (
    <div className="min-h-full p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/marketplace" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />{t.title}
        </h1>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{message}</div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {/* Left: product search + items */}
        <div className="md:col-span-2 space-y-4">
          {/* Product search */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t.search}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400" />
              {searching && <RefreshCw className="absolute end-3 top-3.5 w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {results.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {results.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-xl text-start">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                        : <Package className="w-5 h-5 text-gray-300 mx-auto mt-2.5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.sku}</p>
                    </div>
                    {effectivePrice(p.pricing) > 0 && (
                      <span className="text-sm font-bold text-emerald-600 shrink-0">
                        {effectivePrice(p.pricing).toFixed(2)} {currency}
                      </span>
                    )}
                    <Plus className="w-4 h-4 text-emerald-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Order items */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t.empty}</p>
              <p className="text-sm mt-1">{t.emptyHint}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-400">
                    <th className="px-4 py-3 text-start">المنتج</th>
                    <th className="px-4 py-3 text-center w-28">{t.qty}</th>
                    <th className="px-4 py-3 text-end w-24">{t.total}</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr key={item.productId}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            {item.image
                              ? <img src={item.image} alt="" className="w-full h-full object-contain" />
                              : <Package className="w-4 h-4 text-gray-300 mx-auto mt-2.5" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.unitPrice.toFixed(2)} {currency}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setQty(item.productId, item.quantity - 1)}
                            className="p-1 bg-gray-100 rounded-lg hover:bg-gray-200">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button onClick={() => setQty(item.productId, item.quantity + 1)}
                            className="p-1 bg-gray-100 rounded-lg hover:bg-gray-200">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-bold text-gray-800">
                        {item.total.toFixed(2)} {currency}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeItem(item.productId)} className="p-1 text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <label className="text-xs text-gray-500 mb-1.5 block">{t.notes}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 resize-none" />
          </div>
        </div>

        {/* Right: summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-4">
            <h2 className="font-bold text-gray-800 mb-4">{t.subtotal}</h2>

            <div className="space-y-2 text-sm mb-5">
              {items.map(item => (
                <div key={item.productId} className="flex justify-between text-gray-600">
                  <span className="truncate flex-1 me-2">{item.name} ×{item.quantity}</span>
                  <span className="font-medium shrink-0">{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-gray-900">
              <span>{t.subtotal}</span>
              <span>{subtotal.toFixed(2)} {currency}</span>
            </div>

            <div className="mt-5 space-y-2">
              <button onClick={saveDraft} disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-40">
                <Save className="w-4 h-4" />{t.saveDraft}
              </button>
              <button onClick={submitOrder} disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
