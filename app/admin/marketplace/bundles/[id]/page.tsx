'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Layers, Package, ChevronLeft, ChevronRight, ShoppingCart,
  Tag, CheckCircle, AlertCircle, XCircle, RefreshCw,
} from 'lucide-react'
import { useLang } from '../../../lang-context'

interface Product {
  id: string; name: string; sku: string; type: string; images: string[]
  pricing?: { basePrice: number; discount?: number; promotionalPrice?: number; currency: string }
  inventory?: { available: number; isLowStock?: boolean }
}

interface Bundle {
  id: string; name: string; slug: string; description: string; type: string
  bundlePrice: number; currency: string; savings: number
  productIds: string[]; active: boolean
}

const T = {
  ar: {
    back: 'الباقات', title: 'تفاصيل الباقة',
    bundlePrice: 'سعر الباقة', savings: 'وفّر', products: 'المنتجات المضمّنة',
    orderBundle: 'اطلب هذه الباقة', currency: 'د.م.',
    noProduct: 'منتج غير متاح', loading: 'جاري التحميل...', notFound: 'الباقة غير موجودة',
    inStock: 'متاح', lowStock: 'منخفض', outOfStock: 'نفد',
    vsIndividual: 'السعر الأصلي', totalSaved: 'إجمالي الوفر',
    TYPE: { STARTER:'باقة بداية', PROFESSIONAL:'احترافية', PREMIUM:'بريميوم', CUSTOM:'مخصصة' } as Record<string,string>,
  },
  en: {
    back: 'Bundles', title: 'Bundle Details',
    bundlePrice: 'Bundle Price', savings: 'You Save', products: 'Included Products',
    orderBundle: 'Order This Bundle', currency: 'MAD',
    noProduct: 'Product unavailable', loading: 'Loading...', notFound: 'Bundle not found',
    inStock: 'In stock', lowStock: 'Low stock', outOfStock: 'Out of stock',
    vsIndividual: 'Individual price', totalSaved: 'Total Savings',
    TYPE: { STARTER:'Starter', PROFESSIONAL:'Professional', PREMIUM:'Premium', CUSTOM:'Custom' } as Record<string,string>,
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }
function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function effectivePrice(p?: Product['pricing']) {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return (p as any).basePrice
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export default function BundleDetailPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [bundle,   setBundle]   = useState<Bundle | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const h = authHeader()

    fetch('/api/restaurant/marketplace/bundles', { headers: h })
      .then(r => r.json())
      .then(async data => {
        const b: Bundle | undefined = (data.bundles ?? []).find((x: Bundle) => x.id === id)
        if (!b) { setLoading(false); return }
        setBundle(b)

        // Track bundle view
        fetch(`/api/restaurant/marketplace/bundles/${id}/view`, { method: 'POST', headers: h }).catch(() => {})

        // Load individual products
        const items = await Promise.all(
          b.productIds.map(pid =>
            fetch(`/api/restaurant/marketplace/catalog/${pid}`, { headers: h })
              .then(r => r.json())
              .then(d => d.product as Product | null)
              .catch(() => null)
          )
        )
        setProducts(items.filter(Boolean) as Product[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleOrderBundle = () => {
    if (!bundle) return
    // Navigate to order builder with all products pre-listed
    const qs = bundle.productIds.map(pid => `productId=${pid}`).join('&')
    router.push(`/admin/marketplace/orders/new?${qs}&bundleId=${id}`)
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-6 w-24 mb-6" />
        <Skeleton className="h-40 mb-6" />
        <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="text-center py-16">
        <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">{t.notFound}</p>
        <Link href="/admin/marketplace/bundles" className="mt-4 inline-block text-emerald-400 text-sm">{t.back}</Link>
      </div>
    )
  }

  const individualTotal = products.reduce((sum, p) => sum + effectivePrice(p.pricing), 0)

  return (
    <div>
      {/* Back */}
      <Link href="/admin/marketplace/bundles"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm mb-6 transition-colors">
        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {t.back}
      </Link>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-950/60 via-gray-900 to-gray-900 border border-emerald-800/30 rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              {t.TYPE[bundle.type] ?? bundle.type}
            </span>
            <h1 className="text-2xl font-bold text-white mt-1 mb-3">{bundle.name}</h1>
            <p className="text-gray-400 text-sm leading-relaxed">{bundle.description}</p>

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-1.5">
                <Package className="w-3.5 h-3.5" />
                {bundle.productIds.length} {lang === 'ar' ? 'منتج' : 'products'}
              </div>
              {bundle.savings > 0 && (
                <div className="flex items-center gap-1.5 text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 rounded-lg px-3 py-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {t.savings}: {fmt(bundle.savings, t.currency)}
                </div>
              )}
            </div>
          </div>

          {/* Pricing card */}
          <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-5 min-w-56 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t.vsIndividual}</p>
              <p className="text-sm text-gray-400 line-through">{fmt(individualTotal, t.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{t.bundlePrice}</p>
              <p className="text-2xl font-bold text-emerald-400">{fmt(bundle.bundlePrice, t.currency)}</p>
            </div>
            {bundle.savings > 0 && (
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-300">{t.totalSaved}: <span className="font-bold">{fmt(bundle.savings, t.currency)}</span></p>
              </div>
            )}
            <button onClick={handleOrderBundle}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              <ShoppingCart className="w-4 h-4" />
              {t.orderBundle}
            </button>
          </div>
        </div>
      </div>

      {/* ── Included Products ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">{t.products}</h2>
        <div className="space-y-3">
          {bundle.productIds.map((pid, index) => {
            const p = products.find(x => x.id === pid)
            const ep = p ? effectivePrice(p.pricing) : 0
            return (
              <div key={pid}
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                {/* Index */}
                <div className="w-7 h-7 bg-emerald-900/40 border border-emerald-800/50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-emerald-400">{index + 1}</span>
                </div>

                {/* Thumb */}
                <div className="w-14 h-14 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                  {p?.images[0]
                    ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-600" /></div>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {p ? (
                    <>
                      <p className="text-xs text-emerald-400 uppercase mb-0.5">{p.type}</p>
                      <Link href={`/admin/marketplace/products/${p.id}`}
                        className="text-sm font-medium text-gray-100 hover:text-emerald-400 truncate block transition-colors">
                        {p.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">SKU: {p.sku}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{t.noProduct}</p>
                  )}
                </div>

                {/* Stock */}
                {p?.inventory && (
                  <div className="shrink-0">
                    {p.inventory.available <= 0
                      ? <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />{t.outOfStock}</span>
                      : p.inventory.isLowStock
                        ? <span className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t.lowStock}</span>
                        : <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t.inStock}</span>}
                  </div>
                )}

                {/* Price */}
                {p && (
                  <div className="text-end shrink-0">
                    <p className="text-sm font-bold text-white">{fmt(ep, t.currency)}</p>
                    {p.pricing?.basePrice && ep < p.pricing.basePrice && (
                      <p className="text-xs line-through text-gray-500">{fmt(p.pricing.basePrice, t.currency)}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
