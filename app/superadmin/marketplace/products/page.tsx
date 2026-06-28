'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Package, Plus, Search, Filter, RefreshCw, Edit2,
  Archive, Copy, Eye, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; sku: string; name: string; type: string; categoryId: string
  status: string; visibility: string; images: string[]; tags: string[]
  supportedModules: string[]; createdAt: string
}
interface ProductPage { products: Product[]; total: number; page: number; pages: number }

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'المنتجات', subtitle: 'إدارة منتجات المارکت‌بليس',
    add: 'إضافة منتج', search: 'بحث...', filter: 'تصفية', refresh: 'تحديث',
    sku: 'الرمز', name: 'الاسم', type: 'النوع', status: 'الحالة',
    visibility: 'الظهور', modules: 'الوحدات', actions: 'إجراءات',
    edit: 'تعديل', archive: 'أرشفة', duplicate: 'نسخ', view: 'عرض',
    noProducts: 'لا توجد منتجات', loading: 'جاري التحميل...',
    confirmArchive: 'هل أنت متأكد من الأرشفة؟',
    TYPE: { HARDWARE: 'أجهزة', SOFTWARE: 'برمجيات', DIGITAL: 'رقمي', SERVICE: 'خدمة', SUBSCRIPTION: 'اشتراك', LICENSE: 'ترخيص' } as Record<string, string>,
    STATUS: { DRAFT: 'مسودة', ACTIVE: 'نشط', ARCHIVED: 'مؤرشف', OUT_OF_STOCK: 'نفد المخزون' } as Record<string, string>,
    prev: 'السابق', next: 'التالي', of: 'من',
    allTypes: 'كل الأنواع', allStatus: 'كل الحالات',
  },
  en: {
    title: 'Products', subtitle: 'Manage marketplace products',
    add: 'Add Product', search: 'Search...', filter: 'Filter', refresh: 'Refresh',
    sku: 'SKU', name: 'Name', type: 'Type', status: 'Status',
    visibility: 'Visibility', modules: 'Modules', actions: 'Actions',
    edit: 'Edit', archive: 'Archive', duplicate: 'Duplicate', view: 'View',
    noProducts: 'No products found', loading: 'Loading...',
    confirmArchive: 'Are you sure you want to archive this product?',
    TYPE: { HARDWARE: 'Hardware', SOFTWARE: 'Software', DIGITAL: 'Digital', SERVICE: 'Service', SUBSCRIPTION: 'Subscription', LICENSE: 'License' } as Record<string, string>,
    STATUS: { DRAFT: 'Draft', ACTIVE: 'Active', ARCHIVED: 'Archived', OUT_OF_STOCK: 'Out of Stock' } as Record<string, string>,
    prev: 'Previous', next: 'Next', of: 'of',
    allTypes: 'All Types', allStatus: 'All Status',
  },
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-zinc-700 text-zinc-300',
  ACTIVE: 'bg-green-900 text-green-300',
  ARCHIVED: 'bg-red-900 text-red-400',
  OUT_OF_STOCK: 'bg-yellow-900 text-yellow-300',
}

const TYPE_COLOR: Record<string, string> = {
  HARDWARE: 'bg-blue-900 text-blue-300', SOFTWARE: 'bg-violet-900 text-violet-300',
  DIGITAL: 'bg-cyan-900 text-cyan-300', SERVICE: 'bg-orange-900 text-orange-300',
  SUBSCRIPTION: 'bg-emerald-900 text-emerald-300', LICENSE: 'bg-pink-900 text-pink-300',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [lang, setLang]       = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [data, setData]       = useState<ProductPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]       = useState(1)
  const [sortBy, setSortBy]   = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', sortBy, sortOrder })
      if (search)      params.set('search', search)
      if (typeFilter)  params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res  = await fetch(`/api/superadmin/marketplace/products?${params}`, { headers: header() })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }, [header, page, search, typeFilter, statusFilter, sortBy, sortOrder])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load(1) }, 300)
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [page, sortBy, sortOrder])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  function toggleSort(col: string) {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder('desc') }
  }

  async function archive(id: string) {
    if (!confirm(t.confirmArchive)) return
    await fetch(`/api/superadmin/marketplace/products/${id}/archive`, { method: 'POST', headers: header() })
    load()
  }

  async function duplicate(id: string) {
    await fetch(`/api/superadmin/marketplace/products/${id}/duplicate`, { method: 'POST', headers: header() })
    load()
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 text-zinc-600" />
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-zinc-400" /> : <ChevronDown className="w-3 h-3 text-zinc-400" />
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Package className="w-7 h-7 text-blue-400" />{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={() => load()} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <Link href="/superadmin/marketplace/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />{t.add}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-10 pe-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100">
          <option value="">{t.allTypes}</option>
          {['HARDWARE','SOFTWARE','DIGITAL','SERVICE','SUBSCRIPTION','LICENSE'].map(tp => (
            <option key={tp} value={tp}>{t.TYPE[tp]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100">
          <option value="">{t.allStatus}</option>
          {['DRAFT','ACTIVE','ARCHIVED','OUT_OF_STOCK'].map(s => (
            <option key={s} value={s}>{t.STATUS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                <th className="px-4 py-3 text-start">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-zinc-200">
                    {t.name} <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{t.sku}</th>
                <th className="px-4 py-3 text-start hidden lg:table-cell">{t.type}</th>
                <th className="px-4 py-3 text-start">{t.status}</th>
                <th className="px-4 py-3 text-start hidden xl:table-cell">{t.modules}</th>
                <th className="px-4 py-3 text-end">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
                </td></tr>
              ) : data?.products.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">{t.noProducts}</td></tr>
              ) : data?.products.map(p => (
                <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{p.name}</div>
                    <div className="text-xs text-zinc-500 md:hidden">{p.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLOR[p.type] ?? 'bg-zinc-700 text-zinc-300'}`}>{t.TYPE[p.type] ?? p.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[p.status] ?? 'bg-zinc-700 text-zinc-300'}`}>{t.STATUS[p.status] ?? p.status}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.supportedModules.slice(0,3).map(m => (
                        <span key={m} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/superadmin/marketplace/products/${p.id}`}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded"><Edit2 className="w-4 h-4" /></Link>
                      <button onClick={() => duplicate(p.id)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded"><Copy className="w-4 h-4" /></button>
                      {p.status !== 'ARCHIVED' && (
                        <button onClick={() => archive(p.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"><Archive className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between text-sm text-zinc-400">
            <span>{data.total} items · Page {data.page} {t.of} {data.pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-40">{t.prev}</button>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                className="px-3 py-1.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-40">{t.next}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
