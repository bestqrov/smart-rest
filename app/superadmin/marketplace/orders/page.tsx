'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ClipboardList, RefreshCw, Search, Eye } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string; orderNumber: string; tenantId: string; module: string
  status: string; requestedBy: string; approvedBy?: string
  currency: string; total: number; createdAt: string
}
interface OrderPage { orders: Order[]; total: number; page: number; pages: number }

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الطلبات', subtitle: 'إدارة طلبات المارکت‌بليس',
    search: 'بحث برقم الطلب...', refresh: 'تحديث', loading: 'جاري التحميل...',
    orderNumber: 'رقم الطلب', module: 'الوحدة', status: 'الحالة',
    total: 'الإجمالي', date: 'التاريخ', actions: 'إجراءات', view: 'عرض',
    noOrders: 'لا توجد طلبات', prev: 'السابق', next: 'التالي', of: 'من',
    allStatus: 'كل الحالات', allModules: 'كل الوحدات',
    STATUS: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة', APPROVED:'موافق عليه', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز' } as Record<string, string>,
  },
  en: {
    title: 'Orders', subtitle: 'Manage marketplace orders',
    search: 'Search by order number...', refresh: 'Refresh', loading: 'Loading...',
    orderNumber: 'Order #', module: 'Module', status: 'Status',
    total: 'Total', date: 'Date', actions: 'Actions', view: 'View',
    noOrders: 'No orders found', prev: 'Previous', next: 'Next', of: 'of',
    allStatus: 'All Status', allModules: 'All Modules',
    STATUS: { DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review', APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled' } as Record<string, string>,
  },
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-zinc-700 text-zinc-300',
  SUBMITTED: 'bg-blue-900 text-blue-300',
  UNDER_REVIEW: 'bg-yellow-900 text-yellow-300',
  APPROVED: 'bg-green-900 text-green-300',
  REJECTED: 'bg-red-900 text-red-400',
  CANCELLED: 'bg-zinc-700 text-zinc-500',
  FULFILLED: 'bg-emerald-900 text-emerald-300',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [lang, setLang]         = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [data, setData]         = useState<OrderPage | null>(null)
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [page, setPage]         = useState(1)
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (moduleFilter) params.set('module', moduleFilter)
      const res  = await fetch(`/api/superadmin/marketplace/orders?${params}`, { headers: header() })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }, [header, page, statusFilter, moduleFilter])

  useEffect(() => { load() }, [statusFilter, moduleFilter])
  useEffect(() => { load() }, [page])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><ClipboardList className="w-7 h-7 text-sky-400" />{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={() => load()} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100">
          <option value="">{t.allStatus}</option>
          {Object.keys(t.STATUS).map(s => <option key={s} value={s}>{t.STATUS[s]}</option>)}
        </select>
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100">
          <option value="">{t.allModules}</option>
          {['RESTAURANT','HOTEL','CLINIC','RETAIL'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
              <th className="px-4 py-3 text-start">{t.orderNumber}</th>
              <th className="px-4 py-3 text-start hidden md:table-cell">{t.module}</th>
              <th className="px-4 py-3 text-start">{t.status}</th>
              <th className="px-4 py-3 text-start hidden lg:table-cell">{t.total}</th>
              <th className="px-4 py-3 text-start hidden xl:table-cell">{t.date}</th>
              <th className="px-4 py-3 text-end">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
              </td></tr>
            ) : data?.orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">{t.noOrders}</td></tr>
            ) : data?.orders.map(o => (
              <tr key={o.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-mono text-sm font-medium text-zinc-200">{o.orderNumber}</div>
                  <div className="text-xs text-zinc-500 md:hidden">{o.module}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{o.module}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[o.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                    {t.STATUS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-zinc-300">
                  {o.total.toLocaleString()} {o.currency}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-zinc-500 text-xs">
                  {new Date(o.createdAt).toLocaleDateString(isRTL ? 'ar' : 'en')}
                </td>
                <td className="px-4 py-3 text-end">
                  <Link href={`/superadmin/marketplace/orders/${o.id}`}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded inline-flex">
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
