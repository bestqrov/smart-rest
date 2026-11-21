'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Building2, Copy, Check, CreditCard, Loader2 } from 'lucide-react'

type Lang = 'ar' | 'fr' | 'en'
type Invoice = {
  invoiceNumber: string; cafeName: string; planId: string | null; amount: number; currency: string; status: string
  periodStart: string | null; periodEnd: string | null; dueAt: string | null; paidAt: string | null; transferRef: string | null
  payment: { bankName: string; accountHolder: string; iban: string; swift: string; instructions: string; bankConfigured: boolean; cardEnabled: boolean }
}

const T: Record<Lang, Record<string, string>> = {
  ar: { title: 'فاتورة اشتراك', invoice: 'رقم الفاتورة', plan: 'الخطة', period: 'الفترة', due: 'تاريخ الاستحقاق', ISSUED: 'بانتظار الدفع', PENDING_CONFIRMATION: 'تم الإبلاغ عن التحويل — بانتظار التأكيد', PAID: 'مدفوعة ✅', VOID: 'ملغاة', bank: 'تحويل بنكي', bankName: 'البنك', holder: 'صاحب الحساب', iban: 'IBAN', swift: 'SWIFT', refHint: 'استعمل رقم الفاتورة كمرجع للتحويل', report: 'أبلغنا بالتحويل', refLabel: 'مرجع التحويل', send: 'إرسال', card: 'ادفع بالبطاقة', noMethod: 'لا توجد طريقة دفع متاحة حالياً. تواصل مع الدعم.', copied: 'تم النسخ', checking: 'جاري التحقق من الدفع…', cardFailed: 'لم يكتمل الدفع بالبطاقة. حاول مرة أخرى.', notFound: 'الفاتورة غير موجودة', error: 'حدث خطأ، حاول مرة أخرى', yourRef: 'المرجع المُبلغ عنه', paidOn: 'تاريخ الدفع' },
  fr: { title: 'Facture d’abonnement', invoice: 'N° facture', plan: 'Formule', period: 'Période', due: 'Échéance', ISSUED: 'En attente de paiement', PENDING_CONFIRMATION: 'Virement signalé — en attente de confirmation', PAID: 'Payée ✅', VOID: 'Annulée', bank: 'Virement bancaire', bankName: 'Banque', holder: 'Titulaire', iban: 'IBAN', swift: 'SWIFT', refHint: 'Utilisez le numéro de facture comme référence', report: 'Signaler mon virement', refLabel: 'Référence du virement', send: 'Envoyer', card: 'Payer par carte', noMethod: 'Aucun moyen de paiement disponible. Contactez le support.', copied: 'Copié', checking: 'Vérification du paiement…', cardFailed: 'Le paiement par carte n’a pas abouti. Réessayez.', notFound: 'Facture introuvable', error: 'Une erreur est survenue', yourRef: 'Référence signalée', paidOn: 'Payée le' },
  en: { title: 'Subscription invoice', invoice: 'Invoice #', plan: 'Plan', period: 'Period', due: 'Due date', ISSUED: 'Awaiting payment', PENDING_CONFIRMATION: 'Transfer reported — awaiting confirmation', PAID: 'Paid ✅', VOID: 'Void', bank: 'Bank transfer', bankName: 'Bank', holder: 'Account holder', iban: 'IBAN', swift: 'SWIFT', refHint: 'Use the invoice number as the transfer reference', report: 'Report my transfer', refLabel: 'Transfer reference', send: 'Send', card: 'Pay by card', noMethod: 'No payment method is available right now. Please contact support.', copied: 'Copied', checking: 'Checking your payment…', cardFailed: 'The card payment did not complete. Please try again.', notFound: 'Invoice not found', error: 'Something went wrong', yourRef: 'Reported reference', paidOn: 'Paid on' },
}
const BADGE: Record<string, string> = {
  ISSUED: 'bg-amber-100 text-amber-800', PENDING_CONFIRMATION: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800', VOID: 'bg-gray-200 text-gray-600',
}

