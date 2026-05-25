'use client'
/**
 * PaymentGateway — renders after the customer taps "Place Order".
 *
 * Gulf  (SA/AE/KW/QA/BH/OM) → Stripe Checkout redirect
 * Africa (MA/SN/CI/NG/GH…)  → Mobile Money QR screen with operator tabs
 * Global                     → none (cash/card handled at table)
 *
 * Props flow:
 *   parent builds { tableToken|seatToken, items[], customerPhone? }
 *   → calls /api/payment/gulf/checkout  or  /api/payment/mobilemoney/init
 *   → shows appropriate UI
 */

import { useEffect, useState, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  quantity:  number
  notes?:    string
  nameEn:    string
  price:     number
}

export interface PaymentGatewayConfig {
  marketType:   'Gulf' | 'Africa' | 'Global'
  currency:     string
  tableToken?:  string
  seatToken?:   string
  customerPhone?: string
  paymentGateway: {
    hasOrangeMoney:        boolean
    hasMtnMomo:            boolean
    hasWave:               boolean
    moyasarPublishableKey: string | null
    hasStripe:             boolean
    whatsappNumber:        string | null
  } | null
}

interface MobileMoneyOperator {
  operator:    'orange' | 'mtn' | 'wave'
  qrDataUrl:   string
  qrRawString: string
  ussdCode:    string
  smsBody:     string
  logoEmoji:   string
  color:       string
}

interface Props {
  config:        PaymentGatewayConfig
  items:         CartItem[]
  totalPrice:    number
  lang?:         string
  accentColor?:  string
  onSuccess:     (orderId?: string) => void
  onCancel:      () => void
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    payOnline:      'الدفع الإلكتروني',
    redirecting:    'جارٍ التحويل إلى بوابة الدفع…',
    scanQr:         'امسح رمز QR بتطبيق',
    orDial:         'أو اتصل بالكود',
    copy:           'نسخ',
    copied:         'تم ✓',
    whatsappFall:   'لا يوجد إنترنت؟ أرسل عبر واتساب',
    whatsappBtn:    'إرسال الطلب عبر واتساب ⚡',
    waitingConfirm: 'في انتظار تأكيد الكاشير…',
    total:          'الإجمالي',
    cancel:         'إلغاء',
    payWith:        'الدفع بـ',
    loading:        'جارٍ التحميل…',
    error:          'حدث خطأ، حاول مجدداً',
  },
  en: {
    payOnline:      'Online Payment',
    redirecting:    'Redirecting to payment gateway…',
    scanQr:         'Scan QR with',
    orDial:         'Or dial',
    copy:           'Copy',
    copied:         'Copied ✓',
    whatsappFall:   'No internet? Send via WhatsApp',
    whatsappBtn:    'Send order via WhatsApp ⚡',
    waitingConfirm: 'Waiting for cashier confirmation…',
    total:          'Total',
    cancel:         'Cancel',
    payWith:        'Pay with',
    loading:        'Loading…',
    error:          'An error occurred. Please try again.',
  },
  fr: {
    payOnline:      'Paiement en ligne',
    redirecting:    'Redirection vers la passerelle de paiement…',
    scanQr:         'Scanner le QR avec',
    orDial:         'Ou composer',
    copy:           'Copier',
    copied:         'Copié ✓',
    whatsappFall:   'Pas d\'internet ? Envoyer via WhatsApp',
    whatsappBtn:    'Envoyer la commande via WhatsApp ⚡',
    waitingConfirm: 'En attente de la confirmation du caissier…',
    total:          'Total',
    cancel:         'Annuler',
    payWith:        'Payer avec',
    loading:        'Chargement…',
    error:          'Une erreur est survenue. Veuillez réessayer.',
  },
} as const
type Lang = keyof typeof T

// ─── Operator display names ───────────────────────────────────────────────────

