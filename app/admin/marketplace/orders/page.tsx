'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, RefreshCw, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '../../lang-context'

interface Order {
  id: string; orderNumber: string; status: string; module: string
  total: number; createdAt: string; notes?: string
}

const T = {
  ar: {
    title: 'طلباتي', newOrder: 'طلب جديد', refresh: 'تحديث',
    order: 'الطلب', status: 'الحالة', total: 'الإجمالي', date: 'التاريخ', view: 'عرض',
    noOrders: 'لا توجد طلبات بعد', all: 'الكل',
    prev: 'السابق', next: 'التالي', of: 'من',
    currency: 'د.م.',
    STATUS: {
      DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة',
      APPROVED:'معتمد', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز'
    } as Record<string,string>,
    BADGE: {
      DRAFT:'bg-gray-100 text-gray-600', SUBMITTED:'bg-amber-100 text-amber-700',
      UNDER_REVIEW:'bg-blue-100 text-blue-700', APPROVED:'bg-emerald-100 text-emerald-700',
      REJECTED:'bg-red-100 text-red-700', CANCELLED:'bg-red-50 text-red-500',
      FULFILLED:'bg-emerald-50 text-emerald-600'
    } as Record<string,string>,
  },
  en: {
    title: 'My Orders', newOrder: 'New Order', refresh: 'Refresh',
    order: 'Order', status: 'Status', total: 'Total', date: 'Date', view: 'View',
    noOrders: 'No orders yet', all: 'All',
    prev: 'Prev', next: 'Next', of: 'of',
    currency: 'MAD',
    STATUS: {
      DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review',
      APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled'
    } as Record<string,string>,
    BADGE: {
      DRAFT:'bg-gray-100 text-gray-600', SUBMITTED:'bg-amber-100 text-amber-700',
      UNDER_REVIEW:'bg-blue-100 text-blue-700', APPROVED:'bg-emerald-100 text-emerald-700',
      REJECTED:'bg-red-100 text-red-700', CANCELLED:'bg-red-50 text-red-500',
      FULFILLED:'bg-emerald-50 text-emerald-600'
    } as Record<string,string>,
  },
}

const STATUSES = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED','FULFILLED']

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

export default function OrdersPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [orders, setOrders]   = useState<Order[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)
  const LIMIT = 15

  const load = useCallback(async (pg = 1, st = '') => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (st) qs.set('status', st)
      const res  = await fetch(`/api/restaurant/marketplace/orders?${qs}`, { headers: authHeader() })
      const json = await res.json()
      setOrders(json.orders ?? [])
      setTotal(json.total ?? 0)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1, status) }, [status])

  const totalPages = Math.ceil(total / LIMIT)
  const currency   = t.currency

  return (
    <div className="min-h-full p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />{t.title}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => load(page, status)} disabled={loading}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/admin/marketplace/orders/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700">
            <Plus className="w-4 h-4" />{t.newOrder}
          </Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => { setStatus(''); setPage(1) }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${!status ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          {t.all}
        </button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${status === s ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t.STATUS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t.noOrders}</p>
          <Link href="/admin/marketplace/orders/new"
            className="mt-4 inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
            <Plus className="w-4 h-4" />{t.newOrder}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-xs text-gray-400">
                <th className="px-4 py-3 text-start">{t.order}</th>
                <th className="px-4 py-3 text-start hidden sm:table-cell">{t.date}</th>
                <th className="px-4 py-3 text-center">{t.status}</th>
                <th className="px-4 py-3 text-end">{t.total}</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-700">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                    {new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.STATUS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-gray-800">
                    {order.total.toFixed(2)} {currency}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/admin/marketplace/orders/${order.id}`}
                      className="text-xs text-emerald-600 font-medium hover:underline">{t.view}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => { setPage(p => p - 1); load(page - 1, status) }} disabled={page === 1}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page} {t.of} {totalPages}</span>
          <button onClick={() => { setPage(p => p + 1); load(page + 1, status) }} disabled={page === totalPages}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
