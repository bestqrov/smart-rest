'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Grid3X3, List, Filter, Package, RefreshCw,
  ChevronLeft, ChevronRight, X, Star, SlidersHorizontal,
} from 'lucide-react'
import { useLang } from '../../lang-context'

interface Product {
  id: string; name: string; sku: string; type: string; brand?: string
  images: string[]; tags: string[]
  pricing?: { basePrice: number; currency: string; discount?: number; promotionalPrice?: number }
  inventory?: { available: number; isLowStock?: boolean }
  isFeatured?: boolean
}

const T = {
  ar: {
    title: 'الكتالوج', search: 'ابحث عن منتج...', filter: 'تصفية', sort: 'ترتيب',
    type: 'النوع', brand: 'العلامة التجارية', price: 'السعر', availability: 'التوفر',
    all: 'الكل', featured: 'مميز فقط',
    inStock: 'متاح', lowStock: 'مخزون منخفض', outOfStock: 'نفد',
    noProducts: 'لا توجد منتجات', loading: 'جاري التحميل...',
    prev: 'السابق', next: 'التالي', of: 'من', results: 'نتيجة',
    currency: 'د.م.', addOrder: 'أضف للطلب', clearFilters: 'مسح التصفية',
    min: 'الحد الأدنى', max: 'الحد الأقصى', apply: 'تطبيق',
    SORT: { newest:'الأحدث', priceAsc:'السعر: الأقل', priceDesc:'السعر: الأعلى', name:'الاسم', featured:'المميزة', trending:'الأكثر طلباً' } as Record<string,string>,
    TYPE: { HARDWARE:'أجهزة', SOFTWARE:'برمجيات', DIGITAL:'رقمي', SERVICE:'خدمة', SUBSCRIPTION:'اشتراك', LICENSE:'ترخيص' } as Record<string,string>,
  },
  en: {
    title: 'Catalog', search: 'Search products...', filter: 'Filter', sort: 'Sort',
    type: 'Type', brand: 'Brand', price: 'Price Range', availability: 'Availability',
    all: 'All', featured: 'Featured only',
    inStock: 'In stock', lowStock: 'Low stock', outOfStock: 'Out of stock',
    noProducts: 'No products found', loading: 'Loading...',
    prev: 'Previous', next: 'Next', of: 'of', results: 'results',
    currency: 'MAD', addOrder: 'Add to Order', clearFilters: 'Clear Filters',
    min: 'Min', max: 'Max', apply: 'Apply',
    SORT: { newest:'Newest', priceAsc:'Price: Low', priceDesc:'Price: High', name:'Name', featured:'Featured', trending:'Trending' } as Record<string,string>,
    TYPE: { HARDWARE:'Hardware', SOFTWARE:'Software', DIGITAL:'Digital', SERVICE:'Service', SUBSCRIPTION:'Subscription', LICENSE:'License' } as Record<string,string>,
  },
}

const SORTS  = ['newest','priceAsc','priceDesc','name','featured','trending']
const TYPES  = ['HARDWARE','SOFTWARE','DIGITAL','SERVICE','SUBSCRIPTION','LICENSE']
const AVAIL  = ['all','inStock','lowStock','outOfStock']

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }

function price(p?: Product['pricing']) {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` }

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

function StockBadge({ inv, t }: { inv?: Product['inventory']; t: typeof T.ar }) {
  if (!inv || inv.available <= 0) return <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">{t.outOfStock}</span>
  if (inv.isLowStock) return <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">{t.lowStock}</span>
  return <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">{t.inStock}</span>
}

export default function CatalogPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const params = useSearchParams()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [brands,   setBrands]   = useState<string[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [view,     setView]     = useState<'grid' | 'list'>('grid')
  const [loading,  setLoading]  = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const [search,   setSearch]   = useState(params.get('q') ?? '')
  const [type,     setType]     = useState(params.get('type') ?? '')
  const [brand,    setBrand]    = useState(params.get('brand') ?? '')
  const [sort,     setSort]     = useState(params.get('sort') ?? 'newest')
  const [featured, setFeatured] = useState(params.get('featured') === 'true')
  const [avail,    setAvail]    = useState<string>(params.get('avail') ?? 'all')
  const [priceMin, setPriceMin] = useState(params.get('priceMin') ?? '')
  const [priceMax, setPriceMax] = useState(params.get('priceMax') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? '')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const limit = 20

  const buildUrl = useCallback(() => {
    const q = new URLSearchParams()
    if (search)   q.set('q', search)
    if (type)     q.set('type', type)
    if (brand)    q.set('brand', brand)
    if (sort)     q.set('sort', sort)
    if (featured) q.set('featured', 'true')
    if (avail !== 'all') q.set('avail', avail)
    if (priceMin) q.set('priceMin', priceMin)
    if (priceMax) q.set('priceMax', priceMax)
    if (category) q.set('category', category)
    q.set('page', String(page))
    q.set('limit', String(limit))
    return `/api/restaurant/marketplace/catalog?${q}`
  }, [search, type, brand, sort, featured, avail, priceMin, priceMax, category, page])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(buildUrl(), { headers: authHeader() })
      const data = await res.json()
      setProducts(data.products ?? [])
      setTotal(data.total ?? 0)
      if (data.brands) setBrands(data.brands)
    } catch {}
    setLoading(false)
  }, [buildUrl])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { load() }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [load])

  const totalPages = Math.ceil(total / limit)
  const hasFilters = !!(search || type || brand || featured || avail !== 'all' || priceMin || priceMax || category)

  const clearAll = () => {
    setSearch(''); setType(''); setBrand(''); setSort('newest')
    setFeatured(false); setAvail('all'); setPriceMin(''); setPriceMax(''); setCategory('')
    setPage(1)
  }

  return (
    <div>
      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={t.search}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl ps-9 pe-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
        >
          {SORTS.map(s => <option key={s} value={s}>{t.SORT[s]}</option>)}
        </select>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-colors ${showFilters ? 'bg-emerald-800/50 border-emerald-700 text-emerald-300' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t.filter}
          {hasFilters && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
        </button>

        {/* View toggle */}
        <div className="flex border border-gray-700 rounded-xl overflow-hidden">
          <button onClick={() => setView('grid')}
            className={`p-2.5 ${view === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')}
            className={`p-2.5 border-s border-gray-700 ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Filter Panel ───────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Type */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{t.type}</label>
            <select value={type} onChange={e => { setType(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500">
              <option value="">{t.all}</option>
              {TYPES.map(tp => <option key={tp} value={tp}>{t.TYPE[tp]}</option>)}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{t.brand}</label>
            <select value={brand} onChange={e => { setBrand(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500">
              <option value="">{t.all}</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Availability */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{t.availability}</label>
            <select value={avail} onChange={e => { setAvail(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500">
              {AVAIL.map(a => <option key={a} value={a}>{t.inStock && a === 'inStock' ? t.inStock : a === 'lowStock' ? t.lowStock : a === 'outOfStock' ? t.outOfStock : t.all}</option>)}
            </select>
          </div>

          {/* Price range */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{t.price}</label>
            <div className="flex gap-2">
              <input value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder={t.min}
                className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500" />
              <input value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder={t.max}
                className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          {/* Featured toggle + clear */}
          <div className="col-span-2 md:col-span-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setFeatured(!featured)}
                className={`w-9 h-5 rounded-full transition-colors relative ${featured ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${featured ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">{t.featured}</span>
            </label>
            {hasFilters && (
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <X className="w-3 h-3" /> {t.clearFilters}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results Count ──────────────────────────────────────────────────────── */}
      {!loading && (
        <p className="text-xs text-gray-500 mb-4">{total} {t.results}</p>
      )}

      {/* ── Products ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-3'}>
          {[0,1,2,3,4,5,6,7].map(i => <Skeleton key={i} className={view === 'grid' ? 'h-56' : 'h-20'} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t.noProducts}</p>
          {hasFilters && (
            <button onClick={clearAll} className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">{t.clearFilters}</button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => {
            const ep = price(p.pricing)
            const hasDisc = p.pricing && (p.pricing.discount || p.pricing.promotionalPrice)
            return (
              <Link key={p.id} href={`/admin/marketplace/products/${p.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 hover:bg-gray-800/70 transition-all group">
                <div className="aspect-video bg-gray-800 relative overflow-hidden">
                  {p.images[0]
                    ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-600" /></div>}
                  {hasDisc && <span className="absolute top-2 start-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{p.pricing?.discount}%</span>}
                  {p.isFeatured && <Star className="absolute top-2 end-2 w-4 h-4 text-yellow-400 fill-yellow-400" />}
                </div>
                <div className="p-3">
                  <p className="text-xs text-emerald-400 mb-1 uppercase">{p.type}</p>
                  <h4 className="text-sm text-gray-100 font-medium line-clamp-2 mb-2">{p.name}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{fmt(ep, t.currency)}</span>
                    <StockBadge inv={p.inventory} t={t} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const ep = price(p.pricing)
            return (
              <Link key={p.id} href={`/admin/marketplace/products/${p.id}`}
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 hover:bg-gray-800/70 transition-all group">
                <div className="w-16 h-16 bg-gray-800 rounded-lg shrink-0 overflow-hidden">
                  {p.images[0]
                    ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-600" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-400 mb-0.5 uppercase">{p.type}</p>
                  <h4 className="text-sm text-gray-100 font-medium truncate">{p.name}</h4>
                  {p.brand && <p className="text-xs text-gray-500 mt-0.5">{p.brand}</p>}
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-bold text-white mb-1">{fmt(ep, t.currency)}</p>
                  <StockBadge inv={p.inventory} t={t} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <span className="text-xs text-gray-500">{page} {t.of} {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors">
              {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {t.prev}
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors">
              {t.next}
              {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