export default function PayInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const search = useSearchParams()
  const [lang, setLang] = useState<Lang>('ar')
  const t = T[lang]
  const [inv, setInv] = useState<Invoice | null>(null)
  const [err, setErr] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cardFailed, setCardFailed] = useState(false)
  const verified = useRef(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/billing/pay/${encodeURIComponent(token)}`)
    if (!r.ok) { setErr(r.status === 404 ? 'notFound' : 'error'); return null }
    const d: Invoice = await r.json(); setInv(d); setErr(''); return d
  }, [token])

  useEffect(() => { load() }, [load])

  // Returning from Tap: verify, polling a few times while not PAID.
  useEffect(() => {
    if (search.get('check') !== '1' || verified.current) return
    verified.current = true
    setChecking(true)
    ;(async () => {
      let status = ''
      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch(`/api/billing/pay/${encodeURIComponent(token)}/card/verify`, { method: 'POST' })
          status = (await r.json())?.status ?? ''
        } catch { /* retry */ }
        if (status === 'PAID' || status === 'FAILED') break
        await new Promise(res => setTimeout(res, 2500))
      }
      if (status !== 'PAID') setCardFailed(true)
      await load(); setChecking(false)
    })()
  }, [search, token, load])

  async function reportTransfer(e: React.FormEvent) {
    e.preventDefault(); if (!ref.trim()) return
    setBusy(true)
    const r = await fetch(`/api/billing/pay/${encodeURIComponent(token)}/report-transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: ref.trim() }) })
    if (!r.ok) setErr('error')
    await load(); setBusy(false)
  }

  async function startCard() {
    setBusy(true); setCardFailed(false)
    const r = await fetch(`/api/billing/pay/${encodeURIComponent(token)}/card/start`, { method: 'POST' })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.redirectUrl) { window.location.href = d.redirectUrl; return }
    setErr('error'); setBusy(false)
  }

  function copyIban() {
    if (!inv) return
    navigator.clipboard?.writeText(inv.payment.iban).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  const loc = lang === 'ar' ? 'ar-MA' : lang
  const d = (s: string | null) => s ? new Date(s).toLocaleDateString(loc) : '—'

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex justify-end gap-1 text-xs">
          {(['ar', 'fr', 'en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 rounded-md ${lang === l ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l.toUpperCase()}</button>
          ))}
        </div>

        {!inv && !err && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}
        {err && !inv && <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-600">{t[err]}</div>}

        {inv && (<>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div>
              <p className="text-xs text-slate-500">{t.title}</p>
              <h1 className="text-lg font-bold">{inv.cafeName}</h1>
            </div>
            <div className="text-center py-2">
              <div className="text-4xl font-extrabold tracking-tight" dir="ltr">{inv.amount.toLocaleString(loc)} <span className="text-xl font-bold text-slate-500">{inv.currency}</span></div>
              <span className={`inline-block mt-3 px-3 py-1 rounded-full text-sm font-semibold ${BADGE[inv.status] ?? 'bg-gray-100'}`}>{t[inv.status] ?? inv.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">{t.invoice}</dt><dd className="font-mono font-semibold" dir="ltr">{inv.invoiceNumber}</dd>
              {inv.planId && <><dt className="text-slate-500">{t.plan}</dt><dd className="font-semibold">{inv.planId}</dd></>}
              <dt className="text-slate-500">{t.period}</dt><dd>{d(inv.periodStart)} – {d(inv.periodEnd)}</dd>
              <dt className="text-slate-500">{t.due}</dt><dd>{d(inv.dueAt)}</dd>
              {inv.paidAt && <><dt className="text-slate-500">{t.paidOn}</dt><dd>{d(inv.paidAt)}</dd></>}
              {inv.transferRef && <><dt className="text-slate-500">{t.yourRef}</dt><dd className="font-mono" dir="ltr">{inv.transferRef}</dd></>}
            </dl>
          </div>

          {checking && <div className="bg-blue-50 text-blue-800 rounded-xl p-3 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t.checking}</div>}
          {cardFailed && !checking && inv.status !== 'PAID' && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{t.cardFailed}</div>}
          {err && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{t[err]}</div>}

          {inv.status === 'ISSUED' && !checking && (<>
            {inv.payment.cardEnabled && (
              <button onClick={startCard} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-4">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}{t.card}
              </button>
            )}
            {inv.payment.bankConfigured && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <h2 className="font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-slate-500" />{t.bank}</h2>
                <dl className="text-sm space-y-2">
                  {inv.payment.bankName && <div className="flex justify-between gap-2"><dt className="text-slate-500">{t.bankName}</dt><dd className="font-semibold">{inv.payment.bankName}</dd></div>}
                  <div className="flex justify-between gap-2"><dt className="text-slate-500">{t.holder}</dt><dd className="font-semibold">{inv.payment.accountHolder}</dd></div>
                  <div>
                    <dt className="text-slate-500 mb-1">{t.iban}</dt>
                    <dd className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span dir="ltr" className="font-mono text-sm break-all flex-1 text-left">{inv.payment.iban}</span>
                      <button type="button" onClick={copyIban} className="shrink-0 text-slate-500 hover:text-slate-900" aria-label="copy">{copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}</button>
                    </dd>
                  </div>
                  {inv.payment.swift && <div className="flex justify-between gap-2"><dt className="text-slate-500">{t.swift}</dt><dd className="font-mono" dir="ltr">{inv.payment.swift}</dd></div>}
                </dl>
                {inv.payment.instructions && <p className="text-sm text-slate-600 whitespace-pre-line">{inv.payment.instructions}</p>}
                <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">{t.refHint}: <b dir="ltr" className="font-mono">{inv.invoiceNumber}</b></p>
                <form onSubmit={reportTransfer} className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-sm font-semibold">{t.report}</label>
                  <div className="flex gap-2">
                    <input value={ref} onChange={e => setRef(e.target.value)} maxLength={80} placeholder={t.refLabel} dir="ltr" className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <button disabled={busy || !ref.trim()} className="rounded-lg bg-slate-900 text-white px-4 text-sm font-semibold disabled:opacity-50">{t.send}</button>
                  </div>
                </form>
              </div>
            )}
            {!inv.payment.cardEnabled && !inv.payment.bankConfigured && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-600 text-center">{t.noMethod}</div>
            )}
          </>)}
        </>)}
      </div>
    </div>
  )
}
