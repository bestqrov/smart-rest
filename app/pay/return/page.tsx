'use client'
/**
 * /pay/return?p=<payId> — customer lands here after the restaurant's gateway
 * (Tap / Moyasar / Stripe). The server re-checks the payment with the provider;
 * nothing in this URL is trusted.
 */

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'checking' | 'PAID' | 'FAILED' | 'EXPIRED' | 'PENDING' | 'error'

const TXT = {
  ar: {
    checking: 'جارٍ تأكيد الدفع…',
    PAID:     'تم الدفع بنجاح ✅',
    paidSub:  'شكراً لك! تم إبلاغ المطعم.',
    FAILED:   'لم يتم الدفع',
    failSub:  'لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى أو الدفع للنادل.',
    EXPIRED:  'انتهت صلاحية عملية الدفع',
    PENDING:  'الدفع قيد المعالجة',
    pendSub:  'قد يستغرق التأكيد لحظات. سيصل التحديث للمطعم تلقائياً.',
    error:    'تعذّر التحقق من الدفع',
    back:     'العودة إلى الطاولة',
    receipt:  'أرسل الإيصال على واتساب',
    phonePh:  'رقم واتساب (مثال ‎+9665…)',
    send:     'إرسال',
    sent:     'تم إرسال الإيصال ✅',
    badPhone: 'رقم غير صحيح، استعمل الصيغة الدولية',
    already:  'تم إرسال الإيصال مسبقاً',
    sendErr:  'تعذّر الإرسال، حاول لاحقاً',
  },
  en: {
    checking: 'Confirming your payment…',
    PAID:     'Payment successful ✅',
    paidSub:  'Thank you! The restaurant has been notified.',
    FAILED:   'Payment not completed',
    failSub:  'You were not charged. Try again or pay the waiter.',
    EXPIRED:  'Payment session expired',
    PENDING:  'Payment is processing',
    pendSub:  'Confirmation can take a moment. The restaurant will be updated automatically.',
    error:    'Could not verify the payment',
    back:     'Back to the table',
    receipt:  'Send receipt to WhatsApp',
    phonePh:  'WhatsApp number (e.g. +9715…)',
    send:     'Send',
    sent:     'Receipt sent ✅',
    badPhone: 'Invalid number, use international format',
    already:  'Receipt was already sent',
    sendErr:  'Could not send, try again later',
  },
} as const

function ReturnInner() {
  const params = useSearchParams()
  const payId  = params.get('p') ?? ''
  const [status, setStatus] = useState<Status>('checking')
  const [lang, setLang]     = useState<'ar' | 'en'>('ar')
  const [phone, setPhone]   = useState('')
  const [rcpt, setRcpt]     = useState<'idle' | 'sending' | 'sent' | string>('idle')

  async function sendReceipt() {
    setRcpt('sending')
    try {
      const r = await fetch(`/api/payment/online/${payId}/receipt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, lang }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.status === 'SENT') return setRcpt('sent')
      setRcpt(d.code === 'BAD_PHONE' ? 'badPhone' : d.code === 'ALREADY_SENT' ? 'already' : 'sendErr')
    } catch { setRcpt('sendErr') }
  }

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.language.startsWith('ar')) setLang('en')
  }, [])

  useEffect(() => {
    if (!/^[a-f0-9]{24}$/i.test(payId)) { setStatus('error'); return }
    let tries = 0
    let stop  = false
    async function check() {
      try {
        const r = await fetch(`/api/payment/online/${payId}/verify`, { method: 'POST' })
        const d = await r.json()
        if (!r.ok) throw new Error()
        if (d.status === 'PENDING' && tries++ < 10 && !stop) {
          setStatus('PENDING')
          setTimeout(check, 2500)
          return
        }
        setStatus(d.status as Status)
      } catch {
        setStatus('error')
      }
    }
    check()
    return () => { stop = true }
  }, [payId])

  const t = TXT[lang]
  const backHref = (() => {
    try { return localStorage.getItem('sm_pay_return') || '/' } catch { return '/' }
  })()

  const title = status === 'checking' ? t.checking : status === 'error' ? t.error : t[status]
  const sub   = status === 'PAID' ? t.paidSub : status === 'PENDING' ? t.pendSub
              : status === 'FAILED' || status === 'EXPIRED' ? t.failSub : ''
  const color = status === 'PAID' ? '#059669' : status === 'FAILED' || status === 'EXPIRED' || status === 'error' ? '#dc2626' : '#2563eb'

  return (
    <main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center space-y-4">
        {(status === 'checking' || status === 'PENDING') && (
          <div className="mx-auto w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
        )}
        <h1 className="text-xl font-extrabold" style={{ color }}>{title}</h1>
        {sub && <p className="text-sm text-gray-500">{sub}</p>}
        {status === 'PAID' && (
          rcpt === 'sent' ? (
            <p className="text-sm font-semibold text-emerald-600">{t.sent}</p>
          ) : (
            <div className="space-y-2 text-start">
              <p className="text-sm font-bold text-gray-700">💬 {t.receipt}</p>
              <div className="flex gap-2">
                <input type="tel" dir="ltr" value={phone} onChange={e => { setPhone(e.target.value); if (rcpt !== 'sending') setRcpt('idle') }}
                  placeholder={t.phonePh} className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                <button onClick={sendReceipt} disabled={rcpt === 'sending' || phone.replace(/\D/g, '').length < 8}
                  className="px-4 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#25D366' }}>
                  {t.send}
                </button>
              </div>
              {['badPhone', 'already', 'sendErr'].includes(rcpt) && (
                <p className="text-xs text-red-600">{t[rcpt as 'badPhone' | 'already' | 'sendErr']}</p>
              )}
            </div>
          )
        )}
        {status !== 'checking' && (
          <a href={backHref} className="block w-full py-3 rounded-xl font-bold text-white" style={{ backgroundColor: '#111827' }}>
            {t.back}
          </a>
        )}
      </div>
    </main>
  )
}

export default function PayReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnInner />
    </Suspense>
  )
}
