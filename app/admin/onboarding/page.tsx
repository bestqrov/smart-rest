'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, DollarSign, LayoutGrid, ShieldCheck,
  ChevronRight, ChevronLeft, Plus, Trash2, Check,
  Upload, Eye, EyeOff, Rocket, Globe
} from 'lucide-react'

// ── Country → Currency map ────────────────────────────────────────────────────

type CountryEntry = {
  code: string
  flag: string
  currency: string
  name: Record<'ar' | 'fr' | 'en' | 'es', string>
}

const COUNTRIES: CountryEntry[] = [
  // ── Priority markets ───────────────────────────────────────────────────────
  { code: 'MA', flag: '🇲🇦', currency: 'MAD', name: { ar: 'المغرب',          fr: 'Maroc',              en: 'Morocco',        es: 'Marruecos'        } },
  { code: 'SN', flag: '🇸🇳', currency: 'XOF', name: { ar: 'السنغال',         fr: 'Sénégal',            en: 'Senegal',        es: 'Senegal'          } },
  { code: 'CI', flag: '🇨🇮', currency: 'XOF', name: { ar: "كوت ديفوار",      fr: "Côte d'Ivoire",      en: "Côte d'Ivoire",  es: 'Costa de Marfil'  } },
  { code: 'GA', flag: '🇬🇦', currency: 'XAF', name: { ar: 'الغابون',         fr: 'Gabon',              en: 'Gabon',          es: 'Gabón'            } },
  { code: 'CM', flag: '🇨🇲', currency: 'XAF', name: { ar: 'الكاميرون',       fr: 'Cameroun',           en: 'Cameroon',       es: 'Camerún'          } },
  { code: 'KE', flag: '🇰🇪', currency: 'KES', name: { ar: 'كينيا',           fr: 'Kenya',              en: 'Kenya',          es: 'Kenia'            } },
  // ── Gulf ───────────────────────────────────────────────────────────────────
  { code: 'SA', flag: '🇸🇦', currency: 'SAR', name: { ar: 'السعودية',        fr: 'Arabie Saoudite',    en: 'Saudi Arabia',   es: 'Arabia Saudí'     } },
  { code: 'AE', flag: '🇦🇪', currency: 'AED', name: { ar: 'الإمارات',        fr: 'Émirats Arabes',     en: 'UAE',            es: 'EAU'              } },
  { code: 'QA', flag: '🇶🇦', currency: 'QAR', name: { ar: 'قطر',             fr: 'Qatar',              en: 'Qatar',          es: 'Catar'            } },
  { code: 'KW', flag: '🇰🇼', currency: 'KWD', name: { ar: 'الكويت',          fr: 'Koweït',             en: 'Kuwait',         es: 'Kuwait'           } },
  { code: 'BH', flag: '🇧🇭', currency: 'BHD', name: { ar: 'البحرين',         fr: 'Bahreïn',            en: 'Bahrain',        es: 'Baréin'           } },
  { code: 'OM', flag: '🇴🇲', currency: 'OMR', name: { ar: 'عُمان',           fr: 'Oman',               en: 'Oman',           es: 'Omán'             } },
  // ── North Africa & Levant ──────────────────────────────────────────────────
  { code: 'EG', flag: '🇪🇬', currency: 'EGP', name: { ar: 'مصر',             fr: 'Égypte',             en: 'Egypt',          es: 'Egipto'           } },
  { code: 'TN', flag: '🇹🇳', currency: 'TND', name: { ar: 'تونس',            fr: 'Tunisie',            en: 'Tunisia',        es: 'Túnez'            } },
  { code: 'DZ', flag: '🇩🇿', currency: 'DZD', name: { ar: 'الجزائر',         fr: 'Algérie',            en: 'Algeria',        es: 'Argelia'          } },
  { code: 'LY', flag: '🇱🇾', currency: 'LYD', name: { ar: 'ليبيا',           fr: 'Libye',              en: 'Libya',          es: 'Libia'            } },
  { code: 'JO', flag: '🇯🇴', currency: 'JOD', name: { ar: 'الأردن',          fr: 'Jordanie',           en: 'Jordan',         es: 'Jordania'         } },
  { code: 'IQ', flag: '🇮🇶', currency: 'IQD', name: { ar: 'العراق',          fr: 'Irak',               en: 'Iraq',           es: 'Irak'             } },
  { code: 'MR', flag: '🇲🇷', currency: 'MRU', name: { ar: 'موريتانيا',       fr: 'Mauritanie',         en: 'Mauritania',     es: 'Mauritania'       } },
  // ── West & Central Africa ─────────────────────────────────────────────────
  { code: 'ML', flag: '🇲🇱', currency: 'XOF', name: { ar: 'مالي',            fr: 'Mali',               en: 'Mali',           es: 'Mali'             } },
  { code: 'BF', flag: '🇧🇫', currency: 'XOF', name: { ar: 'بوركينا فاسو',    fr: 'Burkina Faso',       en: 'Burkina Faso',   es: 'Burkina Faso'     } },
  { code: 'GN', flag: '🇬🇳', currency: 'GNF', name: { ar: 'غينيا',           fr: 'Guinée',             en: 'Guinea',         es: 'Guinea'           } },
  { code: 'TG', flag: '🇹🇬', currency: 'XOF', name: { ar: 'توغو',            fr: 'Togo',               en: 'Togo',           es: 'Togo'             } },
  { code: 'BJ', flag: '🇧🇯', currency: 'XOF', name: { ar: 'بنين',            fr: 'Bénin',              en: 'Benin',          es: 'Benín'            } },
  { code: 'NE', flag: '🇳🇪', currency: 'XOF', name: { ar: 'النيجر',          fr: 'Niger',              en: 'Niger',          es: 'Níger'            } },
  { code: 'TD', flag: '🇹🇩', currency: 'XAF', name: { ar: 'تشاد',            fr: 'Tchad',              en: 'Chad',           es: 'Chad'             } },
  { code: 'CG', flag: '🇨🇬', currency: 'XAF', name: { ar: 'الكونغو',         fr: 'Congo',              en: 'Congo',          es: 'Congo'            } },
  { code: 'GQ', flag: '🇬🇶', currency: 'XAF', name: { ar: 'غينيا الاستوائية',fr: 'Guinée Équatoriale', en: 'Eq. Guinea',     es: 'Guinea Ecuatorial'} },
  { code: 'CF', flag: '🇨🇫', currency: 'XAF', name: { ar: 'أفريقيا الوسطى', fr: 'Rép. Centrafricaine', en: 'CAR',           es: 'Rep. Centroafricana'} },
  // ── East Africa ────────────────────────────────────────────────────────────
  { code: 'TZ', flag: '🇹🇿', currency: 'TZS', name: { ar: 'تنزانيا',         fr: 'Tanzanie',           en: 'Tanzania',       es: 'Tanzania'         } },
  { code: 'UG', flag: '🇺🇬', currency: 'UGX', name: { ar: 'أوغندا',          fr: 'Ouganda',            en: 'Uganda',         es: 'Uganda'           } },
  { code: 'RW', flag: '🇷🇼', currency: 'RWF', name: { ar: 'رواندا',           fr: 'Rwanda',             en: 'Rwanda',         es: 'Ruanda'           } },
  // ── Europe ─────────────────────────────────────────────────────────────────
  { code: 'FR', flag: '🇫🇷', currency: 'EUR', name: { ar: 'فرنسا',           fr: 'France',             en: 'France',         es: 'Francia'          } },
  { code: 'ES', flag: '🇪🇸', currency: 'EUR', name: { ar: 'إسبانيا',         fr: 'Espagne',            en: 'Spain',          es: 'España'           } },
  { code: 'BE', flag: '🇧🇪', currency: 'EUR', name: { ar: 'بلجيكا',          fr: 'Belgique',           en: 'Belgium',        es: 'Bélgica'          } },
  { code: 'NL', flag: '🇳🇱', currency: 'EUR', name: { ar: 'هولندا',          fr: 'Pays-Bas',           en: 'Netherlands',    es: 'Países Bajos'     } },
  { code: 'GB', flag: '🇬🇧', currency: 'GBP', name: { ar: 'المملكة المتحدة', fr: 'Royaume-Uni',        en: 'UK',             es: 'Reino Unido'      } },
]

