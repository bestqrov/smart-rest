'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Package, ChevronLeft, ChevronRight, ShoppingCart,
  CheckCircle, XCircle, AlertCircle, Layers, Truck, Star,
} from 'lucide-react'
import { useLang } from '../../../lang-context'

interface Product {
  id: string; name: string; sku: string; type: string; brand?: string
  description?: string; images: string[]
  tags: string[]; supportedModules: string[]
  metadata?: string
  pricing?: { basePrice: number; currency: string; discount?: number; promotionalPrice?: number }
  inventory?: { available: number; isLowStock?: boolean }
  supplier?: { id: string; name: string; contactEmail?: string; contactPhone?: string }
  category?: { name: string }
  isFeatured?: boolean
}

interface CompatResult {
  status: 'COMPATIBLE' | 'PARTIAL' | 'INCOMPATIBLE'
  score: number; reasons: string[]
}

interface Bundle {
  id: string; name: string; description: string
  bundlePrice: number; currency: string; savings: number; productIds: string[]
}

const T = {
  ar: {
    back: 'رجوع', addToOrder: 'أضف للطلب', currency: 'د.م.',
    description: 'الوصف', specs: 'المواصفات', modules: 'الوحدات المتوافقة',
    supplier: 'المورد', related: 'منتجات مشابهة', bundles: 'باقات تضم هذا المنتج',
    compat: 'توافق مع متجرك', compatScore: 'التوافق',
    inStock: 'متاح', lowStock: 'مخزون منخفض', outOfStock: 'نفد',
    units: 'وحدة', savings: 'وفّر',
    COMPAT: { COMPATIBLE:'متوافق', PARTIAL:'جزئي', INCOMPATIBLE:'غير متوافق' } as Record<string,string>,
    noDescription: 'لا يوجد وصف', loading: 'جاري التحميل...', notFound: 'المنتج غير موجود',
    email: 'البريد', phone: 'الهاتف', featured: 'مميز',
  },
  en: {
    back: 'Back', addToOrder: 'Add to Order', currency: 'MAD',
    description: 'Description', specs: 'Specifications', modules: 'Compatible Modules',
    supplier: 'Supplier', related: 'Related Products', bundles: 'Bundles Including This',
    compat: 'Compatibility', compatScore: 'Score',
    inStock: 'In Stock', lowStock: 'Low Stock', outOfStock: 'Out of Stock',
    units: 'units', savings: 'Save',
    COMPAT: { COMPATIBLE:'Compatible', PARTIAL:'Partial', INCOMPATIBLE:'Incompatible' } as Record<string,string>,
    noDescription: 'No description available', loading: 'Loading...', notFound: 'Product not found',
    email: 'Email', phone: 'Phone', featured: 'Featured',
  },
}

const COMPAT_STYLE: Record<string, string> = {
  COMPATIBLE:   'text-emerald-400 bg-emerald-900/30 border-emerald-700/50',
  PARTIAL:      'text-amber-400 bg-amber-900/30 border-amber-700/50',
  INCOMPATIBLE: 'text-red-400 bg-red-900/30 border-red-700/50',
}
const COMPAT_ICON: Record<string, any> = {
  COMPATIBLE: CheckCircle, PARTIAL: AlertCircle, INCOMPATIBLE: XCircle,
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }

function effectivePrice(p?: Product['pricing']) {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

function fmt(n: number, cur = 'د.م.') {
  return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export default function ProductDetailPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [product,  setProduct]  = useState<Product | null>(null)
  const [compat,   setCompat]   = useState<CompatResult | null>(null)
  const [related,  setRelated]  = useState<Product[]>([])
  const [bundles,  setBundles]  = useState<Bundle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [imgIndex, setImgIndex] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const h = authHeader()
    Promise.all([
      fetch(`/api/restaurant/marketplace/catalog/${id}`, { headers: h }),
      fetch(`/api/restaurant/marketplace/compatibility/${id}`, { headers: h }),
      fetch('/api/restaurant/marketplace/bundles', { headers: h }),
    ]).then(async ([pRes, cRes, bRes]) => {
      const pData = await pRes.json()
      const cData = await cRes.json()
      const bData = await bRes.json()
      setProduct(pData.product ?? null)
      setRelated(pData.related ?? [])
      setCompat(cData.compatibility ?? null)
      const all: Bundle[] = bData.bundles ?? []
      setBundles(all.filter(b => b.productIds.includes(id)).slice(0, 3))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="grid lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-12" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">{t.notFound}</p>
        <Link href="/admin/marketplace/catalog" className="mt-4 inline-block text-emerald-400 text-sm hover:text-emerald-300">{t.back}</Link>
      </div>
    )
  }

  const ep       = effectivePrice(product.pricing)
  const hasDisc  = product.pricing?.discount || product.pricing?.promotionalPrice
  const images   = product.images.length > 0 ? product.images : []
  const CompatIcon = compat ? (COMPAT_ICON[compat.status] ?? AlertCircle) : null

  let specs: Record<string, string> = {}
  try { specs = JSON.parse(product.metadata ?? '{}').specs ?? {} } catch {}

  return (
    <div>
      <Link href="/admin/marketplace/catalog"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm mb-6 transition-colors">
        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {t.back}
      </Link>

      {/* ── Main grid ──────────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative mb-3">
            {images.length > 0
              ? <img src={images[imgIndex]} alt={product.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              : <div className="w-full h-full flex items-center justify-center"><Package className="w-20 h-20 text-gray-700" /></div>}
            {hasDisc && (
              <span className="absolute top-4 start-4 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                {product.pricing?.discount ? `-${product.pricing.discount}%` : lang === 'ar' ? 'عرض' : 'SALE'}
              </span>
            )}
            {product.isFeatured && (
              <span className="absolute top-4 end-4 bg-yellow-600/80 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                <Star className="w-3 h-3 fill-white" /> {t.featured}
              </span>
            )}
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                  className="absolute start-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center">
                  {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => setImgIndex(i => (i + 1) % images.length)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center">
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImgIndex(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === imgIndex ? 'border-emerald-500' : 'border-gray-700 hover:border-gray-500'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          {product.category && <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">{product.category.name}</p>}
          <h1 className="text-2xl font-bold text-white leading-snug">{product.name}</h1>
          {product.brand && <p className="text-sm text-gray-400">{product.brand} · <span className="text-gray-500">SKU: {product.sku}</span></p>}

          {/* Price */}
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-emerald-400">{fmt(ep, t.currency)}</span>
            {hasDisc && product.pricing?.basePrice && (
              <span className="text-lg line-through text-gray-500 mb-0.5">{fmt(product.pricing.basePrice, t.currency)}</span>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            {!product.inventory || product.inventory.available <= 0
              ? <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm text-red-400">{t.outOfStock}</span></>
              : product.inventory.isLowStock
                ? <><AlertCircle className="w-4 h-4 text-amber-400" /><span className="text-sm text-amber-400">{t.lowStock} ({product.inventory.available} {t.units})</span></>
                : <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-sm text-emerald-400">{t.inStock} ({product.inventory.available} {t.units})</span></>}
          </div>

          {/* Compatibility */}
          {compat && CompatIcon && (
            <div className={`border rounded-xl p-3 ${COMPAT_STYLE[compat.status]}`}>
              <div className="flex items-center gap-2 mb-2">
                <CompatIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">{t.compat}: {t.COMPAT[compat.status]}</span>
                <span className="ms-auto text-xs opacity-70">{t.compatScore}: {compat.score}%</span>
              </div>
              {compat.reasons.length > 0 && (
                <ul className="space-y-0.5">
                  {compat.reasons.slice(0, 3).map((r, i) => <li key={i} className="text-xs opacity-80">• {r}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => router.push(`/admin/marketplace/orders/new?productId=${id}`)}
            disabled={!product.inventory || product.inventory.available <= 0}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-colors">
            <ShoppingCart className="w-4 h-4" />
            {t.addToOrder}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <Truck className="w-4 h-4 shrink-0" />
            <span>{lang === 'ar' ? 'الشحن والتوصيل: قريباً' : 'Shipping & delivery: coming soon'}</span>
          </div>

          {/* Supplier */}
          {product.supplier && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">{t.supplier}</p>
              <p className="text-sm text-gray-200 font-medium">{product.supplier.name}</p>
              {product.supplier.contactEmail && <p className="text-xs text-gray-500 mt-1">{t.email}: {product.supplier.contactEmail}</p>}
              {product.supplier.contactPhone && <p className="text-xs text-gray-500">{t.phone}: {product.supplier.contactPhone}</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Description + Specs + Modules ────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t.description}</h3>
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{product.description || t.noDescription}</p>
        </div>
        <div className="space-y-4">
          {Object.keys(specs).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">{t.specs}</h3>
              <dl className="space-y-2">
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-xs text-gray-500">{k}</dt>
                    <dd className="text-xs text-gray-200 text-end">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {product.supportedModules.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">{t.modules}</h3>
              <div className="flex flex-wrap gap-1.5">
                {product.supportedModules.map(m => (
                  <span key={m} className="text-xs bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map(tag => <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">#{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Bundles including this product ───────────────────────────────────── */}
      {bundles.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">{t.bundles}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {bundles.map(b => (
              <Link key={b.id} href={`/admin/marketplace/bundles/${b.id}`}
                className="bg-gray-900 border border-emerald-900/30 hover:border-emerald-700/50 rounded-xl p-4 transition-all">
                <h4 className="text-sm font-semibold text-white mb-1">{b.name}</h4>
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{b.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-emerald-400">{fmt(b.bundlePrice, t.currency)}</p>
                    {b.savings > 0 && <p className="text-xs text-gray-500">{t.savings} {fmt(b.savings, t.currency)}</p>}
                  </div>
                  <span className="text-xs text-emerald-400">{lang === 'ar' ? 'تفاصيل ←' : 'Details →'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Related ──────────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">{t.related}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.slice(0, 4).map(rp => (
              <Link key={rp.id} href={`/admin/marketplace/products/${rp.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all group">
                <div className="aspect-video bg-gray-800 overflow-hidden">
                  {rp.images[0]
                    ? <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-600" /></div>}
                </div>
                <div className="p-3">
                  <p className="text-xs text-emerald-400 mb-0.5 uppercase">{rp.type}</p>
                  <h4 className="text-xs text-gray-200 font-medium line-clamp-2">{rp.name}</h4>
                  <p className="text-sm font-bold text-white mt-1">{fmt(effectivePrice(rp.pricing), t.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
