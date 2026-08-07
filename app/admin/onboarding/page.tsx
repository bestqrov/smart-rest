'use client'

/**
 * /admin/onboarding — Smart Onboarding (Step 3)
 *
 * Not registration — a short, mobile-first personalization wizard, max 3
 * screens, one clear action per screen. Saves capability flags on Cafe
 * (tier, takeawayOnlyMode, kitchenDisplayEnabled, loyaltyEnabled) via the
 * existing POST /api/admin/onboarding endpoint. Everything else the old
 * 6-step wizard used to ask (pricing, tables, manager PIN, starter menu)
 * is now defaulted automatically and editable later from Settings.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check } from 'lucide-react'

type Lang = 'ar' | 'fr' | 'en' | 'es'
type Tier = 'RESTAURANT' | 'CAFE'
type ServiceStyle = 'TABLE' | 'TAKEAWAY' | 'BOTH'

const T = {
  ar: {
    step1_title: 'اختر نوع نشاطك',
    restaurant:  'مطعم',
    cafe:        'مقهى',
    step2_title: 'كيفاش كتخدم الزبناء؟',
    table:       'خدمة على الطاولة',
    takeaway:    'بيع للخروج فقط',
    both:        'الاثنين معاً',
    step3_title: 'شنو الأدوات لي كتستعمل ديجا؟',
    kitchen:     'شاشة المطبخ',
    loyalty:     'برنامج الولاء',
    next:        'التالي',
    back:        'رجوع',
    finish:      'إنهاء الإعداد',
    saving:      'جارٍ الحفظ…',
    error:       'وقع خطأ. حاول مجدداً.',
  },
  fr: {
    step1_title: 'Choisissez votre activité',
    restaurant:  'Restaurant',
    cafe:        'Café',
    step2_title: 'Comment servez-vous vos clients ?',
    table:       'Service à table',
    takeaway:    'Vente à emporter uniquement',
    both:        'Les deux',
    step3_title: 'Quels outils utilisez-vous déjà ?',
    kitchen:     'Écran cuisine',
    loyalty:     'Programme de fidélité',
    next:        'Suivant',
    back:        'Retour',
    finish:      "Terminer l'installation",
    saving:      'Enregistrement…',
    error:       'Une erreur est survenue. Réessayez.',
  },
  en: {
    step1_title: 'Choose your business',
    restaurant:  'Restaurant',
    cafe:        'Café',
    step2_title: 'How do you serve customers?',
    table:       'Table Service',
    takeaway:    'Take Away Only',
    both:        'Both',
    step3_title: 'Which optional tools do you already use?',
    kitchen:     'Kitchen Display',
    loyalty:     'Loyalty Program',
    next:        'Next',
    back:        'Back',
    finish:      'Finish setup',
    saving:      'Saving…',
    error:       'Something went wrong. Please try again.',
  },
  es: {
    step1_title: 'Elige tu negocio',
    restaurant:  'Restaurante',
    cafe:        'Cafetería',
    step2_title: '¿Cómo atiendes a tus clientes?',
    table:       'Servicio en mesa',
    takeaway:    'Solo para llevar',
    both:        'Ambos',
    step3_title: '¿Qué herramientas ya usas?',
    kitchen:     'Pantalla de cocina',
    loyalty:     'Programa de fidelidad',
    next:        'Siguiente',
    back:        'Atrás',
    finish:      'Finalizar configuración',
    saving:      'Guardando…',
    error:       'Algo salió mal. Inténtalo de nuevo.',
  },
} as const

const TOTAL_STEPS = 3

// Sane, invisible defaults for the legacy required fields the old 6-step
// wizard used to ask for. The owner can change all of these later from
// Settings / Staff / Tables — none of them block the "under 2 minutes" goal.
const DEFAULT_COFFEE_PRICE   = 15
const DEFAULT_SANDWICH_PRICE = 35
const DEFAULT_ZONE_NAME      = 'Salle principale'
const DEFAULT_TABLE_COUNT    = 5

function randomManagerPin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pin = ''
  for (let i = 0; i < 6; i++) pin += chars[Math.floor(Math.random() * chars.length)]
  return pin
}

export default function OnboardingPage() {
  const router = useRouter()

  const [lang, setLang] = useState<Lang>('ar')
  const t     = T[lang]
  const isRTL = lang === 'ar'

  const [brandLogoUrl, setBrandLogoUrl] = useState('/assets/logo.png')
  useEffect(() => {
    fetch('/api/public/landing-config')
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => { if (d?.logoImageUrl) setBrandLogoUrl(d.logoImageUrl) })
      .catch(() => {})
  }, [])

  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const [tier,          setTier]          = useState<Tier>('RESTAURANT')
  const [serviceStyle,  setServiceStyle]  = useState<ServiceStyle>('TABLE')
  const [kitchenDisplayEnabled, setKitchenDisplayEnabled] = useState(true)
  const [loyaltyEnabled,        setLoyaltyEnabled]        = useState(true)

  // Profile fetched once — supplies businessName/country/currency so the
  // legacy required fields on POST /api/admin/onboarding can be filled in
  // automatically without asking the user again.
  const [profile, setProfile] = useState<{
    businessName: string; country: string; currency: string
  } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p) return
        if (p.tier === 'RESTAURANT' || p.tier === 'CAFE') setTier(p.tier)
        setProfile({
          businessName: p.businessName || p.name || '',
          country:      p.country ?? 'MA',
          currency:     p.currency ?? 'MAD',
        })
      })
      .catch(() => {})
  }, [router])

  async function handleFinish() {
    setSaving(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tier,
          businessName:     profile?.businessName || 'My Restaurant',
          currency:         profile?.currency ?? 'MAD',
          country:          profile?.country ?? 'MA',
          coffeeRefPrice:   DEFAULT_COFFEE_PRICE,
          sandwichRefPrice: DEFAULT_SANDWICH_PRICE,
          zones:            [{ name: DEFAULT_ZONE_NAME, tableCount: DEFAULT_TABLE_COUNT }],
          managerName:      profile?.businessName || 'Manager',
          managerPin:       randomManagerPin(),
          kitchenDisplayEnabled,
          loyaltyEnabled,
          takeawayOnlyMode: serviceStyle === 'TAKEAWAY',
        }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? t.error); setSaving(false); return }
      router.replace('/admin/dashboard')
    } catch {
      setError(t.error)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50/40 via-white to-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Top bar — brand + language */}
      <div className="flex items-center justify-between px-5 pt-5 shrink-0">
        <div className="flex items-center gap-2">
          <Image src={brandLogoUrl} alt="Smart Resto" width={28} height={28} className="rounded-lg object-contain" unoptimized />
          <span className="text-gray-900 text-sm font-extrabold">Smart Resto</span>
        </div>
        <div className="flex gap-1">
          {(['ar', 'fr', 'en', 'es'] as Lang[]).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors ${
                lang === l ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pt-4 shrink-0">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-400' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* Step content — single clear action, no scrolling */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">

          {step === 0 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-extrabold text-gray-900 text-center">{t.step1_title}</h1>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTier('RESTAURANT')}
                  className={`flex flex-col items-center gap-3 py-10 rounded-3xl border-2 transition-all ${
                    tier === 'RESTAURANT' ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-5xl">🍽️</span>
                  <span className={`text-base font-bold ${tier === 'RESTAURANT' ? 'text-blue-700' : 'text-gray-700'}`}>{t.restaurant}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTier('CAFE')}
                  className={`flex flex-col items-center gap-3 py-10 rounded-3xl border-2 transition-all ${
                    tier === 'CAFE' ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-5xl">☕</span>
                  <span className={`text-base font-bold ${tier === 'CAFE' ? 'text-blue-700' : 'text-gray-700'}`}>{t.cafe}</span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-extrabold text-gray-900 text-center">{t.step2_title}</h1>
              <div className="space-y-3">
                {([
                  ['TABLE', t.table],
                  ['TAKEAWAY', t.takeaway],
                  ['BOTH', t.both],
                ] as [ServiceStyle, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setServiceStyle(value)}
                    className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all ${
                      serviceStyle === value ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className={`text-base font-bold ${serviceStyle === value ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      serviceStyle === value ? 'border-blue-400 bg-blue-400' : 'border-gray-300'
                    }`}>
                      {serviceStyle === value && <Check className="w-4 h-4 text-white" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-extrabold text-gray-900 text-center">{t.step3_title}</h1>
              <div className="space-y-3">
                {([
                  ['kitchen', t.kitchen, kitchenDisplayEnabled, setKitchenDisplayEnabled],
                  ['loyalty', t.loyalty, loyaltyEnabled, setLoyaltyEnabled],
                ] as [string, string, boolean, (v: boolean) => void][]).map(([key, label, value, setValue]) => (
                  <div key={key} className="w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 border-gray-200 bg-white">
                    <span className="text-base font-bold text-gray-700">{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value}
                      onClick={() => setValue(!value)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        value ? (isRTL ? '-translate-x-6' : 'translate-x-6') : (isRTL ? '-translate-x-0.5' : 'translate-x-0.5')
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions — large touch targets */}
      <div className="px-6 pb-8 pt-2 shrink-0">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {t.back}
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              className="flex-[2] py-4 rounded-2xl font-extrabold text-white bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-200/60 active:scale-[0.98] transition-all"
            >
              {t.next}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="flex-[2] py-4 rounded-2xl font-extrabold text-white bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-200/60 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? t.saving : t.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
