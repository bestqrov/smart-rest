'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, Star, TrendingUp, Package, AlertCircle, ShoppingCart,
  Clock, CheckCircle, Layers, Zap, ArrowRight, RefreshCw,
  Tag, Monitor, Cpu, Wifi, BarChart2, Utensils, Bell, Sparkles,
} from 'lucide-react'
import { useLang } from '../lang-context'

interface Product {
  id: string; name: string; sku: string; type: string; images: string[]
  tags: string[]
  pricing?: { basePrice: number; currency: string; discount?: number; promotionalPrice?: number }
  inventory?: { available: number; isLowStock?: boolean }
}

interface Rec {
  productId: string; product?: Product; type: string
  score: { confidence: number; reason: string; priority: number }
}

interface Alert {
  id: string; severity: 'INFO' | 'WARNING' | 'SUCCESS'
  title: string; message: string; productId?: string; actionLabel?: string; actionUrl?: string
}

interface Bundle {
  id: string; name: string; slug: string; description: string
  bundlePrice: number; currency: string; savings: number
  productIds: string[]
}

interface Category { id: string; name: string; slug: string; productCount?: number }

interface WidgetData {
  pendingOrders: number; approvedOrders: number; totalSpent: number
  recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  recommendations: Rec[]
}

const T = {
  ar: {
    title: 'المتجر الذكي', subtitle: 'مساعد الشراء لمطعمك',
    search: 'ابحث عن منتج، باقة، أو خدمة...', searchBtn: 'بحث',
    categories: 'الفئات السريعة',
    pending: 'بانتظار الموافقة', approved: 'طلبات معتمدة', spent: 'إجمالي المشتريات',
    alerts: 'تنبيهات ذكية', featured: 'منتجات مميزة', recommended: 'موصى لك',
    bundles: 'الباقات الجاهزة', services: 'خدمات وتراخيص', trending: 'الأكثر طلباً',
    newArrivals: 'أضيف حديثاً', recentOrders: 'آخر الطلبات',
    viewAll: 'عرض الكل', viewOrder: 'عرض',
    noData: 'لا توجد بيانات', loading: 'جاري التحميل...',
    savings: 'وفّر', addOrder: 'اطلب الآن', viewBundle: 'تفاصيل الباقة',
    newOrder: 'طلب جديد',
    STATUS: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة', APPROVED:'معتمد', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز' } as Record<string,string>,
    currency: 'د.م.',
    TYPE: { RECOMMENDED_FOR_YOU:'موصى لك', FREQUENTLY_BOUGHT_TOGETHER:'يُشترى معاً', UPGRADE_SUGGESTION:'ترقية', TRENDING:'رائج', AI_PICKS:'AI' } as Record<string,string>,
  },
  en: {
    title: 'Smart Marketplace', subtitle: 'Your intelligent purchasing assistant',
    search: 'Search products, bundles, or services...', searchBtn: 'Search',
    categories: 'Quick Categories',
    pending: 'Pending Approval', approved: 'Approved Orders', spent: 'Total Spent',
    alerts: 'Smart Alerts', featured: 'Featured Products', recommended: 'Recommended For You',
    bundles: 'Ready Bundles', services: 'Services & Licenses', trending: 'Trending',
    newArrivals: 'New Arrivals', recentOrders: 'Recent Orders',
    viewAll: 'View All', viewOrder: 'View',
    noData: 'No data', loading: 'Loading...',
    savings: 'Save', addOrder: 'Order Now', viewBundle: 'Bundle Details',
    newOrder: 'New Order',
    STATUS: { DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review', APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled' } as Record<string,string>,
    currency: 'MAD',
    TYPE: { RECOMMENDED_FOR_YOU:'For You', FREQUENTLY_BOUGHT_TOGETHER:'Often Together', UPGRADE_SUGGESTION:'Upgrade', TRENDING:'Trending', AI_PICKS:'AI Pick' } as Record<string,string>,
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }

function price(p?: Product['pricing']) {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` }

const ALERT_COLORS: Record<string, string> = {
  INFO:    'bg-blue-900/30 border-blue-700/40 text-blue-300',
  WARNING: 'bg-amber-900/30 border-amber-700/40 text-amber-300',
  SUCCESS: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
}

const STATUS_BADGE: Record<string,string> = {
  DRAFT:'bg-gray-700 text-gray-300', SUBMITTED:'bg-amber-900/50 text-amber-300',
  UNDER_REVIEW:'bg-blue-900/50 text-blue-300', APPROVED:'bg-emerald-900/50 text-emerald-300',
  REJECTED:'bg-red-900/50 text-red-300', CANCELLED:'bg-gray-800 text-gray-500',
  FULFILLED:'bg-emerald-900/30 text-emerald-400',
}

const CATEGORY_ICONS: Record<string, any> = {
  default: Package, hardware: Cpu, software: Monitor, network: Wifi,
  analytics: BarChart2, service: Utensils, digital: Zap,
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-lg ${className}`} />
}

