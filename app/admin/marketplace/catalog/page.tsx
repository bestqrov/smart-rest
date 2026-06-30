'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Grid3X3, List, Filter, Package, RefreshCw, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { useLang } from '../../lang-context'

interface Product {
  id: string; name: string; sku: string; type: string; brand?: string
  images: string[]; tags: string[]
  pricing?: { basePrice: number; currency: string; discount?: number; promotionalPrice?: number }
  inventory?: { available: number; isLowStock?: boolean }
}

const T = {
  ar: {
    title: 'الكتالوج', search: 'ابحث عن منتج...', filter: 'تصفية',
    type: 'النوع', all: 'الكل', brand: 'العلامة التجارية',
    grid: 'شبكة', list: 'قائمة',
    available: 'متاح', outOfStock: 'نفد المخزون', lowStock: 'مخزون منخفض',
    noProducts: 'لا توجد منتجات', loading: 'جاري التحميل...',
    prev: 'السابق', next: 'التالي', of: 'من', results: 'نتيجة',
    currency: 'د.م.',
    TYPE: { HARDWARE:'أجهزة', SOFTWARE:'برمجيات', DIGITAL:'رقمي', SERVICE:'خدمة', SUBSCRIPTION:'اشتراك', LICENSE:'ترخيص' } as Record<string,string>,
    addToCart: 'أضف للطلب',
  },
  en: {
    title: 'Catalog', search: 'Search products...', filter: 'Filter',
    type: 'Type', all: 'All', brand: 'Brand',
    grid: 'Grid', list: 'List',
    available: 'In stock', outOfStock: 'Out of stock', lowStock: 'Low stock',
    noProducts: 'No products found', loading: 'Loading...',
    prev: 'Previous', next: 'Next', of: 'of', results: 'results',
    currency: 'MAD',
    TYPE: { HARDWARE:'Hardware', SOFTWARE:'Software', DIGITAL:'Digital', SERVICE:'Service', SUBSCRIPTION:'Subscription', LICENSE:'License' } as Record<string,string>,
    addToCart: 'Add to Order',
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

function effectivePrice(p?: Product['pricing']): number {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

export default function CatalogPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const params = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [view, setView]         = useState<'grid' | 'list'>('grid')
  const [search, setSearch]     = useState(params.get('search') ?? '')
  const [type, setType]         = useState(params.get('type') ?? '')
  const [featured, setFeatured] = useState(params.get('featured') === '1')
  const [loading, setLoading]   = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LIMIT = 20

  const load = useCallback(async (pg = page, q = search, tp = type, ft = featured) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (q)  qs.set('search', q)
      if (tp) qs.set('type', tp)
      if (ft) qs.set('featured', '1')
      const res  = await fetch(`/api/restaurant/marketplace/catalog?${qs}`, { headers: authHeader() })
      const json = await res.json()
      setProducts(json.products ?? [])
      setTotal(json.total ?? 0)
    } finally { setLoading(false) }
  }, [page, search, type, featured])

  useEffect(() => { load(1, search, type, featured) }, [type, featured])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(1, search, type, featured), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  function goPage(p: number) { setPage(p); load(p, search, type, featured) }

  const totalPages = Math.ceil(total / LIMIT)
  const currency   = t.currency

  function StockBadge({ inv }: { inv?: Product['inventory'] }) {
    if (!inv) return null
    if (inv.available === 0)  return <span className="text-[10px] text-red-500 font-medium">{t.outOfStock}</span>
    if (inv.isLowStock)       return <span className="text-[10px] text-amber-500 font-medium">{t.lowStock}</span>
    return <span className="text-[10px] text-emerald-500 font-medium">{t.available}</span>
  }

  return (
    <div className="min-h-full p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />{t.title}
          {total > 0 && <span className="text-sm font-normal text-gray-400">({total} {t.results})</span>}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            className="flex-1 text-sm focus:outline-none bg-transparent" />
          {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
        </div>

        <select value={type} onChange={e => { setType(e.target.value); setPage(1) }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none">
          <option value="">{t.all} {t.type}</option>
          {Object.entries(t.TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <button onClick={() => { setFeatured(f => !f); setPage(1) }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${featured ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          ★ مميز
        </button>
      </div>

      {/* Products */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t.noProducts}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {products.map(p => (
            <Link key={p.id} href={`/admin/marketplace/products/${p.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="aspect-video bg-gray-50 overflow-hidden">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  : <Package className="w-10 h-10 text-gray-300 mx-auto mt-6" />
                }
              </div>
              <div className="p-3">
                <p className="font-semibold text-gray-800 text-sm line-clamp-2">{p.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{p.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  {effectivePrice(p.pricing) > 0
                    ? <span className="font-bold text-emerald-600 text-sm">{effectivePrice(p.pricing).toFixed(2)} {currency}</span>
                    : <span />}
                  <StockBadge inv={p.inventory} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <Link key={p.id} href={`/admin/marketplace/products/${p.id}`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-all">
              <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
                  : <Package className="w-7 h-7 text-gray-300 mx-auto mt-3" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.sku} · {t.TYPE[p.type] ?? p.type}</p>
                <StockBadge inv={p.inventory} />
              </div>
              {effectivePrice(p.pricing) > 0 && (
                <span className="font-bold text-emerald-600 text-base shrink-0">
                  {effectivePrice(p.pricing).toFixed(2)} {currency}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => goPage(page - 1)} disabled={page === 1}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page} {t.of} {totalPages}</span>
          <button onClick={() => goPage(page + 1)} disabled={page === totalPages}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
