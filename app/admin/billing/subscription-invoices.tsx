'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useLang, type AdminLang } from '../lang-context'

type Inv = { invoiceNumber: string; amount: number; currency: string; status: string; issuedAt: string; dueAt: string | null; paidAt: string | null; periodStart: string | null; periodEnd: string | null; payToken: string }
type Resp = { suspended: boolean; planId: string | null; nextInvoiceAt: string | null; invoices: Inv[] }

const T: Record<AdminLang, Record<string, string>> = {
  ar: { title: 'اشتراكي وفواتيري', plan: 'الخطة', next: 'الفاتورة القادمة', none: 'لا توجد فواتير بعد', number: 'رقم الفاتورة', period: 'الفترة', amount: 'المبلغ', status: 'الحالة', due: 'تاريخ الاستحقاق', pay: 'ادفع الآن', suspended: 'الاشتراك موقوف بسبب فاتورة غير مدفوعة', ISSUED: 'بانتظار الدفع', PENDING_CONFIRMATION: 'بانتظار التأكيد', PAID: 'مدفوعة', VOID: 'ملغاة' },
  fr: { title: 'Mon abonnement et mes factures', plan: 'Formule', next: 'Prochaine facture', none: 'Aucune facture pour le moment', number: 'N° facture', period: 'Période', amount: 'Montant', status: 'Statut', due: 'Échéance', pay: 'Payer', suspended: 'Abonnement suspendu pour facture impayée', ISSUED: 'En attente de paiement', PENDING_CONFIRMATION: 'En attente de confirmation', PAID: 'Payée', VOID: 'Annulée' },
  en: { title: 'My subscription & invoices', plan: 'Plan', next: 'Next invoice', none: 'No invoices yet', number: 'Invoice #', period: 'Period', amount: 'Amount', status: 'Status', due: 'Due date', pay: 'Pay now', suspended: 'Subscription suspended for an unpaid invoice', ISSUED: 'Awaiting payment', PENDING_CONFIRMATION: 'Awaiting confirmation', PAID: 'Paid', VOID: 'Void' },
  es: { title: 'Mi suscripción y facturas', plan: 'Plan', next: 'Próxima factura', none: 'Aún no hay facturas', number: 'N.º factura', period: 'Periodo', amount: 'Importe', status: 'Estado', due: 'Vencimiento', pay: 'Pagar ahora', suspended: 'Suscripción suspendida por factura impaga', ISSUED: 'Pendiente de pago', PENDING_CONFIRMATION: 'Pendiente de confirmación', PAID: 'Pagada', VOID: 'Anulada' },
}
const BADGE: Record<string, string> = {
  ISSUED: 'bg-amber-100 text-amber-700', PENDING_CONFIRMATION: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700', VOID: 'bg-gray-100 text-gray-500',
}

export default function SubscriptionInvoices() {
  const { lang } = useLang()
  const t = T[lang] ?? T.ar
  const [data, setData] = useState<Resp | null>(null)

  useEffect(() => {
    fetch('/api/admin/subscription-invoices', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null).then(setData).catch(() => {})
  }, [])

  if (!data?.planId) return null
  const loc = lang === 'ar' ? 'ar-MA' : lang
  const d = (s: string | null) => s ? new Date(s).toLocaleDateString(loc) : '—'

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />{t.title}</h2>
        <div className="text-sm text-gray-600 flex gap-4">
          <span>{t.plan}: <b className="text-gray-900">{data.planId}</b></span>
          <span>{t.next}: <b className="text-gray-900">{d(data.nextInvoiceAt)}</b></span>
        </div>
      </div>
      {data.suspended && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{t.suspended}</div>}
      {data.invoices.length === 0 ? <p className="text-sm text-gray-500">{t.none}</p> : (
        <div className="divide-y divide-gray-100">
          {data.invoices.map(i => (
            <div key={i.invoiceNumber} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono font-semibold text-gray-900" dir="ltr">{i.invoiceNumber}</span>
              <span className="text-gray-500">{t.period}: {d(i.periodStart)} – {d(i.periodEnd)}</span>
              <span className="font-bold" dir="ltr">{i.amount} {i.currency}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[i.status] ?? 'bg-gray-100 text-gray-600'}`}>{t[i.status] ?? i.status}</span>
              <span className="text-gray-500">{t.due}: {d(i.dueAt)}</span>
              {i.status === 'ISSUED' && (
                <Link href={`/billing/pay/${i.payToken}`} className="ms-auto rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 font-semibold">{t.pay}</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