const COUNTRY_MAP: Record<string, CountryEntry> = Object.fromEntries(COUNTRIES.map(c => [c.code, c]))

// ── Groups for <optgroup> ────────────────────────────────────────────────────

const GROUPS: Record<string, { ar: string; fr: string; en: string; es: string }> = {
  priority:  { ar: '⭐ الأسواق المستهدفة', fr: '⭐ Marchés cibles',    en: '⭐ Target markets',    es: '⭐ Mercados objetivo' },
  gulf:      { ar: '🌙 دول الخليج',         fr: '🌙 Pays du Golfe',     en: '🌙 Gulf States',        es: '🌙 Países del Golfo'  },
  mena:      { ar: '🌍 شمال أفريقيا والمشرق', fr: '🌍 Afrique du Nord & Levant', en: '🌍 MENA',          es: '🌍 MENA'              },
  westafrica:{ ar: '🌿 غرب وسط أفريقيا',    fr: '🌿 Afrique Centrale', en: '🌿 West & Central Africa', es: '🌿 África Occidental' },
  eastafrica:{ ar: '🌄 شرق أفريقيا',       fr: '🌄 Afrique de l\'Est', en: '🌄 East Africa',       es: '🌄 África Oriental'   },
  europe:    { ar: '🇪🇺 أوروبا',            fr: '🇪🇺 Europe',           en: '🇪🇺 Europe',            es: '🇪🇺 Europa'           },
}

