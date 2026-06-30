'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ShoppingCart, Package, RefreshCw, CheckCircle, XCircle,
  Clock, Send, AlertTriangle, FileText, ChevronRight, Copy,
} from 'lucide-react'
import { useLang } from '../../../lang-context'

interface OrderItem {
  id: string; productId: string; sku: string; name: string
  quantity: number; unitPrice: number; discount: number; tax: number; total: number
}

interface Order {
  id: string; orderNumber: string; status: string; module: string
  total: number; subtotal: number; discount: number; tax: number
  notes?: string; rejectionReason?: string
  createdAt: string; updatedAt: string
  requestedBy: string; approvedBy?: string; currency: string
  items?: OrderItem[]
}

const T = {
  ar: {
    back: 'طلباتي', order: 'تفاصيل الطلب', status: 'الحالة', date: 'التاريخ',
    items: 'المنتجات', name: 'المنتج', qty: 'الكمية', price: 'السعر', total: 'الإجمالي',
    subtotal: 'المجموع', discount: 'الخصم', tax: 'الضريبة', grandTotal: 'الإجمالي الكلي',
    notes: 'الملاحظات', cancel: 'إلغاء الطلب', confirmCancel: 'هل تريد إلغاء هذا الطلب؟',
    loading: 'جاري التحميل...', notFound: 'الطلب غير موجود',
    reorder: 'إعادة الطلب', currency: 'د.م.',
    rejection: 'سبب الرفض',
    STATUS: {
      DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة',
      APPROVED:'معتمد', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز'
    } as Record<string,string>,
    timeline: {
      DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'مراجعة', APPROVED:'معتمد', FULFILLED:'مُنجز'
    } as Record<string,string>,
  },
  en: {
    back: 'My Orders', order: 'Order Details', status: 'Status', date: 'Date',
    items: 'Items', name: 'Product', qty: 'Qty', price: 'Unit Price', total: 'Total',
    subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', grandTotal: 'Grand Total',
    notes: 'Notes', cancel: 'Cancel Order', confirmCancel: 'Cancel this order?',
    loading: 'Loading...', notFound: 'Order not found',
    reorder: 'Reorder', currency: 'MAD',
    rejection: 'Rejection Reason',
    STATUS: {
      DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review',
      APPROVED:'Approved', REJECTED:'Rejected', CANCELLED:'Cancelled', FULFILLED:'Fulfilled'
    } as Record<string,string>,
    timeline: {
      DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Review', APPROVED:'Approved', FULFILLED:'Fulfilled'
    } as Record<string,string>,
  },
}

