'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, DollarSign, LayoutGrid, ShieldCheck,
  ChevronRight, ChevronLeft, Plus, Trash2, Check,
  Upload, Eye, EyeOff, Rocket
} from 'lucide-react'

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    welcome:      'مرحباً بك في Smart Resto',
    welcomeSub:   'أكمل الإعداد الأولي لمطعمك في 4 خطوات سريعة',
    steps: ['هوية المكان', 'التسعير الذكي', 'هيكلة المكان', 'الأمان'],
    step1: {
      title: 'هوية مطعمك',
      sub:   'اسم المكان، شعاره، والعملة المستخدمة',
      name:  'اسم المطعم / المقهى',
      logo:  'شعار المكان (رابط URL أو رفع صورة)',
      logoUrl: 'رابط الصورة (URL)',
      uploadBtn: 'رفع صورة',
      currency: 'العملة',
    },
    step2: {
      title: 'التسعير الذكي',
      sub:   'يستخدم النظام هذه الأسعار لحساب اشتراكك تلقائياً',
      coffee: 'سعر القهوة الأكثر مبيعاً',
      sandwich: 'سعر الساندويتش المرجعي',
      coffeePlh: 'مثال: 15',
      sandwichPlh: 'مثال: 35',
      hint: 'أدخل الأسعار بالعملة المختارة — هذا يساعد النظام في تحديد خطة الاشتراك المناسبة لك تلقائياً',
    },
    step3: {
      title: 'هيكلة المكان',
      sub:   'حدد المناطق وعدد الطاولات — سيتم توليد الـ QR تلقائياً',
      addZone: 'إضافة منطقة',
      zoneName: 'اسم المنطقة',
      tableCount: 'عدد الطاولات',
      zoneHint: 'مثال: الداخل، الشرفة، الحديقة، الطابق الأول',
      totalTables: 'إجمالي الطاولات',
      minOne: 'أضف منطقة واحدة على الأقل',
    },
    step4: {
      title: 'حساب المدير الرئيسي',
      sub:   'سيتم إنشاء حساب مشرف بهذه البيانات للدخول عبر الـ POS',
      managerName: 'اسم المدير',
      pin: 'الرمز السري (4 أرقام)',
      pinConfirm: 'تأكيد الرمز السري',
      pinMismatch: 'الرمزان غير متطابقان',
      pinInvalid: '4 أرقام فقط',
      showPin: 'إظهار',
      hidePin: 'إخفاء',
    },
    next: 'التالي',
    back: 'رجوع',
    launch: 'إنهاء وإطلاق النظام 🚀',
    launching: 'جارٍ إطلاق النظام…',
    error: 'حدث خطأ، حاول مجدداً',
    currencies: ['MAD', 'EUR', 'USD', 'SAR', 'AED', 'TND', 'DZD'],
  },
  fr: {
    welcome:    'Bienvenue sur Smart Resto',
    welcomeSub: 'Configurez votre restaurant en 4 étapes rapides',
    steps: ['Identité', 'Tarification', 'Structure', 'Sécurité'],
    step1: {
      title: 'Identité du lieu',
      sub:   'Nom, logo et devise',
      name:  'Nom du restaurant / café',
      logo:  'Logo (URL ou téléchargement)',
      logoUrl: "URL de l'image",
      uploadBtn: 'Télécharger',
      currency: 'Devise',
    },
    step2: {
      title: 'Tarification intelligente',
      sub:   'Ces prix servent à calculer votre abonnement automatiquement',
      coffee: 'Prix du café le plus vendu',
      sandwich: 'Prix du sandwich de référence',
      coffeePlh: 'Ex: 3.5',
      sandwichPlh: 'Ex: 8',
      hint: 'Ces prix aident le système à choisir automatiquement le forfait adapté à votre établissement',
    },
    step3: {
      title: 'Structure du lieu',
      sub:   'Définissez les zones et le nombre de tables — les QR seront générés automatiquement',
      addZone: 'Ajouter une zone',
      zoneName: 'Nom de la zone',
      tableCount: 'Nb de tables',
      zoneHint: 'Ex: Salle, Terrasse, Jardin, 1er étage',
      totalTables: 'Total tables',
      minOne: 'Ajoutez au moins une zone',
    },
    step4: {
      title: 'Compte du gérant principal',
      sub:   'Un compte superviseur sera créé avec ces informations pour accéder au POS',
      managerName: 'Nom du gérant',
      pin: 'Code PIN (4 chiffres)',
      pinConfirm: 'Confirmer le code PIN',
      pinMismatch: 'Les codes PIN ne correspondent pas',
      pinInvalid: '4 chiffres requis',
      showPin: 'Afficher',
      hidePin: 'Masquer',
    },
    next: 'Suivant',
    back: 'Retour',
    launch: 'Terminer et lancer le système 🚀',
    launching: 'Lancement en cours…',
    error: 'Une erreur est survenue, réessayez',
    currencies: ['EUR', 'MAD', 'USD', 'SAR', 'AED', 'TND', 'DZD'],
  },
  en: {
    welcome:    'Welcome to Smart Resto',
    welcomeSub: 'Set up your restaurant in 4 quick steps',
    steps: ['Identity', 'Pricing', 'Structure', 'Security'],
    step1: {
      title: 'Restaurant Identity',
      sub:   'Name, logo and currency',
      name:  'Restaurant / Cafe name',
      logo:  'Logo (URL or upload)',
      logoUrl: 'Image URL',
      uploadBtn: 'Upload',
      currency: 'Currency',
    },
    step2: {
      title: 'Smart Pricing',
      sub:   'These prices are used to automatically calculate your subscription',
      coffee: 'Price of your best-selling coffee',
      sandwich: 'Reference sandwich price',
      coffeePlh: 'e.g. 4',
      sandwichPlh: 'e.g. 9',
      hint: 'These reference prices help the system automatically select the right subscription plan for you',
    },
    step3: {
      title: 'Place Structure',
      sub:   'Define zones and table counts — QR codes will be generated automatically',
      addZone: 'Add zone',
      zoneName: 'Zone name',
      tableCount: 'Tables',
      zoneHint: 'e.g. Indoor, Terrace, Garden, 1st Floor',
      totalTables: 'Total tables',
      minOne: 'Add at least one zone',
    },
    step4: {
      title: 'Main Manager Account',
      sub:   'A supervisor account will be created with these details for POS login',
      managerName: 'Manager name',
      pin: 'PIN Code (4 digits)',
      pinConfirm: 'Confirm PIN Code',
      pinMismatch: 'PIN codes do not match',
      pinInvalid: '4 digits required',
      showPin: 'Show',
      hidePin: 'Hide',
    },
    next: 'Next',
    back: 'Back',
    launch: 'Finish & Launch System 🚀',
    launching: 'Launching…',
    error: 'An error occurred, please try again',
    currencies: ['USD', 'EUR', 'MAD', 'SAR', 'AED', 'GBP', 'TND'],
  },
  es: {
    welcome:    'Bienvenido a Smart Resto',
    welcomeSub: 'Configura tu restaurante en 4 pasos rápidos',
    steps: ['Identidad', 'Precios', 'Estructura', 'Seguridad'],
    step1: {
      title: 'Identidad del lugar',
      sub:   'Nombre, logo y moneda',
      name:  'Nombre del restaurante / café',
      logo:  'Logo (URL o subida)',
      logoUrl: 'URL de la imagen',
      uploadBtn: 'Subir',
      currency: 'Moneda',
    },
    step2: {
      title: 'Precios inteligentes',
      sub:   'El sistema usa estos precios para calcular tu suscripción automáticamente',
      coffee: 'Precio del café más vendido',
      sandwich: 'Precio de referencia del sándwich',
      coffeePlh: 'Ej: 2.5',
      sandwichPlh: 'Ej: 6',
      hint: 'Estos precios ayudan al sistema a seleccionar automáticamente el plan de suscripción adecuado',
    },
    step3: {
      title: 'Estructura del local',
      sub:   'Define zonas y número de mesas — los QR se generarán automáticamente',
      addZone: 'Agregar zona',
      zoneName: 'Nombre de la zona',
      tableCount: 'Mesas',
      zoneHint: 'Ej: Interior, Terraza, Jardín, 1er piso',
      totalTables: 'Total mesas',
      minOne: 'Agrega al menos una zona',
    },
    step4: {
      title: 'Cuenta del gerente principal',
      sub:   'Se creará una cuenta de supervisor con estos datos para el acceso al POS',
      managerName: 'Nombre del gerente',
      pin: 'Código PIN (4 dígitos)',
      pinConfirm: 'Confirmar código PIN',
      pinMismatch: 'Los códigos PIN no coinciden',
      pinInvalid: 'Se requieren 4 dígitos',
      showPin: 'Mostrar',
      hidePin: 'Ocultar',
    },
    next: 'Siguiente',
    back: 'Atrás',
    launch: 'Finalizar y lanzar el sistema 🚀',
    launching: 'Lanzando…',
    error: 'Ocurrió un error, inténtalo de nuevo',
    currencies: ['EUR', 'USD', 'MAD', 'SAR', 'AED', 'DZD'],
  },
}