const OPERATOR_NAMES: Record<string, string> = {
  orange: 'Orange Money',
  mtn:    'MTN MoMo',
  wave:   'Wave',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentGateway({
  config, items, totalPrice, lang = 'ar', accentColor = '#059669', onSuccess, onCancel
}: Props) {
  const t   = T[(lang as Lang) in T ? (lang as Lang) : 'en']
  const isRTL = lang === 'ar'

  const [phase, setPhase] = useState<'idle' | 'loading' | 'qr' | 'polling' | 'error'>('idle')
  const [errorMsg, setErrorMsg]         = useState('')
  const [operators, setOperators]       = useState<MobileMoneyOperator[]>([])
  const [activeOp, setActiveOp]         = useState(0)
  const [paySessionId, setPaySessionId] = useState('')
  const [stripeUrl, setStripeUrl]       = useState('')
  const [copied, setCopied]             = useState<string | null>(null)

  // ── Gulf: Stripe ────────────────────────────────────────────────────────────

  const initiateStripe = useCallback(async () => {
    setPhase('loading')
    try {
      const origin = window.location.origin
      const res = await fetch('/api/payment/gulf/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableToken:    config.tableToken,
          seatToken:     config.seatToken,
          customerPhone: config.customerPhone,
          items:         items.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })),
          successUrl:    `${origin}/payment/success`,
          cancelUrl:     `${origin}/payment/cancel`,
        })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { url } = await res.json() as { sessionId: string; url: string }
      window.location.href = url
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.error)
      setPhase('error')
    }
  }, [config, items, t.error])

  // ── Africa: Mobile Money ────────────────────────────────────────────────────

  const initiateMobileMoney = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/payment/mobilemoney/init', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableToken:    config.tableToken,
          seatToken:     config.seatToken,
          customerPhone: config.customerPhone,
          items:         items.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })),
        })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json() as {
        paySessionId: string
        operators:    MobileMoneyOperator[]
      }
      setOperators(data.operators)
      setPaySessionId(data.paySessionId)
      setPhase('qr')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.error)
      setPhase('error')
    }
  }, [config, items, t.error])

  // Auto-start on mount
  useEffect(() => {
    if (config.marketType === 'Gulf')   initiateStripe()
    if (config.marketType === 'Africa') initiateMobileMoney()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Poll for Gulf payment status (after redirect back) ─────────────────────

  useEffect(() => {
    if (config.marketType !== 'Gulf' || !stripeUrl) return
    // If customer was redirected back with ?session_id=...
    const params    = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (!sessionId) return

    setPhase('polling')
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/gulf/status/${sessionId}`)
        const { status, orderId } = await res.json() as { status: string; orderId?: string }
        if (status === 'PAID') {
          clearInterval(interval)
          onSuccess(orderId)
        }
        if (status === 'FAILED' || status === 'EXPIRED') {
          clearInterval(interval)
          setErrorMsg(t.error)
          setPhase('error')
        }
      } catch { /* keep polling */ }
    }, 2000)
    return () => clearInterval(interval)
  }, [config.marketType, stripeUrl, onSuccess, t.error])

  // ── Copy helper ─────────────────────────────────────────────────────────────

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2200)
    })
  }

  // ── WhatsApp fallback (zero-rating) ─────────────────────────────────────────

  function sendWhatsApp() {
    if (!config.paymentGateway?.whatsappNumber) return
    const op     = operators[activeOp]
    const body   = op?.smsBody ?? buildFallbackMessage()
    const number = config.paymentGateway.whatsappNumber.replace(/\D/g, '')
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(body)}`, '_blank')
  }

  function buildFallbackMessage() {
    const lines = items.map(i => `${i.quantity}x ${i.nameEn}`).join(', ')
    const token = config.tableToken ?? config.seatToken ?? ''
    return `ORDER|${token}|${items.map(i => `${i.productId}:${i.quantity}`).join(',')}|${config.customerPhone ?? ''}\n\n${lines} — Total: ${totalPrice} ${config.currency}`
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (config.marketType === 'Global') return null

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">💳</span>
            <h2 className="font-extrabold text-gray-900 text-base">{t.payOnline}</h2>
          </div>
          <div className="text-sm font-bold text-gray-500">
            {t.total}: <span className="text-gray-900">{totalPrice.toFixed(2)} {config.currency}</span>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* ── Loading ── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
              <p className="text-sm text-gray-500">
                {config.marketType === 'Gulf' ? t.redirecting : t.loading}
              </p>
            </div>
          )}

          {/* ── Polling (Gulf payment success check) ── */}
          {phase === 'polling' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
              <p className="text-sm text-gray-500">{t.waitingConfirm}</p>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <div className="text-center py-6 space-y-3">
              <p className="text-4xl">⚠️</p>
              <p className="text-sm text-red-600 font-medium">{errorMsg || t.error}</p>
              <button
                onClick={() => {
                  setPhase('idle')
                  if (config.marketType === 'Gulf')   initiateStripe()
                  if (config.marketType === 'Africa') initiateMobileMoney()
                }}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {t.loading}
              </button>
            </div>
          )}

          {/* ── Africa: Mobile Money QR ── */}
          {phase === 'qr' && operators.length > 0 && (
            <>
              {/* Operator tabs */}
              {operators.length > 1 && (
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  {operators.map((op, i) => (
                    <button
                      key={op.operator}
                      onClick={() => setActiveOp(i)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeOp === i ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {op.logoEmoji} {OPERATOR_NAMES[op.operator]}
                    </button>
                  ))}
                </div>
              )}

              {/* QR code */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="p-3 rounded-2xl border-4"
                  style={{ borderColor: operators[activeOp].color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={operators[activeOp].qrDataUrl}
                    alt="Payment QR"
                    className="w-52 h-52 object-contain"
                  />
                </div>

                <div
                  className="w-full rounded-xl px-3 py-2 text-center text-sm font-bold"
                  style={{ backgroundColor: operators[activeOp].color + '20', color: operators[activeOp].color }}
                >
                  {t.payWith} {OPERATOR_NAMES[operators[activeOp].operator]}
                </div>

                {/* USSD fallback */}
                <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">{t.orDial}:</p>
                  <div className="flex items-center justify-between">
                    <code className="font-mono font-bold text-gray-900 text-sm">
                      {operators[activeOp].ussdCode}
                    </code>
                    <button
                      onClick={() => copy(operators[activeOp].ussdCode, 'ussd')}
                      className="text-xs px-2 py-1 rounded-lg border text-gray-600 hover:bg-gray-100"
                    >
                      {copied === 'ussd' ? t.copied : t.copy}
                    </button>
                  </div>
                </div>
              </div>

              {/* WhatsApp zero-rating fallback */}
              {config.paymentGateway?.whatsappNumber && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 text-center mb-2">{t.whatsappFall}</p>
                  <button
                    onClick={sendWhatsApp}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    {t.whatsappBtn}
                  </button>
                </div>
              )}

              {/* Waiting notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-center">
                {t.waitingConfirm}
              </div>
            </>
          )}

          {/* No operators configured */}
          {phase === 'qr' && operators.length === 0 && (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">{t.error}</p>
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
