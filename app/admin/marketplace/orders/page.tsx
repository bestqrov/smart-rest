'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ShoppingCart, RefreshCw, Plus, ChevronLeft, ChevronRight,
  Clock, CheckCircle, XCircle, Send, FileText, Package, Search,
  Grid3X3, List, Calendar,
} from 'lucide-react'
import { useLang } from '../../lang-context'

interface Order {
  id: string; orderNumber: string; status: string; module: string
  total: number; createdAt: string; notes?: string; itemCount?: number
}

const T = {
  ar: {
    title: 'طلباتي', newOrder: 'طلب جديد', refresh: 'تحديث',
    order: 'الطلب رقم', status: 'الحالة', total: 'الإجمالي', date: 'التاريخ',
    items: 'منتجات', view: 'عرض',
    noOrders: 'لا توجد طلبات', noOrdersHint: 'ابدأ بإنشاء طلب شراء جديد',
    all: 'الكل', search: 'ابحث عن طلب...', from: 'من', to: 'إلى',
    prev: 'السابق', next: 'التالي', of: 'من',
    currency: 'د.م.', timelineView: 'عرض الجدول الزمني', listView: 'عرض القائمة',
    timeline: {
      DRAFT: 'مسودة', SUBMITTED: 'مُرسل', UNDER_REVIEW: 'قيد المراجعة',
      APPROVED: 'معتمد', REJECTED: 'مرفوض', FULFILLED: 'مُنجز', CANCELLED: 'ملغى',
    } as Record<string,string>,
    STATUS: {
      DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة',
      APPROVED:'معتمد', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز'
    } as Record<string,string>,
  },
  en: {
    title: 'My Orders', newOrder: 'New Order', refresh: 'Refresh',
    order: 'Order', status: 'Status', total: 'Total', date: 'Date',
    items: 'items', view: 'View',
    noOrders: 'No orders yet', noOrdersHint: 'Start by creating a new purchase order',
    all: 'All', search: 'Search orders...', from: 'From', to: 'To',
    prev: 'Prev', next: 'Next', of: 'of',
    currency: 'MAD', timelineView: 'Timeline View', listView: 'List View',
    timeline: {
      DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved', REJECTED: 'Rejected', FULFILLED: 'Fulfilled', CANCELLED: 'Cancelled',
    } as Record<string,string>,
    STATUS: {
      DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review',
      APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled'
    } as Record<string,string>,
  },
}

const STATUSES = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED','FULFILLED']

const STATUS_STYLE: Record<string,string> = {
  DRAFT:       'bg-gray-700/60 text-gray-300',
  SUBMITTED:   'bg-amber-900/50 text-amber-300',
  UNDER_REVIEW:'bg-blue-900/50 text-blue-300',
  APPROVED:    'bg-emerald-900/50 text-emerald-300',
  REJECTED:    'bg-red-900/50 text-red-300',
  CANCELLED:   'bg-gray-800 text-gray-500',
  FULFILLED:   'bg-emerald-900/30 text-emerald-400',
}

const STATUS_ICON: Record<string,any> = {
  DRAFT: FileText, SUBMITTED: Send, UNDER_REVIEW: Clock,
  APPROVED: CheckCircle, REJECTED: XCircle, CANCELLED: XCircle, FULFILLED: Package,
}

// Timeline steps (ordered progression)
const TIMELINE_STEPS = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','FULFILLED']

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }
function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