type Lang = keyof typeof T

// ── Types ─────────────────────────────────────────────────────────────────────

interface Zone { name: string; tableCount: number }

interface WizardData {
  // Step 1
  businessName: string
  logoUrl:      string
  currency:     string
  // Step 2
  coffeeRefPrice:    string
  sandwichRefPrice:  string
  // Step 3
  zones: Zone[]
  // Step 4
  managerName: string
  managerPin:  string
  pinConfirm:  string
}

// ── Step icons ────────────────────────────────────────────────────────────────

const STEP_ICONS = [Building2, DollarSign, LayoutGrid, ShieldCheck]

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [lang, setLang] = useState<Lang>('ar')
  const t    = T[lang]
  const isRTL = lang === 'ar'

  const [step,    setStep]    = useState(0)   // 0-3
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [showPin, setShowPin] = useState(false)
  const [stepErr, setStepErr] = useState('')

  const [data, setData] = useState<WizardData>({
    businessName:     '',
    logoUrl:          '',
    currency:         'MAD',
    coffeeRefPrice:   '',
    sandwichRefPrice: '',
    zones:            [{ name: '', tableCount: 4 }],
    managerName:      '',
    managerPin:       '',
    pinConfirm:       '',
  })

  // Pre-fill business name from existing profile
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p) return
        setData(d => ({
          ...d,
          businessName: p.businessName || p.name || '',
          logoUrl:      p.logoUrl ?? '',
          currency:     p.currency ?? 'MAD',
          coffeeRefPrice:   p.coffeeRefPrice   ? String(p.coffeeRefPrice)   : '',
          sandwichRefPrice: p.sandwichRefPrice ? String(p.sandwichRefPrice) : '',
        }))
      })
  }, [])

  function set<K extends keyof WizardData>(key: K, val: WizardData[K]) {
    setData(d => ({ ...d, [key]: val }))
    setStepErr('')
  }

  // ── Logo upload → base64 ───────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logoUrl', reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Zone helpers ──────────────────────────────────────────────────────────
  function updateZone(i: number, field: keyof Zone, val: string | number) {
    setData(d => {
      const zones = [...d.zones]
      zones[i] = { ...zones[i], [field]: val }
      return { ...d, zones }
    })
    setStepErr('')
  }
  function addZone() { setData(d => ({ ...d, zones: [...d.zones, { name: '', tableCount: 2 }] })) }
  function removeZone(i: number) { setData(d => ({ ...d, zones: d.zones.filter((_, idx) => idx !== i) })) }

  // ── Validation per step ───────────────────────────────────────────────────
  function validateStep(): boolean {
    if (step === 0) {
      if (!data.businessName.trim()) { setStepErr(t.step1.name + ' is required'); return false }
      if (!data.currency) { setStepErr(t.step1.currency + ' is required'); return false }
    }
    if (step === 1) {
      if (!data.coffeeRefPrice || Number(data.coffeeRefPrice) <= 0) { setStepErr(t.step2.coffee + ' — required'); return false }
      if (!data.sandwichRefPrice || Number(data.sandwichRefPrice) <= 0) { setStepErr(t.step2.sandwich + ' — required'); return false }
    }
    if (step === 2) {
      if (data.zones.length === 0) { setStepErr(t.step3.minOne); return false }
      for (const z of data.zones) {
        if (!z.name.trim()) { setStepErr(t.step3.zoneName + ' — required'); return false }
        if (!z.tableCount || z.tableCount < 1) { setStepErr(t.step3.tableCount + ' — min 1'); return false }
      }
    }
    if (step === 3) {
      if (!data.managerName.trim()) { setStepErr(t.step4.managerName + ' — required'); return false }
      if (!/^\d{4}$/.test(data.managerPin)) { setStepErr(t.step4.pinInvalid); return false }
      if (data.managerPin !== data.pinConfirm) { setStepErr(t.step4.pinMismatch); return false }
    }
    return true
  }

  function handleNext() {
    setStepErr('')
    if (!validateStep()) return
    setStep(s => s + 1)
  }

  function handleBack() {
    setStepErr('')
    setStep(s => s - 1)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setStepErr('')
    if (!validateStep()) return
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          businessName:    data.businessName.trim(),
          logoUrl:         data.logoUrl.trim() || undefined,
          currency:        data.currency,
          coffeeRefPrice:  Number(data.coffeeRefPrice),
          sandwichRefPrice: Number(data.sandwichRefPrice),
          zones:           data.zones.map(z => ({ name: z.name.trim(), tableCount: Number(z.tableCount) })),
          managerName:     data.managerName.trim(),
          managerPin:      data.managerPin,
        }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? t.error); return }
      router.replace('/admin/dashboard')
    } catch {
      setError(t.error)
    } finally {
      setSaving(false)
    }
  }

  const totalTables = data.zones.reduce((s, z) => s + (Number(z.tableCount) || 0), 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4 py-10"
    >
      {/* Watermark logo */}
      {data.logoUrl && (
        <div
          className="fixed inset-0 bg-center bg-no-repeat bg-contain opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: `url(${data.logoUrl})`, filter: 'blur(3px)' }}
        />
      )}

      <div className="relative z-10 w-full max-w-xl">

        {/* Lang switcher */}
        <div className={`flex gap-2 mb-6 ${isRTL ? 'justify-start' : 'justify-end'}`}>
          {(Object.keys(T) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-extrabold text-white">{t.welcome}</h1>
          <p className="text-slate-400 text-sm mt-1">{t.welcomeSub}</p>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {t.steps.map((label, i) => {
            const Icon = STEP_ICONS[i]
            const done = i < step
            const active = i === step
            return (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    done   ? 'bg-green-500 text-white' :
                    active ? 'bg-amber-500 text-white ring-4 ring-amber-500/30' :
                             'bg-slate-700 text-slate-400'
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${
                    active ? 'text-amber-400' : done ? 'text-green-400' : 'text-slate-500'
                  }`}>{label}</span>
                </div>
                {i < 3 && (
                  <div className={`w-8 sm:w-14 h-0.5 mx-1 mt-[-14px] transition-colors ${
                    i < step ? 'bg-green-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">

          {/* Step content */}
          {step === 0 && (
            <StepCard title={t.step1.title} sub={t.step1.sub}>
              {/* Business name */}
              <Field label={t.step1.name}>
                <input
                  value={data.businessName}
                  onChange={e => set('businessName', e.target.value)}
                  placeholder="Le Café de Paris"
                  className="input"
                />
              </Field>

              {/* Logo */}
              <Field label={t.step1.logo}>
                <div className="flex gap-2">
                  <input
                    value={data.logoUrl.startsWith('data:') ? '' : data.logoUrl}
                    onChange={e => set('logoUrl', e.target.value)}
                    placeholder={t.step1.logoUrl}
                    className="input flex-1"
                  />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 transition-colors shrink-0">
                    <Upload className="w-4 h-4" /> {t.step1.uploadBtn}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
                {data.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={data.logoUrl} alt="logo preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm" />
                    <span className="text-xs text-slate-400">Preview ✓</span>
                  </div>
                )}
              </Field>

              {/* Currency */}
              <Field label={t.step1.currency}>
                <div className="flex flex-wrap gap-2">
                  {t.currencies.map(c => (
                    <button key={c} type="button" onClick={() => set('currency', c)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                        data.currency === c
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-500 hover:border-amber-300'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            </StepCard>
          )}

          {step === 1 && (
            <StepCard title={t.step2.title} sub={t.step2.sub}>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                💡 {t.step2.hint}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`☕ ${t.step2.coffee}`}>
                  <div className="relative">
                    <input type="number" min="0" step="0.5"
                      value={data.coffeeRefPrice}
                      onChange={e => set('coffeeRefPrice', e.target.value)}
                      placeholder={t.step2.coffeePlh}
                      className="input" />
                    <span className="absolute inset-y-0 end-3 flex items-center text-sm text-slate-400 pointer-events-none">
                      {data.currency}
                    </span>
                  </div>
                </Field>
                <Field label={`🥪 ${t.step2.sandwich}`}>
                  <div className="relative">
                    <input type="number" min="0" step="0.5"
                      value={data.sandwichRefPrice}
                      onChange={e => set('sandwichRefPrice', e.target.value)}
                      placeholder={t.step2.sandwichPlh}
                      className="input" />
                    <span className="absolute inset-y-0 end-3 flex items-center text-sm text-slate-400 pointer-events-none">
                      {data.currency}
                    </span>
                  </div>
                </Field>
              </div>
            </StepCard>
          )}

          {step === 2 && (
            <StepCard title={t.step3.title} sub={t.step3.sub}>
              <p className="text-xs text-slate-400">{t.step3.zoneHint}</p>

              <div className="space-y-2">
                {data.zones.map((zone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <input
                      value={zone.name}
                      onChange={e => updateZone(i, 'name', e.target.value)}
                      placeholder={t.step3.zoneName}
                      className="input flex-1"
                    />
                    <input
                      type="number" min="1" max="50"
                      value={zone.tableCount}
                      onChange={e => updateZone(i, 'tableCount', Number(e.target.value))}
                      className="input w-20 text-center"
                    />
                    {data.zones.length > 1 && (
                      <button type="button" onClick={() => removeZone(i)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={addZone}
                className="flex items-center gap-2 text-amber-600 hover:text-amber-500 text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> {t.step3.addZone}
              </button>

              {totalTables > 0 && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-slate-500">{t.step3.totalTables}</span>
                  <span className="text-2xl font-extrabold text-amber-600">{totalTables}</span>
                </div>
              )}
            </StepCard>
          )}

          {step === 3 && (
            <StepCard title={t.step4.title} sub={t.step4.sub}>
              <Field label={`👤 ${t.step4.managerName}`}>
                <input
                  value={data.managerName}
                  onChange={e => set('managerName', e.target.value)}
                  placeholder="Ahmed / Marie / Carlos"
                  className="input"
                />
              </Field>

              <Field label={`🔐 ${t.step4.pin}`}>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={data.managerPin}
                    onChange={e => set('managerPin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="input text-center text-2xl tracking-[0.5em] font-bold"
                  />
                  <button type="button" onClick={() => setShowPin(p => !p)}
                    className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field label={`🔐 ${t.step4.pinConfirm}`}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={data.pinConfirm}
                  onChange={e => set('pinConfirm', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                />
              </Field>

              {/* Summary card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-slate-700 mb-2">📋 Summary</p>
                <div className="flex justify-between"><span className="text-slate-500">Cafe</span><span className="font-medium">{data.businessName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-medium">{data.currency}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tables</span><span className="font-medium">{totalTables} tables / {data.zones.length} zones</span></div>
                <div className="flex justify-between"><span className="text-slate-500">☕ Coffee</span><span className="font-medium">{data.coffeeRefPrice} {data.currency}</span></div>
              </div>
            </StepCard>
          )}

          {/* Step error */}
          {stepErr && (
            <p className="text-red-500 text-sm font-medium">{stepErr}</p>
          )}

          {/* Global error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className={`flex items-center ${step > 0 ? 'justify-between' : 'justify-end'}`}>
            {step > 0 && (
              <button type="button" onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 text-slate-600 hover:text-slate-800 font-semibold transition-colors">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {t.back}
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold transition-colors active:scale-95">
                {t.next}
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white rounded-xl font-bold text-base transition-all active:scale-95 shadow-lg shadow-amber-500/30">
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t.launching}
                  </>
                ) : (
                  <><Rocket className="w-5 h-5" /> {t.launch}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden global input style */}
      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
          transition: box-shadow 0.15s;
        }
        .input:focus {
          box-shadow: 0 0 0 2px rgba(245,158,11,0.4);
          border-color: #f59e0b;
        }
      `}</style>
    </div>
  )
}

// ── Small sub-components ──────────────────────────────────────────────────────

function StepCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
