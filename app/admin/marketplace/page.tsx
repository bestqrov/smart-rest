'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Store, Search, Star, TrendingUp, Zap, Package, AlertCircle,
  ChevronRight, RefreshCw, ShoppingCart, Clock, CheckCircle, Bell, Sparkles
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; sku: string; type: string; images: string[]
  tags: string[]; pricing?: { basePrice: number; currency: string; discount?: number; promotionalPrice?: number }
  inventory?: { available: number; isLowStock?: boolean }
}

interface Recommendation {
  productId: string; product?: Product; type: string
  score: { confidence: number; reason: string; priority: number }
}

interface Alert {
  id: string; severity: 'INFO' | 'WARNING' | 'SUCCESS'
  title: string; message: string; productId?: string; actionLabel?: string; actionUrl?: string
}

interface WidgetData {
  pendingOrders: number; approvedOrders: number; totalSpent: number
  recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  recommendations: Recommendation[]
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'المتجر', subtitle: 'مساعد الشراء الذكي لمطعمك',
    search: 'ابحث عن منتج...', searchBtn: 'بحث',
    featured: 'منتجات مميزة', recommended: 'موصى لك', trending: 'الأكثر طلباً',
    recent: 'أضيف حديثاً', alerts: 'تنبيهات ذكية',
    pending: 'طلبات بانتظار الموافقة', approved: 'طلبات معتمدة',
    spent: 'إجمالي المشتريات', recentOrders: 'آخر الطلبات',
    catalog: 'تصفح الكتالوج', viewAll: 'عرض الكل',
    noData: 'لا توجد بيانات', loading: 'جاري التحميل...',
    STATUS: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة', APPROVED:'معتمد', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز' } as Record<string,string>,
    TYPE: { RECOMMENDED_FOR_YOU:'موصى لك', FREQUENTLY_BOUGHT_TOGETHER:'يُشترى معاً', UPGRADE_SUGGESTION:'ترقية مقترحة', TRENDING:'رائج', AI_PICKS:'اختيار AI' } as Record<string,string>,
    currency: 'د.م.',
  },
  en: {
    title: 'Marketplace', subtitle: 'Your smart purchasing assistant',
    search: 'Search for a product...', searchBtn: 'Search',
    featured: 'Featured Products', recommended: 'Recommended For You', trending: 'Trending',
    recent: 'Recently Added', alerts: 'Smart Alerts',
    pending: 'Pending Orders', approved: 'Approved Orders',
    spent: 'Total Spent', recentOrders: 'Recent Orders',
    catalog: 'Browse Catalog', viewAll: 'View All',
    noData: 'No data', loading: 'Loading...',
    STATUS: { DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review', APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled' } as Record<string,string>,
    TYPE: { RECOMMENDED_FOR_YOU:'Recommended For You', FREQUENTLY_BOUGHT_TOGETHER:'Frequently Bought Together', UPGRADE_SUGGESTION:'Upgrade Suggestion', TRENDING:'Trending', AI_PICKS:'AI Picks' } as Record<string,string>,
    currency: 'MAD',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectivePrice(p?: Product['pricing']): number {
  if (!p) return 0
  if (p.promotionalPrice) return p.promotionalPrice
  if (p.discount) return p.basePrice * (1 - p.discount / 100)
  return p.basePrice
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

function ProductCard({ product, currency }: { product: Product; currency: string }) {
  const img   = product.images?.[0]
  const price = effectivePrice(product.pricing)
  return (
    <Link href={`/admin/marketplace/products/${product.id}`}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
      <div className="aspect-video bg-gray-50 overflow-hidden">
        {img
          ? <img src={img} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
        }
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-800 text-sm line-clamp-1">{product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{product.sku}</p>
        {price > 0 && (
          <p className="mt-2 font-bold text-emerald-600 text-sm">{price.toFixed(2)} {currency}</p>
        )}
        {product.inventory && (
          <p className={`text-[10px] mt-1 ${product.inventory.available === 0 ? 'text-red-500' : product.inventory.isLowStock ? 'text-amber-500' : 'text-gray-400'}`}>
            {product.inventory.available === 0 ? '✕ نفد المخزون' : `✓ ${product.inventory.available} متاح`}
          </p>
        )}
      </div>
    </Link>
  )
}

function alertColor(severity: Alert['severity']) {
  return {
    INFO:    'bg-blue-50 border-blue-200 text-blue-800',
    WARNING: 'bg-amber-50 border-amber-200 text-amber-800',
    SUCCESS: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }[severity]
}

function alertIcon(severity: Alert['severity']) {
  if (severity === 'WARNING') return <AlertCircle className="w-4 h-4 shrink-0" />
  if (severity === 'SUCCESS') return <CheckCircle className="w-4 h-4 shrink-0" />
  return <Bell className="w-4 h-4 shrink-0" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplaceHomePage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [search, setSearch]               = useState('')
  const [featured, setFeatured]           = useState<Product[]>([])
  const [recent, setRecent]               = useState<Product[]>([])
  const [recommendations, setRecs]        = useState<Recommendation[]>([])
  const [trending, setTrending]           = useState<Recommendation[]>([])
  const [alerts, setAlerts]               = useState<Alert[]>([])
  const [widget, setWidget]               = useState<WidgetData | null>(null)
  const [loading, setLoading]             = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [featuredRes, recentRes, recsRes, alertsRes, widgetRes] = await Promise.all([
        fetch('/api/restaurant/marketplace/featured',       { headers: authHeader() }).then(r => r.json()),
        fetch('/api/restaurant/marketplace/recent',         { headers: authHeader() }).then(r => r.json()),
        fetch('/api/restaurant/marketplace/recommendations',{ headers: authHeader() }).then(r => r.json()),
        fetch('/api/restaurant/marketplace/alerts',         { headers: authHeader() }).then(r => r.json()),
        fetch('/api/restaurant/marketplace/widget',         { headers: authHeader() }).then(r => r.json()),
      ])
      setFeatured(featuredRes.products ?? [])
      setRecent(recentRes.products ?? [])
      setRecs(recsRes.recommendations ?? [])
      setTrending(recsRes.trending ?? [])
      setAlerts(alertsRes.alerts ?? [])
      setWidget(widgetRes)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) window.location.href = `/admin/marketplace/catalog?search=${encodeURIComponent(search.trim())}`
  }

  const currency = t.currency

  return (
    <div className="min-h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-7 h-7" />
            <h1 className="text-2xl font-bold">{t.title}</h1>
          </div>
          <p className="text-emerald-100 mb-6">{t.subtitle}</p>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-4 py-3 border border-white/30">
              <Search className="w-4 h-4 text-white/70" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t.search}
                className="flex-1 bg-transparent text-white placeholder-white/60 text-sm focus:outline-none"
              />
            </div>
            <button type="submit"
              className="px-5 py-3 bg-white text-emerald-700 font-semibold rounded-xl text-sm hover:bg-emerald-50 transition-colors">
              {t.searchBtn}
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : (
          <>
            {/* ── Stats Widget ────────────────────────────────────────── */}
            {widget && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Clock,        label: t.pending,  val: widget.pendingOrders,  color: 'text-amber-600',  bg: 'bg-amber-50' },
                  { icon: CheckCircle,  label: t.approved, val: widget.approvedOrders, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { icon: ShoppingCart, label: t.spent,    val: `${widget.totalSpent.toFixed(0)} ${currency}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { icon: Sparkles,     label: 'توصيات AI', val: widget.recommendations.length, color: 'text-violet-600', bg: 'bg-violet-50' },
                ].map(({ icon: Icon, label, val, color, bg }) => (
                  <div key={label} className={`${bg} rounded-2xl p-4 border border-gray-100`}>
                    <Icon className={`w-5 h-5 ${color} mb-2`} />
                    <p className="text-2xl font-bold text-gray-800">{val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Smart Alerts ────────────────────────────────────────── */}
            {alerts.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />{t.alerts}
                </h2>
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border ${alertColor(alert.severity)}`}>
                      {alertIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{alert.title}</p>
                        <p className="text-xs mt-0.5 opacity-80">{alert.message}</p>
                      </div>
                      {alert.actionUrl && (
                        <Link href={alert.actionUrl} className="text-xs font-semibold underline shrink-0">
                          {alert.actionLabel}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Recommended For You ─────────────────────────────────── */}
            {recommendations.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />{t.recommended}
                  </h2>
                  <Link href="/admin/marketplace/catalog" className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                    {t.viewAll}<ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {recommendations.map(r => r.product && (
                    <div key={r.productId} className="relative">
                      <ProductCard product={r.product as Product} currency={currency} />
                      <div className="absolute top-2 start-2 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t.TYPE[r.type] ?? r.type}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Featured Products ────────────────────────────────────── */}
            {featured.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />{t.featured}
                  </h2>
                  <Link href="/admin/marketplace/catalog?featured=1" className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                    {t.viewAll}<ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {featured.map(p => <ProductCard key={p.id} product={p} currency={currency} />)}
                </div>
              </section>
            )}

            {/* ── Trending ─────────────────────────────────────────────── */}
            {trending.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />{t.trending}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trending.map((r, i) => (
                    <Link key={r.productId} href={`/admin/marketplace/products/${r.productId}`}
                      className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-sm transition-all">
                      <span className="text-2xl font-black text-gray-200 w-8 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-700 text-sm truncate">{r.productId}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.score.reason}</p>
                      </div>
                      <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── Recently Added ───────────────────────────────────────── */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />{t.recent}
                  </h2>
                  <Link href="/admin/marketplace/catalog" className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                    {t.viewAll}<ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {recent.slice(0, 4).map(p => <ProductCard key={p.id} product={p} currency={currency} />)}
                </div>
              </section>
            )}

            {/* ── Recent Orders ────────────────────────────────────────── */}
            {widget && widget.recentPurchases.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-gray-500" />{t.recentOrders}
                  </h2>
                  <Link href="/admin/marketplace/orders" className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                    {t.viewAll}<ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {widget.recentPurchases.map((order, i) => (
                    <Link key={order.id} href={`/admin/marketplace/orders/${order.id}`}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-700 text-sm">{order.orderNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString('ar-MA')}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{order.total.toFixed(2)} {currency}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.status === 'APPROVED' || order.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'REJECTED' || order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{t.STATUS[order.status] ?? order.status}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── CTA ──────────────────────────────────────────────────── */}
            <div className="flex gap-3">
              <Link href="/admin/marketplace/catalog"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors">
                <Store className="w-5 h-5" />{t.catalog}
              </Link>
              <Link href="/admin/marketplace/orders"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors">
                <ShoppingCart className="w-5 h-5" />طلباتي
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