function TimelineCard({ order, t }: { order: Order; t: typeof T.ar }) {
  const isTerminal = ['REJECTED','CANCELLED'].includes(order.status)
  const activeIdx  = isTerminal ? -1 : TIMELINE_STEPS.indexOf(order.status)
  const StatusIcon = STATUS_ICON[order.status] ?? Clock

  return (
    <Link href={`/admin/marketplace/orders/${order.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{new Date(order.createdAt).toLocaleDateString(t.currency === 'د.م.' ? 'ar-MA' : 'en-GB')}</p>
          <h3 className="text-sm font-semibold text-gray-100">{order.orderNumber}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.DRAFT}`}>
            {t.STATUS[order.status] ?? order.status}
          </span>
          <span className="text-sm font-bold text-white">{fmt(order.total, t.currency)}</span>
        </div>
      </div>

      {/* Timeline bar */}
      {isTerminal ? (
        <div className={`flex items-center gap-2 text-xs ${order.status === 'REJECTED' ? 'text-red-400' : 'text-gray-500'}`}>
          <XCircle className="w-3.5 h-3.5" />
          {t.STATUS[order.status]}
          {order.notes && <span className="text-gray-500 truncate"> · {order.notes}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-0">
          {TIMELINE_STEPS.map((step, i) => {
            const done    = i <= activeIdx
            const current = i === activeIdx
            const Icon    = STATUS_ICON[step] ?? Clock
            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                {/* Step circle */}
                <div className={`flex flex-col items-center gap-1 shrink-0`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    current ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : done   ? 'border-emerald-700 bg-emerald-900/40 text-emerald-500'
                    :          'border-gray-700 bg-gray-800 text-gray-600'
                  }`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className={`text-xs whitespace-nowrap ${current ? 'text-emerald-400' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t.timeline[step]}
                  </span>
                </div>
                {/* Connector line */}
                {i < TIMELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < activeIdx ? 'bg-emerald-700' : 'bg-gray-700'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}

export default function OrdersPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [orders,  setOrders]  = useState<Order[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<'timeline' | 'list'>('timeline')

  const [status,  setStatus]  = useState('')
  const [search,  setSearch]  = useState('')
  const [dateFrom,setDateFrom]= useState('')
  const [dateTo,  setDateTo]  = useState('')

  const limit = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (status)   q.set('status', status)
      if (search)   q.set('q', search)
      if (dateFrom) q.set('from', dateFrom)
      if (dateTo)   q.set('to', dateTo)
      q.set('page', String(page))
      q.set('limit', String(limit))
      const res  = await fetch(`/api/restaurant/marketplace/orders?${q}`, { headers: authHeader() })
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch {}
    setLoading(false)
  }, [status, search, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">{t.title}</h1>
          {total > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{total}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-700 rounded-xl overflow-hidden">
            <button onClick={() => setView('timeline')}
              className={`px-3 py-2 text-xs transition-colors ${view === 'timeline' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-2 text-xs border-s border-gray-700 transition-colors ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/admin/marketplace/orders/new"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> {t.newOrder}
          </Link>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.search}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl ps-9 pe-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
        </div>
        {/* Date from */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500" />
        </div>
        <span className="text-gray-600 self-center">—</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500" />
      </div>

      {/* ── Status Chips ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setStatus(''); setPage(1) }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!status ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
          {t.all}
        </button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? 'bg-emerald-700 text-white' : `${STATUS_STYLE[s]} hover:opacity-80`}`}>
            {t.STATUS[s]}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className={view === 'timeline' ? 'grid md:grid-cols-2 gap-4' : 'space-y-3'}>
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className={view === 'timeline' ? 'h-36' : 'h-16'} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t.noOrders}</p>
          <p className="text-gray-600 text-xs mt-1">{t.noOrdersHint}</p>
          <Link href="/admin/marketplace/orders/new"
            className="mt-4 inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" /> {t.newOrder}
          </Link>
        </div>
      ) : view === 'timeline' ? (
        <div className="grid md:grid-cols-2 gap-4">
          {orders.map(o => <TimelineCard key={o.id} order={o} t={t} />)}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-5 py-2.5 border-b border-gray-800 text-xs text-gray-500 font-medium uppercase tracking-wide">
            <span className="col-span-2">{t.order}</span>
            <span>{t.status}</span>
            <span>{t.date}</span>
            <span className="text-end">{t.total}</span>
          </div>
          {orders.map((o, i) => {
            const StatusIcon = STATUS_ICON[o.status] ?? Clock
            return (
              <Link key={o.id} href={`/admin/marketplace/orders/${o.id}`}
                className={`grid grid-cols-5 gap-4 px-5 py-3.5 hover:bg-gray-800/60 transition-colors ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                <div className="col-span-2 flex items-center gap-2">
                  <StatusIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-sm text-gray-200 font-medium">{o.orderNumber}</span>
                </div>
                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT}`}>
                    {t.STATUS[o.status] ?? o.status}
                  </span>
                </div>
                <span className="text-sm text-gray-400 self-center">
                  {new Date(o.createdAt).toLocaleDateString(t.currency === 'د.م.' ? 'ar-MA' : 'en-GB')}
                </span>
                <span className="text-sm font-bold text-white text-end self-center">{fmt(o.total, t.currency)}</span>
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