const STATUS_STYLE: Record<string,string> = {
  DRAFT:'bg-gray-700 text-gray-300', SUBMITTED:'bg-amber-900/50 text-amber-300',
  UNDER_REVIEW:'bg-blue-900/50 text-blue-300', APPROVED:'bg-emerald-900/50 text-emerald-300',
  REJECTED:'bg-red-900/50 text-red-300', CANCELLED:'bg-gray-800 text-gray-500',
  FULFILLED:'bg-emerald-900/30 text-emerald-400',
}
const TIMELINE_STEPS = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','FULFILLED']
const STEP_ICONS: Record<string,any> = {
  DRAFT: FileText, SUBMITTED: Send, UNDER_REVIEW: Clock, APPROVED: CheckCircle, FULFILLED: Package,
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }
function fmt(n: number, cur = 'د.م.') { return `${cur} ${n.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export default function OrderDetailPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [order,   setOrder]   = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/restaurant/marketplace/orders/${id}`, { headers: authHeader() })
      const data = await res.json()
      setOrder(data.order ?? null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (id) load() }, [id])

  const handleCancel = async () => {
    if (!confirm(t.confirmCancel)) return
    try {
      await fetch(`/api/restaurant/marketplace/orders/${id}/cancel`, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' } })
      showToast(lang === 'ar' ? 'تم الإلغاء' : 'Cancelled')
      load()
    } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error') }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">{t.notFound}</p>
        <Link href="/admin/marketplace/orders" className="mt-4 inline-block text-emerald-400 text-sm">{t.back}</Link>
      </div>
    )
  }

  const isTerminal   = ['REJECTED','CANCELLED'].includes(order.status)
  const canCancel    = ['DRAFT','SUBMITTED'].includes(order.status)
  const activeStepIdx = isTerminal ? -1 : TIMELINE_STEPS.indexOf(order.status)

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/marketplace/orders"
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors">
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{order.orderNumber}</h1>
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.DRAFT}`}>
            {t.STATUS[order.status] ?? order.status}
          </span>
          <button onClick={load} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        {isTerminal ? (
          <div className={`flex items-center gap-3 ${order.status === 'REJECTED' ? 'text-red-400' : 'text-gray-500'}`}>
            <XCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">{t.STATUS[order.status]}</p>
              {order.rejectionReason && (
                <p className="text-xs opacity-80 mt-0.5">{t.rejection}: {order.rejectionReason}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center">
            {TIMELINE_STEPS.map((step, i) => {
              const done    = i <= activeStepIdx
              const current = i === activeStepIdx
              const Icon    = STEP_ICONS[step]
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                      current ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : done   ? 'border-emerald-700 bg-emerald-900/30 text-emerald-500'
                      :          'border-gray-700 bg-gray-800 text-gray-600'
                    }`}>
                      {done && !current ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs text-center whitespace-nowrap ${current ? 'text-emerald-400 font-medium' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                      {t.timeline[step]}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 mb-5 rounded-full ${i < activeStepIdx ? 'bg-emerald-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Items ────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300">{t.items}</h2>
            </div>
            {!order.items || order.items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">{lang === 'ar' ? 'لا توجد منتجات' : 'No items'}</div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-3 px-5 py-2 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-gray-800">
                  <span className="col-span-2">{t.name}</span>
                  <span className="text-center">{t.qty}</span>
                  <span className="text-end">{t.price}</span>
                  <span className="text-end">{t.total}</span>
                </div>
                {order.items.map((item, i) => (
                  <div key={item.id} className={`grid grid-cols-5 gap-3 px-5 py-3 items-center ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                    <div className="col-span-2">
                      <Link href={`/admin/marketplace/products/${item.productId}`}
                        className="text-sm text-gray-200 hover:text-emerald-400 transition-colors font-medium line-clamp-1">{item.name}</Link>
                      <p className="text-xs text-gray-500 mt-0.5">{item.sku}</p>
                    </div>
                    <span className="text-sm text-gray-300 text-center">{item.quantity}</span>
                    <span className="text-sm text-gray-300 text-end">{fmt(item.unitPrice, t.currency)}</span>
                    <span className="text-sm font-semibold text-white text-end">{fmt(item.total, t.currency)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{t.notes}</p>
              <p className="text-sm text-gray-300">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <Link href={`/admin/marketplace/orders/new?reorder=${id}`}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition-colors">
              <Copy className="w-4 h-4" /> {t.reorder}
            </Link>
            {canCancel && (
              <button onClick={handleCancel}
                className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 px-4 py-2.5 rounded-xl text-sm transition-colors">
                <XCircle className="w-4 h-4" /> {t.cancel}
              </button>
            )}
          </div>
        </div>

        {/* ── Summary sidebar ───────────────────────────────────────────────────── */}
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 sticky top-20">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">{t.order}</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t.subtotal}</span>
              <span className="text-gray-200">{fmt(order.subtotal, t.currency)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t.discount}</span>
                <span className="text-emerald-400">−{fmt(order.discount, t.currency)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t.tax}</span>
                <span className="text-gray-200">{fmt(order.tax, t.currency)}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-3 flex justify-between">
              <span className="text-base font-bold text-white">{t.grandTotal}</span>
              <span className="text-base font-bold text-emerald-400">{fmt(order.total, t.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-emerald-700 text-white text-sm px-5 py-3 rounded-full shadow-xl">{toast}</div>
        </div>
      )}
    </div>
  )
}