function ProductCard({ product, t }: { product: Product; t: typeof T.ar }) {
  const p = price(product.pricing)
  const hasDisc = product.pricing && (product.pricing.discount || product.pricing.promotionalPrice)
  return (
    <Link href={`/admin/marketplace/products/${product.id}`}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 hover:bg-gray-800/80 transition-all group">
      <div className="aspect-video bg-gray-800 relative overflow-hidden">
        {product.images[0]
          ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-600" /></div>}
        {hasDisc && <span className="absolute top-2 start-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">{product.pricing?.discount}% OFF</span>}
        {product.inventory?.isLowStock && <span className="absolute top-2 end-2 bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">{t.currency === 'د.م.' ? 'مخزون منخفض' : 'Low Stock'}</span>}
      </div>
      <div className="p-3">
        <p className="text-xs text-emerald-400 font-medium mb-1 uppercase tracking-wide">{product.type}</p>
        <h4 className="text-sm text-gray-100 font-medium line-clamp-2 mb-2">{product.name}</h4>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-white">{fmt(p, t.currency)}</span>
          {product.pricing?.basePrice && hasDisc && (
            <span className="text-xs line-through text-gray-500">{fmt(product.pricing.basePrice, t.currency)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function MarketplacePage() {
  const { lang, isRTL } = useLang()
  const router = useRouter()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const [widget, setWidget]       = useState<WidgetData | null>(null)
  const [featured, setFeatured]   = useState<Product[]>([])
  const [recs, setRecs]           = useState<Rec[]>([])
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [bundles, setBundles]     = useState<Bundle[]>([])
  const [services, setServices]   = useState<Product[]>([])
  const [trending, setTrending]   = useState<Product[]>([])
  const [recent, setRecent]       = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const h = authHeader()
    try {
      const [wRes, fRes, rRes, aRes, bRes, tRes, recRes, catRes] = await Promise.all([
        fetch('/api/restaurant/marketplace/widget', { headers: h }),
        fetch('/api/restaurant/marketplace/featured', { headers: h }),
        fetch('/api/restaurant/marketplace/recent', { headers: h }),
        fetch('/api/restaurant/marketplace/alerts', { headers: h }),
        fetch('/api/restaurant/marketplace/bundles', { headers: h }),
        fetch('/api/restaurant/marketplace/catalog?sort=trending&limit=6', { headers: h }),
        fetch('/api/restaurant/marketplace/recommendations', { headers: h }),
        fetch('/api/restaurant/marketplace/categories', { headers: h }),
      ])
      const [wData, fData, rData, aData, bData, tData, recData, catData] = await Promise.all([
        wRes.json(), fRes.json(), rRes.json(), aRes.json(), bRes.json(), tRes.json(), rRes.json(), catRes.json(),
      ])
      setWidget(wData)
      setFeatured(fData.products ?? [])
      setRecent(rData.products ?? [])
      setAlerts(aData.alerts ?? [])
      setBundles(bData.bundles ?? [])
      setTrending(tData.products ?? [])
      setRecs(recData.recommendations ?? wData.recommendations ?? [])
      setCategories(catData.categories ?? [])

      // Services: filter from catalog
      const svRes = await fetch('/api/restaurant/marketplace/catalog?type=SERVICE&limit=6', { headers: h })
      const svData = await svRes.json()
      setServices(svData.products ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) router.push(`/admin/marketplace/catalog?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-emerald-950 via-gray-900 to-gray-950 rounded-2xl p-8 mb-8 overflow-hidden border border-emerald-900/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.1),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">SmartSuite Marketplace</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.subtitle}</p>
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-xl ps-10 pe-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:bg-gray-800"
              />
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              {t.searchBtn}
            </button>
          </form>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading
          ? [0,1,2].map(i => <Skeleton key={i} className="h-24" />)
          : [
            { label: t.pending,  value: widget?.pendingOrders ?? 0,  icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-800/30' },
            { label: t.approved, value: widget?.approvedOrders ?? 0, icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/30' },
            { label: t.spent,    value: fmt(widget?.totalSpent ?? 0, t.currency), icon: BarChart2, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/30', isText: true },
          ].map(({ label, value, icon: Icon, color, bg, isText }) => (
            <div key={label} className={`border rounded-xl p-4 ${bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{isText ? value : Number(value).toLocaleString()}</p>
            </div>
          ))
        }
      </div>

      {/* ── Quick Categories ──────────────────────────────────────────────────── */}
      {!loading && categories.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{t.categories}</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
            {categories.slice(0, 8).map(cat => {
              const IconComp = CATEGORY_ICONS[cat.slug] ?? CATEGORY_ICONS.default
              return (
                <Link key={cat.id} href={`/admin/marketplace/catalog?category=${cat.id}`}
                  className="flex flex-col items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-emerald-700/50 hover:bg-gray-800 transition-all text-center group">
                  <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-emerald-900/40 transition-colors">
                    <IconComp className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 leading-tight">{cat.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Smart Alerts ──────────────────────────────────────────────────────── */}
      {!loading && alerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-300">{t.alerts}</h2>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map(a => (
              <div key={a.id} className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${ALERT_COLORS[a.severity] ?? ALERT_COLORS.INFO}`}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">{a.message}</p>
                </div>
                {a.actionUrl && (
                  <Link href={a.actionUrl} className="text-xs font-medium underline underline-offset-2 whitespace-nowrap shrink-0">
                    {a.actionLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <h2 className="text-base font-semibold text-white">{t.featured}</h2>
          </div>
          <Link href="/admin/marketplace/catalog?featured=true" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            {t.viewAll} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading
          ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-52" />)}</div>
          : featured.length === 0
            ? <div className="text-center py-8 text-gray-500 text-sm">{t.noData}</div>
            : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {featured.slice(0, 4).map(p => <ProductCard key={p.id} product={p} t={t} />)}
              </div>
        }
      </div>

      {/* ── Recommended ───────────────────────────────────────────────────────── */}
      {!loading && recs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{t.recommended}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recs.slice(0, 4).map(r => r.product && (
              <div key={r.productId} className="relative">
                <div className="absolute top-2 end-2 z-10 bg-purple-800/80 text-purple-200 text-xs px-2 py-0.5 rounded-full">
                  {t.TYPE[r.type] ?? r.type}
                </div>
                <ProductCard product={r.product} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bundles ───────────────────────────────────────────────────────────── */}
      {!loading && bundles.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">{t.bundles}</h2>
            </div>
            <Link href="/admin/marketplace/bundles" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.slice(0, 3).map(b => (
              <div key={b.id} className="bg-gray-900 border border-emerald-900/30 rounded-xl p-4 hover:border-emerald-700/50 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">{b.name}</h4>
                    <p className="text-xs text-gray-400 line-clamp-2">{b.description}</p>
                  </div>
                  <div className="text-end shrink-0 ms-3">
                    <p className="text-base font-bold text-emerald-400">{fmt(b.bundlePrice, t.currency)}</p>
                    {b.savings > 0 && (
                      <p className="text-xs text-gray-400">{t.savings} <span className="text-emerald-400">{fmt(b.savings, t.currency)}</span></p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{b.productIds.length} {lang === 'ar' ? 'منتج' : 'products'}</span>
                  <Link href={`/admin/marketplace/bundles/${b.id}`}
                    className="text-xs bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-300 px-3 py-1.5 rounded-lg transition-colors">
                    {t.viewBundle}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Services ──────────────────────────────────────────────────────────── */}
      {!loading && services.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-semibold text-white">{t.services}</h2>
            </div>
            <Link href="/admin/marketplace/catalog?type=SERVICE" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {services.slice(0, 4).map(p => <ProductCard key={p.id} product={p} t={t} />)}
          </div>
        </div>
      )}

      {/* ── Trending ──────────────────────────────────────────────────────────── */}
      {!loading && trending.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <h2 className="text-base font-semibold text-white">{t.trending}</h2>
            </div>
            <Link href="/admin/marketplace/catalog?sort=trending" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trending.slice(0, 4).map(p => <ProductCard key={p.id} product={p} t={t} />)}
          </div>
        </div>
      )}

      {/* ── New Arrivals ──────────────────────────────────────────────────────── */}
      {!loading && recent.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-pink-400" />
              <h2 className="text-base font-semibold text-white">{t.newArrivals}</h2>
            </div>
            <Link href="/admin/marketplace/catalog?sort=newest" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recent.slice(0, 4).map(p => <ProductCard key={p.id} product={p} t={t} />)}
          </div>
        </div>
      )}

      {/* ── Recent Orders ─────────────────────────────────────────────────────── */}
      {!loading && (widget?.recentPurchases?.length ?? 0) > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <h2 className="text-base font-semibold text-white">{t.recentOrders}</h2>
            </div>
            <Link href="/admin/marketplace/orders" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {widget!.recentPurchases.map((o, i) => (
              <div key={o.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-200 font-medium">{o.orderNumber}</p>
                    <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_BADGE[o.status] ?? STATUS_BADGE.DRAFT}`}>
                    {t.STATUS[o.status] ?? o.status}
                  </span>
                  <span className="text-sm font-medium text-gray-200">{fmt(o.total, t.currency)}</span>
                  <Link href={`/admin/marketplace/orders/${o.id}`}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">{t.viewOrder}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pb-4">
        <Link href="/admin/marketplace/catalog"
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors">
          <Package className="w-4 h-4" />
          {lang === 'ar' ? 'تصفح الكتالوج' : 'Browse Catalog'}
        </Link>
        <Link href="/admin/marketplace/orders/new"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-3 rounded-xl text-sm font-medium transition-colors border border-gray-700">
          <ShoppingCart className="w-4 h-4" />
          {t.newOrder}
        </Link>
        <button onClick={load}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-gray-400 px-4 py-3 rounded-xl text-sm transition-colors border border-gray-800">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  )
}
