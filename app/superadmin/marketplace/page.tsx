'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ShoppingBag, Package, Tag, Truck, ClipboardList, Warehouse,
  TrendingUp, AlertTriangle, RefreshCw, Clock, ArrowRight,
} from 'lucide-react'
import { useSAAuth } from '../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalProducts: number; activeProducts: number; totalCategories: number
  totalSuppliers: number; totalOrders: number; pendingOrders: number
  lowStock: number; inventoryValue: number
}
interface RecentOrder { id: string; orderNumber: string; module: string; status: string; total: number; createdAt: string }
interface RecentProduct { id: string; sku: string; name: string; type: string; status: string }
interface TopCategory { categoryId: string; categoryName: string; productCount: number }

interface DashboardData {
  stats: DashboardStats
  recentOrders: RecentOrder[]
  recentProducts: RecentProduct[]
  topCategories: TopCategory[]
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'لوحة المتجر', subtitle: 'نظرة عامة على المارکت‌بليس',
    refresh: 'تحديث', loading: 'جاري التحميل...',
    totalProducts: 'إجمالي المنتجات', activeProducts: 'المنتجات النشطة',
    categories: 'الفئات', suppliers: 'الموردون',
    totalOrders: 'الطلبات', pendingOrders: 'الطلبات المعلقة',
    lowStock: 'نقص المخزون', inventoryValue: 'قيمة المخزون',
    recentOrders: 'أحدث الطلبات', recentProducts: 'أحدث المنتجات',
    topCategories: 'أكثر الفئات منتجات', viewAll: 'عرض الكل',
    noData: 'لا توجد بيانات',
    STATUS: { DRAFT: 'مسودة', SUBMITTED: 'مُرسل', UNDER_REVIEW: 'قيد المراجعة', APPROVED: 'موافق عليه', REJECTED: 'مرفوض', CANCELLED: 'ملغى', FULFILLED: 'مُنجز' } as Record<string, string>,
  },
  en: {
    title: 'Marketplace Dashboard', subtitle: 'Platform-wide marketplace overview',
    refresh: 'Refresh', loading: 'Loading...',
    totalProducts: 'Total Products', activeProducts: 'Active Products',
    categories: 'Categories', suppliers: 'Suppliers',
    totalOrders: 'Orders', pendingOrders: 'Pending Orders',
    lowStock: 'Low Stock', inventoryValue: 'Inventory Value',
    recentOrders: 'Recent Orders', recentProducts: 'Recent Products',
    topCategories: 'Top Categories', viewAll: 'View All',
    noData: 'No data',
    STATUS: { DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled', FULFILLED: 'Fulfilled' } as Record<string, string>,
  },
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const COLOR: Record<string, string> = {
    DRAFT: 'bg-zinc-700 text-zinc-300',
    SUBMITTED: 'bg-blue-900 text-blue-300',
    UNDER_REVIEW: 'bg-yellow-900 text-yellow-300',
    APPROVED: 'bg-green-900 text-green-300',
    REJECTED: 'bg-red-900 text-red-300',
    CANCELLED: 'bg-zinc-700 text-zinc-400',
    FULFILLED: 'bg-emerald-900 text-emerald-300',
    ACTIVE: 'bg-green-900 text-green-300',
    DRAFT_P: 'bg-zinc-700 text-zinc-300',
    ARCHIVED: 'bg-red-900 text-red-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLOR[status] ?? 'bg-zinc-800 text-zinc-400'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent, href }: {
  label: string; value: string | number; icon: any; accent: string; href: string
}) {
  return (
    <Link href={href} className={`block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-${accent}-700 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg bg-${accent}-900/30`}>
          <Icon className={`w-5 h-5 text-${accent}-400`} />
        </span>
        <ArrowRight className="w-4 h-4 text-zinc-600" />
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{label}</div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplaceDashboard() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/superadmin/marketplace/dashboard', { headers: header() })
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [header])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  const s = data?.stats

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-emerald-400" />
            {t.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-3 text-zinc-400 py-20 justify-center">
          <RefreshCw className="w-5 h-5 animate-spin" />
          {t.loading}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label={t.totalProducts}   value={s?.totalProducts ?? 0}  icon={Package}     accent="blue"    href="/superadmin/marketplace/products" />
            <StatCard label={t.activeProducts}  value={s?.activeProducts ?? 0} icon={TrendingUp}  accent="emerald" href="/superadmin/marketplace/products" />
            <StatCard label={t.categories}      value={s?.totalCategories ?? 0} icon={Tag}        accent="purple"  href="/superadmin/marketplace/categories" />
            <StatCard label={t.suppliers}       value={s?.totalSuppliers ?? 0}  icon={Truck}      accent="orange"  href="/superadmin/marketplace/suppliers" />
            <StatCard label={t.totalOrders}     value={s?.totalOrders ?? 0}     icon={ClipboardList} accent="sky" href="/superadmin/marketplace/orders" />
            <StatCard label={t.pendingOrders}   value={s?.pendingOrders ?? 0}   icon={Clock}      accent="yellow"  href="/superadmin/marketplace/orders" />
            <StatCard label={t.lowStock}        value={s?.lowStock ?? 0}        icon={AlertTriangle} accent="red" href="/superadmin/marketplace/inventory" />
            <StatCard label={t.inventoryValue}  value={`${(s?.inventoryValue ?? 0).toLocaleString()} MAD`} icon={Warehouse} accent="violet" href="/superadmin/marketplace/inventory" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-zinc-200">{t.recentOrders}</h2>
                <Link href="/superadmin/marketplace/orders" className="text-xs text-emerald-400 hover:underline">{t.viewAll}</Link>
              </div>
              {data?.recentOrders.length === 0 ? (
                <p className="text-zinc-500 text-sm">{t.noData}</p>
              ) : (
                <div className="space-y-3">
                  {data?.recentOrders.map(o => (
                    <Link key={o.id} href={`/superadmin/marketplace/orders/${o.id}`}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-zinc-200">{o.orderNumber}</div>
                        <div className="text-xs text-zinc-500">{o.module} · {new Date(o.createdAt).toLocaleDateString(isRTL ? 'ar' : 'en')}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={o.status} labels={t.STATUS} />
                        <span className="text-sm font-medium text-zinc-300">{o.total.toLocaleString()} MAD</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Side column */}
            <div className="space-y-6">
              {/* Top Categories */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-zinc-200">{t.topCategories}</h2>
                  <Link href="/superadmin/marketplace/categories" className="text-xs text-emerald-400 hover:underline">{t.viewAll}</Link>
                </div>
                {data?.topCategories.length === 0 ? (
                  <p className="text-zinc-500 text-sm">{t.noData}</p>
                ) : (
                  <div className="space-y-2">
                    {data?.topCategories.map(c => (
                      <div key={c.categoryId} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">{c.categoryName}</span>
                        <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{c.productCount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Products */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-zinc-200">{t.recentProducts}</h2>
                  <Link href="/superadmin/marketplace/products" className="text-xs text-emerald-400 hover:underline">{t.viewAll}</Link>
                </div>
                {data?.recentProducts.length === 0 ? (
                  <p className="text-zinc-500 text-sm">{t.noData}</p>
                ) : (
                  <div className="space-y-2">
                    {data?.recentProducts.map(p => (
                      <Link key={p.id} href={`/superadmin/marketplace/products/${p.id}`}
                        className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 transition-colors">
                        <div>
                          <div className="text-sm text-zinc-300">{p.name}</div>
                          <div className="text-xs text-zinc-500">{p.sku}</div>
                        </div>
                        <StatusBadge status={p.status} labels={{ ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived', OUT_OF_STOCK: 'Out of Stock' }} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