const GROUP_CODES: Record<string, string[]> = {
  priority:   ['MA', 'SN', 'CI', 'GA', 'CM', 'KE'],
  gulf:       ['SA', 'AE', 'QA', 'KW', 'BH', 'OM'],
  mena:       ['EG', 'TN', 'DZ', 'LY', 'JO', 'IQ', 'MR'],
  westafrica: ['ML', 'BF', 'GN', 'TG', 'BJ', 'NE', 'TD', 'CG', 'GQ', 'CF'],
  eastafrica: ['TZ', 'UG', 'RW'],
  europe:     ['FR', 'ES', 'BE', 'NL', 'GB'],
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    welcome:    'مرحباً بك في Smart Resto',
    welcomeSub: 'أكمل الإعداد الأولي لمطعمك في 4 خطوات سريعة',
    steps: ['هوية المكان', 'التسعير الذكي', 'هيكلة المكان', 'الأمان'],
    step1: {
      title:     'هوية مطعمك',
      sub:       'الدولة، اسم المكان، شعاره، والعملة المحددة تلقائياً',
      country:   'الدولة',
      countryPh: 'اختر دولتك',
      name:      'اسم المطعم / المقهى',
      logo:      'شعار المكان (رابط URL أو رفع صورة)',
      logoUrl:   'رابط الصورة (URL)',
      uploadBtn: 'رفع صورة',
      currency:  'العملة (تُحدَّد تلقائياً)',
    },
    step2: {
      title:      'التسعير الذكي',
      sub:        'يستخدم النظام هذه الأسعار لحساب اشتراكك تلقائياً',
      coffee:     'سعر القهوة الأكثر مبيعاً',
      sandwich:   'سعر الساندويتش المرجعي',
      coffeePlh:  'مثال: 15',
      sandwichPlh:'مثال: 35',
      hint:       'أدخل الأسعار بالعملة المختارة — هذا يساعد النظام في تحديد خطة الاشتراك المناسبة لك تلقائياً',
    },
    step3: {
      title:      'هيكلة المكان',
      sub:        'حدد المناطق وعدد الطاولات — سيتم توليد الـ QR تلقائياً',
      addZone:    'إضافة منطقة',
      zoneName:   'اسم المنطقة',
      tableCount: 'عدد الطاولات',
      zoneHint:   'مثال: الداخل، الشرفة، الحديقة، الطابق الأول',
      totalTables:'إجمالي الطاولات',
      minOne:     'أضف منطقة واحدة على الأقل',
    },
    step4: {
      title:      'حساب المدير الرئيسي',
      sub:        'سيتم إنشاء حساب مشرف بهذه البيانات للدخول عبر الـ POS',
      managerName:'اسم المدير',
      pin:        'الرمز السري (4 أرقام)',
      pinConfirm: 'تأكيد الرمز السري',
      pinMismatch:'الرمزان غير متطابقان',
      pinInvalid: '4 أرقام فقط',
      showPin:    'إظهار',
      hidePin:    'إخفاء',
    },
    next:      'التالي',
    back:      'رجوع',
    launch:    'إنهاء وإطلاق النظام 🚀',
    launching: 'جارٍ إطلاق النظام…',
    error:     'حدث خطأ، حاول مجدداً',
  },
  fr: {
    welcome:    'Bienvenue sur Smart Resto',
    welcomeSub: 'Configurez votre restaurant en 4 étapes rapides',
    steps: ['Identité', 'Tarification', 'Structure', 'Sécurité'],
    step1: {
      title:     'Identité du lieu',
      sub:       'Pays, nom, logo et devise détectée automatiquement',
      country:   'Pays',
      countryPh: 'Choisissez votre pays',
      name:      'Nom du restaurant / café',
      logo:      'Logo (URL ou téléchargement)',
      logoUrl:   "URL de l'image",
      uploadBtn: 'Télécharger',
      currency:  'Devise (détectée automatiquement)',
    },
    step2: {
      title:      'Tarification intelligente',
      sub:        'Ces prix servent à calculer votre abonnement automatiquement',
      coffee:     'Prix du café le plus vendu',
      sandwich:   'Prix du sandwich de référence',
      coffeePlh:  'Ex: 3.5',
      sandwichPlh:'Ex: 8',
      hint:       'Ces prix aident le système à choisir automatiquement le forfait adapté à votre établissement',
    },
    step3: {
      title:      'Structure du lieu',
      sub:        'Définissez les zones et le nombre de tables — les QR seront générés automatiquement',
      addZone:    'Ajouter une zone',
      zoneName:   'Nom de la zone',
      tableCount: 'Nb de tables',
      zoneHint:   'Ex: Salle, Terrasse, Jardin, 1er étage',
      totalTables:'Total tables',
      minOne:     'Ajoutez au moins une zone',
    },
    step4: {
      title:      'Compte du gérant principal',
      sub:        'Un compte superviseur sera créé avec ces informations pour accéder au POS',
      managerName:'Nom du gérant',
      pin:        'Code PIN (4 chiffres)',
      pinConfirm: 'Confirmer le code PIN',
      pinMismatch:'Les codes PIN ne correspondent pas',
      pinInvalid: '4 chiffres requis',
      showPin:    'Afficher',
      hidePin:    'Masquer',
    },
    next:      'Suivant',
    back:      'Retour',
    launch:    'Terminer et lancer le système 🚀',
    launching: 'Lancement en cours…',
    error:     'Une erreur est survenue, réessayez',
  },
  en: {
    welcome:    'Welcome to Smart Resto',
    welcomeSub: 'Set up your restaurant in 4 quick steps',
    steps: ['Identity', 'Pricing', 'Structure', 'Security'],
    step1: {
      title:     'Restaurant Identity',
      sub:       'Country, name, logo and auto-detected currency',
      country:   'Country',
      countryPh: 'Select your country',
      name:      'Restaurant / Cafe name',
      logo:      'Logo (URL or upload)',
      logoUrl:   'Image URL',
      uploadBtn: 'Upload',
      currency:  'Currency (auto-detected)',
    },
    step2: {
      title:      'Smart Pricing',
      sub:        'These prices are used to automatically calculate your subscription',
      coffee:     'Price of your best-selling coffee',
      sandwich:   'Reference sandwich price',
      coffeePlh:  'e.g. 4',
      sandwichPlh:'e.g. 9',
      hint:       'These reference prices help the system automatically select the right subscription plan for you',
    },
    step3: {
      title:      'Place Structure',
      sub:        'Define zones and table counts — QR codes will be generated automatically',
      addZone:    'Add zone',
      zoneName:   'Zone name',
      tableCount: 'Tables',
      zoneHint:   'e.g. Indoor, Terrace, Garden, 1st Floor',
      totalTables:'Total tables',
      minOne:     'Add at least one zone',
    },
    step4: {
      title:      'Main Manager Account',
      sub:        'A supervisor account will be created with these details for POS login',
      managerName:'Manager name',
      pin:        'PIN Code (4 digits)',
      pinConfirm: 'Confirm PIN Code',
      pinMismatch:'PIN codes do not match',
      pinInvalid: '4 digits required',
      showPin:    'Show',
      hidePin:    'Hide',
    },
    next:      'Next',
    back:      'Back',
    launch:    'Finish & Launch System 🚀',
    launching: 'Launching…',
    error:     'An error occurred, please try again',
  },
  es: {
    welcome:    'Bienvenido a Smart Resto',
    welcomeSub: 'Configura tu restaurante en 4 pasos rápidos',
    steps: ['Identidad', 'Precios', 'Estructura', 'Seguridad'],
    step1: {
      title:     'Identidad del lugar',
      sub:       'País, nombre, logo y moneda detectada automáticamente',
      country:   'País',
      countryPh: 'Selecciona tu país',
      name:      'Nombre del restaurante / café',
      logo:      'Logo (URL o subida)',
      logoUrl:   'URL de la imagen',
      uploadBtn: 'Subir',
      currency:  'Moneda (detectada automáticamente)',
    },
    step2: {
      title:      'Precios inteligentes',
      sub:        'El sistema usa estos precios para calcular tu suscripción automáticamente',
      coffee:     'Precio del café más vendido',
      sandwich:   'Precio de referencia del sándwich',
      coffeePlh:  'Ej: 2.5',
      sandwichPlh:'Ej: 6',
      hint:       'Estos precios ayudan al sistema a seleccionar automáticamente el plan de suscripción adecuado',
    },
    step3: {
      title:      'Estructura del local',
      sub:        'Define zonas y número de mesas — los QR se generarán automáticamente',
      addZone:    'Agregar zona',
      zoneName:   'Nombre de la zona',
      tableCount: 'Mesas',
      zoneHint:   'Ej: Interior, Terraza, Jardín, 1er piso',
      totalTables:'Total mesas',
      minOne:     'Agrega al menos una zona',
    },
    step4: {
      title:      'Cuenta del gerente principal',
      sub:        'Se creará una cuenta de supervisor con estos datos para el acceso al POS',
      managerName:'Nombre del gerente',
      pin:        'Código PIN (4 dígitos)',
      pinConfirm: 'Confirmar código PIN',
      pinMismatch:'Los códigos PIN no coinciden',
      pinInvalid: 'Se requieren 4 dígitos',
      showPin:    'Mostrar',
      hidePin:    'Ocultar',
    },
    next:      'Siguiente',
    back:      'Atrás',
    launch:    'Finalizar y lanzar el sistema 🚀',
    launching: 'Lanzando…',
    error:     'Ocurrió un error, inténtalo de nuevo',
  },
}

