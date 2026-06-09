"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, Camera, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReservationInfo = {
  reservationId: string
  cafeId: string
  cafeName: string
  cafeLogoUrl: string | null
  packageType: string
  isArtisticQrPaid: boolean
  customerName: string | null
  customerPhone: string | null
  accentColor: string
}

type Stage = 'loading' | 'notfound' | 'form' | 'submitting' | 'done' | 'error'

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform active:scale-90"
        >
          <Star
            className={`w-10 h-10 transition-colors ${
              star <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-zinc-600'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { reservationId } = useParams<{ reservationId: string }>()

  const [stage, setStage]               = useState<Stage>('loading')
  const [info, setInfo]                 = useState<ReservationInfo | null>(null)
  const [rating, setRating]             = useState(5)
  const [reviewText, setReviewText]     = useState('')
  const [imageBase64, setImageBase64]   = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [consent, setConsent]           = useState(false)
  const [errorMsg, setErrorMsg]         = useState('')
  const fileRef                         = useRef<HTMLInputElement>(null)

  // ── Fetch reservation info ──────────────────────────────────────────────────
  useEffect(() => {
    if (!reservationId) return
    fetch(`/api/public/reservation/${reservationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setStage('notfound'); return }
        setInfo(data)
        setStage('form')
      })
      .catch(() => setStage('notfound'))
  }, [reservationId])

  // ── Handle photo selection ──────────────────────────────────────────────────
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('الصورة كبيرة — الحد الأقصى 10MB')
      return
    }
    setErrorMsg('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      setImageBase64(b64)
      setImagePreview(b64)
    }
    reader.readAsDataURL(file)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!info) return
    if (rating === 0) { setErrorMsg('اختر عدد النجوم'); return }

    setStage('submitting')
    setErrorMsg('')

    try {
      const hook = process.env.NEXT_PUBLIC_N8N_REVIEW_HOOK
      if (!hook) throw new Error('Review webhook not configured')

      const payload = {
        reservationId: info.reservationId,
        cafeId: info.cafeId,
        cafeName: info.cafeName,
        cafeLogoUrl: info.cafeLogoUrl ?? '',
        packageType: info.packageType,
        isArtisticQrPaid: info.isArtisticQrPaid,
        customerPhone: info.customerPhone ?? '',
        reviewText,
        rating,
        imageBase64: imageBase64 ?? '',
        userConsentGranted: consent,
      }

      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`n8n error ${res.status}`)
      setStage('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ، حاول مجدداً')
      setStage('form')
    }
  }

  // ─── Render states ──────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (stage === 'notfound') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        <AlertCircle className="w-14 h-14 text-red-500" />
        <h1 className="text-xl font-bold text-white">الرابط غير صالح</h1>
        <p className="text-zinc-400 text-sm">هذا الرابط منتهي أو غير موجود.</p>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 text-center px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          <CheckCircle2 className="w-20 h-20 text-emerald-400" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-bold text-white">شكراً جزيلاً! 🎉</h1>
          <p className="text-zinc-400">تم استلام تقييمك بنجاح.</p>
          {info && (
            <p className="text-emerald-400 text-sm font-medium">
              نتمنى أن تعود لزيارة {info.cafeName} قريباً 🍽️
            </p>
          )}
        </motion.div>
      </div>
    )
  }

  const accent = info?.accentColor ?? '#059669'

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-12 px-4">
      {/* Header */}
      <div className="w-full max-w-md pt-10 pb-6 flex flex-col items-center gap-3">
        {info?.cafeLogoUrl ? (
          <img
            src={info.cafeLogoUrl}
            alt={info.cafeName}
            className="w-20 h-20 rounded-2xl object-cover ring-2 ring-zinc-700"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black"
            style={{ background: accent }}
          >
            {info?.cafeName?.[0] ?? '?'}
          </div>
        )}
        <h1 className="text-xl font-bold text-white text-center">{info?.cafeName}</h1>
        <p className="text-zinc-400 text-sm text-center">
          {info?.customerName ? `مرحباً ${info.customerName} 👋 — ` : ''}
          شاركنا تجربتك معنا
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 bg-zinc-900 rounded-2xl p-6 border border-zinc-800"
      >
        {/* Stars */}
        <div className="space-y-2 text-center">
          <p className="text-zinc-300 font-medium text-sm">تقييمك العام</p>
          <StarRating value={rating} onChange={setRating} />
          <p className="text-zinc-500 text-xs">
            {['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز! 🤩'][rating]}
          </p>
        </div>

        {/* Review text */}
        <div className="space-y-1">
          <label className="text-zinc-300 text-sm font-medium">تعليقك (اختياري)</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="ما الذي أعجبك؟ أو ما الذي يمكن تحسينه؟"
            rows={4}
            maxLength={500}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-zinc-600 text-xs text-left">{reviewText.length}/500</p>
        </div>

        {/* Photo upload */}
        <div className="space-y-2">
          <p className="text-zinc-300 text-sm font-medium">أضف صورة (اختياري)</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="hidden"
          />
          <AnimatePresence mode="wait">
            {imagePreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="relative rounded-xl overflow-hidden"
              >
                <img src={imagePreview} alt="preview" className="w-full max-h-56 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setImageBase64(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="upload"
                type="button"
                onClick={() => fileRef.current?.click()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full border-2 border-dashed border-zinc-700 hover:border-emerald-500 rounded-xl py-8 flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                <Camera className="w-8 h-8" />
                <span className="text-sm">اضغط لإضافة صورة</span>
                <span className="text-xs text-zinc-600">JPG / PNG — الحد الأقصى 10MB</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Consent checkbox */}
        {imageBase64 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-zinc-800 rounded-xl p-4 space-y-2"
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-emerald-500 w-4 h-4"
              />
              <span className="text-zinc-300 text-xs leading-relaxed">
                أوافق على نشر صورتي على حسابات {info?.cafeName} ووسائل التواصل الاجتماعي لـ Smart Resto.{' '}
                <span className="text-zinc-500">
                  (إذا لم توافق، ستُحذف وجوهك تلقائياً قبل أي نشر)
                </span>
              </span>
            </label>
            <p className="text-zinc-600 text-xs pr-7">
              📋 تخضع هذه الصورة لسياسة الخصوصية — يحق لك طلب الحذف في أي وقت.
            </p>
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-sm text-center flex items-center justify-center gap-1"
            >
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          type="submit"
          disabled={stage === 'submitting' || rating === 0}
          style={{ background: accent }}
          className="w-full py-4 rounded-xl text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {stage === 'submitting' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...
            </>
          ) : (
            'إرسال التقييم ⭐'
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          Powered by{' '}
          <span className="text-emerald-500 font-semibold">Smart Resto</span>
        </p>
      </form>
    </div>
  )
}
