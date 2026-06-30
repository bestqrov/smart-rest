'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, Star, ShoppingCart, CheckCircle, AlertTriangle,
  RefreshCw, Tag, Layers, Truck
} from 'lucide-react'
import { useLang } from '../../../lang-context'

interface Supplier { id: string; company: string; email: string; country: string; rating: number }
interface Pricing { basePrice: number; currency: string; discount?: number; promotionalPrice?: number; taxRate?: number }
interface Inventory { stock: number; reserved: number; available: number; isLow: boolean; lowStockThreshold: number }
interface Compatibility { status: 'COMPATIBLE' | 'PARTIAL' | 'INCOMPATIBLE'; score: number; reasons: string[] }
interface Product {
  id: string; name: string; sku: string; description: string; type: string; brand?: string
  status: string; images: string[]; tags: string[]; supportedModules: string[]
  categoryId: string; supplierId?: string
  pricing?: Pricing; inventory?: Inventory; supplier?: Supplier
}
interface Related { id: string; name: string; images: string[]; pricing?: Pricing }

const T = {
  ar: {
    back: 'رجوع', addToOrder: 'أضف للطلب', inStock: 'متاح في المخزون',
    outOfStock: 'نفد المخزون', lowStock: 'مخزون منخفض',
    available: 'المتاح', reserved: 'محجوز', total: 'الإجمالي',
    description: 'الوصف', specs: 'المواصفات', modules: 'الوحدات المدعومة',
    supplier: 'المورد', compatibility: 'التوافق', related: 'منتجات مشابهة',
    type: 'النوع', sku: 'الرمز', brand: 'العلامة', tags: 'الوسوم',
    loading: 'جاري التحميل...', notFound: 'المنتج غير موجود',
    compatible: 'متوافق', partial: 'متوافق جزئياً', incompatible: 'غير متوافق',
    price: 'السعر', originalPrice: 'السعر الأصلي', saving: 'وفر',
    currency: 'د.م.',
  },
  en: {
    back: 'Back', addToOrder: 'Add to Order', inStock: 'In Stock',
    outOfStock: 'Out of Stock', lowStock: 'Low Stock',
    available: 'Available', reserved: 'Reserved', total: 'Total',
    description: 'Description', specs: 'Specifications', modules: 'Supported Modules',
    supplier: 'Supplier', compatibility: 'Compatibility', related: 'Related Products',
    type: 'Type', sku: 'SKU', brand: 'Brand', tags: 'Tags',
    loading: 'Loading...', notFound: 'Product not found',
    compatible: 'Compatible', partial: 'Partially Compatible', incompatible: 'Incompatible',
    price: 'Price', originalPrice: 'Original Price', saving: 'Save',
    currency: 'MAD',
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

function effectivePrice(p?: Pricing): number {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

function compatibilityStyle(status: Compatibility['status']) {
  return {
    COMPATIBLE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    PARTIAL:      'bg-amber-50  text-amber-700  border-amber-200',
    INCOMPATIBLE: 'bg-red-50    text-red-700    border-red-200',
  }[status]
}

export default function ProductDetailPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [product, setProduct]         = useState<Product | null>(null)
  const [related, setRelated]         = useState<Related[]>([])
  const [compatibility, setCompat]    = useState<Compatibility | null>(null)
  const [activeImg, setActiveImg]     = useState(0)
  const [loading, setLoading]         = useState(true)
  const [addedMsg, setAddedMsg]       = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/restaurant/marketplace/catalog/${id}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        setProduct(d.product ?? null)
        setRelated(d.related ?? [])
        setCompat(d.compatibility ?? null)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-96" dir={isRTL ? 'rtl' : 'ltr'}>
      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
    </div>
  )
  if (!product) return (
    <div className="text-center py-20 text-gray-400" dir={isRTL ? 'rtl' : 'ltr'}>
      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>{t.notFound}</p>
      <Link href="/admin/marketplace/catalog" className="mt-4 inline-block text-emerald-600 text-sm">{t.back}</Link>
    </div>
  )

  const price    = effectivePrice(product.pricing)
  const original = product.pricing?.basePrice ?? 0
  const hasDeal  = price < original
  const currency = t.currency

  function handleAddToOrder() {
    // Navigate to cart/order builder with pre-selected product
    router.push(`/admin/marketplace/orders/new?productId=${product!.id}`)
  }

  return (
    <div className="min-h-full p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Back */}
      <Link href="/admin/marketplace/catalog"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />{t.back}
      </Link>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Images */}
        <div>
          <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
            {product.images?.[activeImg]
              ? <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-contain" />
              : <Package className="w-20 h-20 text-gray-300 mx-auto mt-20" />
            }
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {product.images.slice(0, 5).map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${i === activeImg ? 'border-emerald-500' : 'border-gray-100'}`}>
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h1>
          <p className="text-sm text-gray-400">{product.sku}</p>
          {product.brand && <p className="text-sm text-gray-500 mt-0.5">{product.brand}</p>}

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {product.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Price */}
          {price > 0 && (
            <div className="mt-5">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black text-gray-900">{price.toFixed(2)} {currency}</span>
                {hasDeal && (
                  <span className="text-base text-gray-400 line-through">{original.toFixed(2)} {currency}</span>
                )}
              </div>
              {hasDeal && (
                <p className="text-sm text-emerald-600 font-semibold mt-1">
                  {t.saving} {(original - price).toFixed(2)} {currency}
                </p>
              )}
            </div>
          )}

          {/* Inventory */}
          {product.inventory && (
            <div className={`mt-4 flex items-center gap-3 p-3 rounded-xl border ${
              product.inventory.available === 0 ? 'bg-red-50 border-red-100 text-red-700' :
              product.inventory.isLow        ? 'bg-amber-50 border-amber-100 text-amber-700' :
              'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}>
              {product.inventory.available === 0
                ? <AlertTriangle className="w-4 h-4" />
                : <CheckCircle className="w-4 h-4" />
              }
              <div>
                <p className="font-semibold text-sm">
                  {product.inventory.available === 0 ? t.outOfStock :
                   product.inventory.isLow ? t.lowStock : t.inStock}
                </p>
                <p className="text-xs opacity-70">{t.available}: {product.inventory.available}</p>
              </div>
            </div>
          )}

          {/* Compatibility */}
          {compatibility && (
            <div className={`mt-4 p-3 rounded-xl border ${compatibilityStyle(compatibility.status)}`}>
              <p className="font-semibold text-sm mb-1">
                {compatibility.status === 'COMPATIBLE'   ? t.compatible   :
                 compatibility.status === 'PARTIAL'      ? t.partial      : t.incompatible}
              </p>
              {compatibility.reasons.map((r, i) => (
                <p key={i} className="text-xs opacity-80">{r}</p>
              ))}
            </div>
          )}

          {/* Add to Order */}
          <button
            onClick={handleAddToOrder}
            disabled={product.inventory?.available === 0}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <ShoppingCart className="w-5 h-5" />{t.addToOrder}
          </button>
        </div>
      </div>

      {/* Description */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-500" />{t.description}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
      </section>

      {/* Specs */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-500" />{t.specs}
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">{t.type}:</span> <span className="font-medium">{product.type}</span></div>
          <div><span className="text-gray-400">{t.sku}:</span> <span className="font-mono text-xs">{product.sku}</span></div>
          {product.brand && <div><span className="text-gray-400">{t.brand}:</span> <span className="font-medium">{product.brand}</span></div>}
        </div>
      </section>

      {/* Supported Modules */}
      {product.supportedModules?.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />{t.modules}
          </h2>
          <div className="flex flex-wrap gap-2">
            {product.supportedModules.map(m => (
              <span key={m} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">{m}</span>
            ))}
          </div>
        </section>
      )}

      {/* Supplier */}
      {product.supplier && (
        <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-500" />{t.supplier}
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold text-gray-600">
              {product.supplier.company[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{product.supplier.company}</p>
              <p className="text-xs text-gray-400">{product.supplier.country}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < Math.round(product.supplier!.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related Products */}
      {related.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-800 mb-3">{t.related}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {related.map(r => (
              <Link key={r.id} href={`/admin/marketplace/products/${r.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-3 hover:shadow-sm transition-all">
                <div className="aspect-square bg-gray-50 rounded-xl mb-2 overflow-hidden">
                  {r.images?.[0]
                    ? <img src={r.images[0]} alt={r.name} className="w-full h-full object-contain" />
                    : <Package className="w-8 h-8 text-gray-300 mx-auto mt-5" />
                  }
                </div>
                <p className="text-sm font-semibold text-gray-700 line-clamp-2">{r.name}</p>
                {r.pricing && (
                  <p className="text-xs text-emerald-600 font-bold mt-1">{effectivePrice(r.pricing).toFixed(2)} {currency}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