type Lang = keyof typeof T

// ── Types ─────────────────────────────────────────────────────────────────────

interface Zone { name: string; tableCount: number }

interface WizardData {
  businessName:     string
  country:          string
  logoUrl:          string
  currency:         string
  coffeeRefPrice:   string
  sandwichRefPrice: string
  zones:            Zone[]
  managerName:      string
  managerPin:       string
  pinConfirm:       string
}

const STEP_ICONS = [Building2, DollarSign, LayoutGrid, ShieldCheck]

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [lang,    setLang]    = useState<Lang>('ar')
  const t     = T[lang]
  const isRTL = lang === 'ar'

  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [showPin, setShowPin] = useState(false)
  const [stepErr, setStepErr] = useState('')

  const [data, setData] = useState<WizardData>({
    businessName:     '',
    country:          'MA',
    logoUrl:          '',
    currency:         'MAD',
    coffeeRefPrice:   '',
    sandwichRefPrice: '',
    zones:            [{ name: '', tableCount: 4 }],
    managerName:      '',
    managerPin:       '',
    pinConfirm:       '',
  })

  // Pre-fill from existing profile
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p) return
        setData(d => ({
          ...d,
          businessName:     p.businessName || p.name || '',
          country:          p.country ?? 'MA',
          logoUrl:          p.logoUrl ?? '',
          currency:         p.currency ?? (COUNTRY_MAP[p.country ?? 'MA']?.currency ?? 'MAD'),
          coffeeRefPrice:   p.coffeeRefPrice   ? String(p.coffeeRefPrice)   : '',
          sandwichRefPrice: p.sandwichRefPrice ? String(p.sandwichRefPrice) : '',
        }))
      })
  }, [])

  function set<K extends keyof WizardData>(key: K, val: WizardData[K]) {
    setData(d => ({ ...d, [key]: val }))
    setStepErr('')
  }

  function handleCountryChange(code: string) {
    const entry = COUNTRY_MAP[code]
    setData(d => ({ ...d, country: code, currency: entry?.currency ?? d.currency }))
    setStepErr('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logoUrl', reader.result as string)
    reader.readAsDataURL(file)
  }

  function updateZone(i: number, field: keyof Zone, val: string | number) {
    setData(d => {
      const zones = [...d.zones]
      zones[i] = { ...zones[i], [field]: val }
      return { ...d, zones }
    })
    setStepErr('')
  }
  function addZone()          { setData(d => ({ ...d, zones: [...d.zones, { name: '', tableCount: 2 }] })) }
  function removeZone(i: number) { setData(d => ({ ...d, zones: d.zones.filter((_, idx) => idx !== i) })) }

  function validateStep(): boolean {
    if (step === 0) {
      if (!data.country)              { setStepErr(t.step1.country + ' is required'); return false }
      if (!data.businessName.trim())  { setStepErr(t.step1.name + ' is required'); return false }
    }
    if (step === 1) {
      if (!data.coffeeRefPrice || Number(data.coffeeRefPrice) <= 0)   { setStepErr(t.step2.coffee + ' — required'); return false }
      if (!data.sandwichRefPrice || Number(data.sandwichRefPrice) <= 0) { setStepErr(t.step2.sandwich + ' — required'); return false }
    }
    if (step === 2) {
      if (data.zones.length === 0) { setStepErr(t.step3.minOne); return false }
      for (const z of data.zones) {
        if (!z.name.trim())              { setStepErr(t.step3.zoneName + ' — required'); return false }
        if (!z.tableCount || z.tableCount < 1) { setStepErr(t.step3.tableCount + ' — min 1'); return false }
      }
    }
    if (step === 3) {
      if (!data.managerName.trim())      { setStepErr(t.step4.managerName + ' — required'); return false }
      if (!/^\d{4}$/.test(data.managerPin)) { setStepErr(t.step4.pinInvalid); return false }
      if (data.managerPin !== data.pinConfirm) { setStepErr(t.step4.pinMismatch); return false }
    }
    return true
  }

  function handleNext() { setStepErr(''); if (!validateStep()) return; setStep(s => s + 1) }
  function handleBack() { setStepErr(''); setStep(s => s - 1) }

  async function handleSubmit() {
    setStepErr('')
    if (!validateStep()) return
    setSaving(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          businessName:    data.businessName.trim(),
          logoUrl:         data.logoUrl.trim() || undefined,
          currency:        data.currency,
          country:         data.country,
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

  const totalTables   = data.zones.reduce((s, z) => s + (Number(z.tableCount) || 0), 0)
  const selectedEntry = COUNTRY_MAP[data.country]

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4 py-10"
    >
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
            const Icon   = STEP_ICONS[i]
            const done   = i < step
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

          {/* ── Step 0: Identity ─────────────────────────────────────── */}
          {step === 0 && (
            <StepCard title={t.step1.title} sub={t.step1.sub}>

              {/* Country selector */}
              <Field label={<><Globe className="w-3.5 h-3.5 inline me-1" />{t.step1.country}</>}>
                <div className="relative">
                  <select
                    value={data.country}
                    onChange={e => handleCountryChange(e.target.value)}
                    className="input appearance-none pr-8 cursor-pointer"
                  >
                    <option value="" disabled>{t.step1.countryPh}</option>
                    {Object.entries(GROUPS).map(([groupKey, groupName]) => (
                      <optgroup key={groupKey} label={groupName[lang]}>
                        {(GROUP_CODES[groupKey] ?? []).map(code => {
                          const c = COUNTRY_MAP[code]
                          if (!c) return null
                          return (
                            <option key={code} value={code}>
                              {c.flag} {c.name[lang]}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-slate-400">▾</span>
                </div>
                {selectedEntry && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg">{selectedEntry.flag}</span>
                    <span className="text-xs text-slate-500">{selectedEntry.name[lang]}</span>
                    <span className="ms-auto flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                      {t.step1.currency.split('(')[0].trim()}:
                      <span className="text-amber-600 font-extrabold">{data.currency}</span>
                    </span>
                  </div>
                )}
              </Field>

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
            </StepCard>
          )}

          {/* ── Step 1: Pricing ──────────────────────────────────────── */}
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

          {/* ── Step 2: Structure ────────────────────────────────────── */}
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

          {/* ── Step 3: Security ─────────────────────────────────────── */}
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
                <div className="flex justify-between">
                  <span className="text-slate-500">Country</span>
                  <span className="font-medium">{selectedEntry?.flag} {selectedEntry?.name.en}</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-bold text-amber-600">{data.currency}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tables</span><span className="font-medium">{totalTables} tables / {data.zones.length} zones</span></div>
                <div className="flex justify-between"><span className="text-slate-500">☕ Coffee ref</span><span className="font-medium">{data.coffeeRefPrice} {data.currency}</span></div>
              </div>
            </StepCard>
          )}

          {stepErr && <p className="text-red-500 text-sm font-medium">{stepErr}</p>}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
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
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.launching}</>
                  : <><Rocket className="w-5 h-5" /> {t.launch}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">{label}</label>
      {children}
    </div>
  )
}
