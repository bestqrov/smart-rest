'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, Package, RefreshCw, CheckCircle, XCircle, Clock, Send, AlertTriangle } from 'lucide-react'
import { useLang } from '../../../lang-context'

interface OrderItem {
  id: string; productId: string; sku: string; name: string
  quantity: number; unitPrice: number; discount: number; tax: number; total: number
}

interface Order {
  id: string; orderNumber: string; status: string; module: string
  total: number; subtotal: number; discount: number; tax: number
  notes?: string; createdAt: string; updatedAt: string
  requestedBy: string; approvedBy?: string; supplierId?: string; currency: string
}

const T = {
  ar: {
    back: 'رجوع', order: 'الطلب', status: 'الحالة', date: 'التاريخ',
    items: 'المنتجات', name: 'المنتج', qty: 'الكمية', price: 'السعر', total: 'الإجمالي',
    subtotal: 'المجموع', discount: 'الخصم', tax: 'الضريبة', grandTotal: 'الإجمالي الكلي',
    notes: 'الملاحظات', cancel: 'إلغاء الطلب', confirmCancel: 'هل تريد إلغاء هذا الطلب؟',
    loading: 'جاري التحميل...', notFound: 'الطلب غير موجود',
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
    back: 'Back', order: 'Order', status: 'Status', date: 'Date',
    items: 'Items', name: 'Product', qty: 'Qty', price: 'Price', total: 'Total',
    subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', grandTotal: 'Grand Total',
    notes: 'Notes', cancel: 'Cancel Order', confirmCancel: 'Are you sure you want to cancel this order?',
    loading: 'Loading...', notFound: 'Order not found',
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

const TIMELINE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'FULFILLED']

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token')}` } }

export default function OrderDetailPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar
  const { id } = useParams<{ id: string }>()

  const [order, setOrder]   = useState<Order | null>(null)
  const [items, setItems]   = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState('')

  function load() {
    setLoading(true)
    fetch(`/api/restaurant/marketplace/orders/${id}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { setOrder(d.order ?? null); setItems(d.items ?? []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function cancelOrder() {
    if (!confirm(t.confirmCancel)) return
    setActing(true)
    try {
      const res = await fetch(`/api/restaurant/marketplace/orders/${id}/cancel`, {
        method: 'POST', headers: authHeader(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessage('تم إلغاء الطلب')
      load()
    } catch (err: any) { setMessage(err.message) } finally { setActing(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
    </div>
  )
  if (!order) return (
    <div className="text-center py-20 text-gray-400">
      <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>{t.notFound}</p>
      <Link href="/admin/marketplace/orders" className="mt-4 inline-block text-emerald-600 text-sm">{t.back}</Link>
    </div>
  )

  const timelineIdx  = TIMELINE.indexOf(order.status)
  const isFinal      = ['REJECTED', 'CANCELLED', 'FULFILLED'].includes(order.status)
  const canCancel    = ['DRAFT', 'SUBMITTED'].includes(order.status)
  const currency     = order.currency ?? t.currency

  return (
    <div className="min-h-full p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/marketplace/orders" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800">{order.orderNumber}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB')}</p>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${t.BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {t.STATUS[order.status] ?? order.status}
        </span>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{message}</div>
      )}

      {/* Timeline */}
      {!['REJECTED','CANCELLED'].includes(order.status) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <div className="flex items-center">
            {TIMELINE.map((step, i) => {
              const done    = i < timelineIdx || (i === timelineIdx && step === 'FULFILLED')
              const current = i === timelineIdx
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                      done    ? 'border-emerald-500 bg-emerald-500' :
                      current ? 'border-emerald-500 bg-white' :
                                'border-gray-200 bg-white'
                    }`}>
                      {done && <CheckCircle className="w-4 h-4 text-white" />}
                      {current && !done && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                    </div>
                    <p className={`text-[10px] mt-1 text-center max-w-[56px] leading-tight ${current ? 'font-semibold text-emerald-600' : done ? 'text-gray-400' : 'text-gray-300'}`}>
                      {t.STATUS[step]}
                    </p>
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < timelineIdx ? 'bg-emerald-500' : 'bg-gray-100'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rejection / cancellation notice */}
      {(order.status === 'REJECTED' || order.status === 'CANCELLED') && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">{t.STATUS[order.status]}</p>
            {order.notes && <p className="text-sm text-red-600 mt-0.5">{order.notes}</p>}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {/* Items */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />{t.items}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-400">
                  <th className="px-5 py-3 text-start">{t.name}</th>
                  <th className="px-5 py-3 text-center w-16">{t.qty}</th>
                  <th className="px-5 py-3 text-end w-28">{t.price}</th>
                  <th className="px-5 py-3 text-end w-28">{t.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-700">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-5 py-3 text-end text-gray-600">{item.unitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-end font-bold text-gray-800">{item.total.toFixed(2)} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-3">
              <p className="text-xs font-semibold text-gray-400 mb-1">{t.notes}</p>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar: totals + actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4">{t.grandTotal}</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span>{t.subtotal}</span><span>{order.subtotal.toFixed(2)} {currency}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>{t.discount}</span><span>−{order.discount.toFixed(2)}</span></div>}
              {order.tax > 0     && <div className="flex justify-between"><span>{t.tax}</span><span>+{order.tax.toFixed(2)}</span></div>}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-gray-900 text-base">
              <span>{t.grandTotal}</span><span>{order.total.toFixed(2)} {currency}</span>
            </div>
          </div>

          {/* Cancel button */}
          {canCancel && (
            <button onClick={cancelOrder} disabled={acting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors disabled:opacity-40">
              {acting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {t.cancel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
