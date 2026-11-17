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
  },
} as const

function ReturnInner() {
  const params = useSearchParams()
  const payId  = params.get('p') ?? ''
  const [status, setStatus] = useState<Status>('checking')
  const [lang, setLang]     = useState<'ar' | 'en'>('ar')

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
