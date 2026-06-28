'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Check, X, Package2, Clock } from 'lucide-react'
import { useSAAuth } from '../../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string; orderNumber: string; tenantId: string; module: string; status: string
  requestedBy: string; approvedBy?: string; supplierId?: string
  currency: string; subtotal: number; discount: number; tax: number; total: number
  notes?: string; createdAt: string; updatedAt: string
}
interface OrderItem {
  id: string; orderId: string; productId: string; sku: string; name: string
  quantity: number; unitPrice: number; discount: number; tax: number; total: number; createdAt: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    back: 'العودة', refresh: 'تحديث', loading: 'جاري التحميل...', notFound: 'الطلب غير موجود',
    orderDetails: 'تفاصيل الطلب', items: 'المنتجات', timeline: 'المراحل',
    approve: 'موافقة', reject: 'رفض', fulfill: 'تنفيذ', review: 'مراجعة',
    confirmApprove: 'هل أنت متأكد من الموافقة؟', confirmReject: 'هل أنت متأكد من الرفض؟',
    confirmFulfill: 'هل أنت متأكد من التنفيذ؟', rejectReason: 'سبب الرفض (اختياري)',
    sku: 'الرمز', name: 'الاسم', qty: 'الكمية', unitPrice: 'سعر الوحدة',
    discount: 'خصم', tax: 'ضريبة', total: 'الإجمالي',
    subtotal: 'المجموع الفرعي', orderDiscount: 'خصم الطلب', orderTax: 'ضريبة الطلب',
    orderTotal: 'إجمالي الطلب', currency: 'العملة', module: 'الوحدة',
    requestedBy: 'طُلب بواسطة', approvedBy: 'وُفِّق بواسطة', createdAt: 'تاريخ الإنشاء',
    STATUS: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'قيد المراجعة', APPROVED:'موافق عليه', REJECTED:'مرفوض', CANCELLED:'ملغى', FULFILLED:'مُنجز' } as Record<string, string>,
  },
  en: {
    back: 'Back', refresh: 'Refresh', loading: 'Loading...', notFound: 'Order not found',
    orderDetails: 'Order Details', items: 'Items', timeline: 'Timeline',
    approve: 'Approve', reject: 'Reject', fulfill: 'Fulfill', review: 'Mark as Under Review',
    confirmApprove: 'Approve this order?', confirmReject: 'Reject this order?',
    confirmFulfill: 'Mark this order as fulfilled?', rejectReason: 'Reject reason (optional)',
    sku: 'SKU', name: 'Name', qty: 'Qty', unitPrice: 'Unit Price',
    discount: 'Discount', tax: 'Tax', total: 'Total',
    subtotal: 'Subtotal', orderDiscount: 'Order Discount', orderTax: 'Tax',
    orderTotal: 'Order Total', currency: 'Currency', module: 'Module',
    requestedBy: 'Requested By', approvedBy: 'Approved By', createdAt: 'Created',
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

const TIMELINE = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','FULFILLED']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const [lang, setLang]     = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [order, setOrder]   = useState<Order | null>(null)
  const [items, setItems]   = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const t = T[lang]
  const isRTL = lang === 'ar'
  const id = String(params.id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/superadmin/marketplace/orders/${id}`, { headers: header() })
      const json = await res.json()
      setOrder(json.order ?? null)
      setItems(json.items ?? [])
    } finally { setLoading(false) }
  }, [header, id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  async function action(endpoint: string, body?: Record<string, unknown>) {
    setActing(true)
    try {
      await fetch(`/api/superadmin/marketplace/orders/${id}/${endpoint}`, {
        method:  'POST',
        headers: { ...header(), 'Content-Type': 'application/json' },
        body:    body ? JSON.stringify(body) : undefined,
      })
      load()
    } finally { setActing(false) }
  }

  if (!order && !loading) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">{t.notFound}</p>
          <Link href="/superadmin/marketplace/orders" className="text-sky-400 hover:underline">{t.back}</Link>
        </div>
      </div>
    )
  }

  const statusIdx = order ? TIMELINE.indexOf(order.status) : -1

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/superadmin/marketplace/orders" className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">{order?.orderNumber ?? '...'}</h1>
            {order && (
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[order.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                {t.STATUS[order.status] ?? order.status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button onClick={load} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {loading && !order ? (
        <div className="flex items-center gap-3 text-zinc-400 py-20 justify-center">
          <RefreshCw className="w-5 h-5 animate-spin" />{t.loading}
        </div>
      ) : order && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold text-zinc-200 mb-4">{t.timeline}</h2>
              <div className="flex items-center gap-0">
                {TIMELINE.map((s, i) => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`flex flex-col items-center gap-1 flex-1 ${i === 0 ? 'items-start' : i === TIMELINE.length-1 ? 'items-end' : 'items-center'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        i < statusIdx ? 'bg-emerald-700 border-emerald-500 text-white' :
                        i === statusIdx ? 'bg-sky-700 border-sky-500 text-white' :
                        'bg-zinc-800 border-zinc-700 text-zinc-500'
                      }`}>{i + 1}</div>
                      <span className={`text-xs hidden md:block ${i === statusIdx ? 'text-sky-400' : i < statusIdx ? 'text-emerald-400' : 'text-zinc-600'}`}>
                        {t.STATUS[s]}
                      </span>
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${i < statusIdx ? 'bg-emerald-700' : 'bg-zinc-700'}`} />
                    )}
                  </div>
                ))}
              </div>
              {order.status === 'REJECTED' && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                  Status: REJECTED
                </div>
              )}
              {order.status === 'CANCELLED' && (
                <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-sm text-zinc-400">Status: CANCELLED</div>
              )}
            </div>

            {/* Action buttons */}
            {!['REJECTED','CANCELLED','FULFILLED'].includes(order.status) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex flex-wrap gap-3">
                  {order.status === 'SUBMITTED' && (
                    <button onClick={() => action('review')} disabled={acting}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-sm font-medium disabled:opacity-50">
                      <Clock className="w-4 h-4" />{t.review}
                    </button>
                  )}
                  {order.status === 'UNDER_REVIEW' && (
                    <>
                      <button onClick={() => { if (confirm(t.confirmApprove)) action('approve') }} disabled={acting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-medium disabled:opacity-50">
                        <Check className="w-4 h-4" />{t.approve}
                      </button>
                      <button onClick={() => setShowRejectBox(s => !s)} disabled={acting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium disabled:opacity-50">
                        <X className="w-4 h-4" />{t.reject}
                      </button>
                    </>
                  )}
                  {order.status === 'APPROVED' && (
                    <button onClick={() => { if (confirm(t.confirmFulfill)) action('fulfill') }} disabled={acting}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium disabled:opacity-50">
                      <Package2 className="w-4 h-4" />{t.fulfill}
                    </button>
                  )}
                </div>
                {showRejectBox && (
                  <div className="mt-4 space-y-2">
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      placeholder={t.rejectReason} rows={2}
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
                    <button onClick={() => { if (confirm(t.confirmReject)) { action('reject', { reason: rejectReason }); setShowRejectBox(false) } }}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium">
                      {t.reject}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Items table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="font-semibold text-zinc-200">{t.items} ({items.length})</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                    <th className="px-4 py-3 text-start">{t.name}</th>
                    <th className="px-4 py-3 text-center">{t.qty}</th>
                    <th className="px-4 py-3 text-end hidden md:table-cell">{t.unitPrice}</th>
                    <th className="px-4 py-3 text-end hidden lg:table-cell">{t.discount}</th>
                    <th className="px-4 py-3 text-end">{t.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-200">{item.name}</div>
                        <div className="text-xs font-mono text-zinc-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-end text-zinc-300 hidden md:table-cell">{item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-end text-zinc-400 hidden lg:table-cell">{item.discount}%</td>
                      <td className="px-4 py-3 text-end font-medium text-zinc-200">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold text-zinc-200 mb-4">{t.orderDetails}</h2>
              <div className="space-y-3 text-sm">
                {[
                  { label: t.module,      value: order.module },
                  { label: t.currency,    value: order.currency },
                  { label: t.requestedBy, value: order.requestedBy },
                  { label: t.approvedBy,  value: order.approvedBy ?? '—' },
                  { label: t.createdAt,   value: new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar' : 'en') },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-zinc-400">{label}</span>
                    <span className="text-zinc-200 text-end max-w-[160px] truncate">{value}</span>
                  </div>
                ))}
                {order.notes && (
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-zinc-400 text-xs mb-1">Notes</p>
                    <p className="text-zinc-300 text-sm">{order.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="space-y-2 text-sm">
                {[
                  { label: t.subtotal,      value: order.subtotal },
                  { label: t.orderDiscount, value: -order.discount },
                  { label: t.orderTax,      value: order.tax },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-zinc-400">
                    <span>{label}</span>
                    <span>{value.toLocaleString()} {order.currency}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between font-bold text-zinc-100 border-t border-zinc-800 pt-2 mt-2">
                  <span>{t.orderTotal}</span>
                  <span className="text-lg">{order.total.toLocaleString()} {order.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
