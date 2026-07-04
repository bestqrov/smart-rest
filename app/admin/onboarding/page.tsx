'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, DollarSign, LayoutGrid, ShieldCheck,
  ChevronRight, ChevronLeft, Plus, Trash2, Check,
  Upload, Eye, EyeOff, Rocket, Globe, Coffee, Utensils, Sparkles
} from 'lucide-react'

// ── Country → Currency map ────────────────────────────────────────────────────

type CountryEntry = { code: string; flag: string; currency: string; name: Record<'ar'|'fr'|'en'|'es',string> }

const COUNTRIES: CountryEntry[] = [
  { code: 'MA', flag: '🇲🇦', currency: 'MAD', name: { ar: 'المغرب',      fr: 'Maroc',             en: 'Morocco',      es: 'Marruecos'     } },
  { code: 'DZ', flag: '🇩🇿', currency: 'DZD', name: { ar: 'الجزائر',     fr: 'Algérie',           en: 'Algeria',      es: 'Argelia'       } },
  { code: 'TN', flag: '🇹🇳', currency: 'TND', name: { ar: 'تونس',        fr: 'Tunisie',           en: 'Tunisia',      es: 'Túnez'         } },
  { code: 'LY', flag: '🇱🇾', currency: 'LYD', name: { ar: 'ليبيا',       fr: 'Libye',             en: 'Libya',        es: 'Libia'         } },
  { code: 'MR', flag: '🇲🇷', currency: 'MRU', name: { ar: 'موريتانيا',   fr: 'Mauritanie',        en: 'Mauritania',   es: 'Mauritania'    } },
  { code: 'EG', flag: '🇪🇬', currency: 'EGP', name: { ar: 'مصر',         fr: 'Égypte',            en: 'Egypt',        es: 'Egipto'        } },
  { code: 'JO', flag: '🇯🇴', currency: 'JOD', name: { ar: 'الأردن',      fr: 'Jordanie',          en: 'Jordan',       es: 'Jordania'      } },
  { code: 'SY', flag: '🇸🇾', currency: 'SYP', name: { ar: 'سوريا',       fr: 'Syrie',             en: 'Syria',        es: 'Siria'         } },
  { code: 'IQ', flag: '🇮🇶', currency: 'IQD', name: { ar: 'العراق',      fr: 'Irak',              en: 'Iraq',         es: 'Irak'          } },
  { code: 'KW', flag: '🇰🇼', currency: 'KWD', name: { ar: 'الكويت',      fr: 'Koweït',            en: 'Kuwait',       es: 'Kuwait'        } },
  { code: 'SA', flag: '🇸🇦', currency: 'SAR', name: { ar: 'السعودية',    fr: 'Arabie Saoudite',   en: 'Saudi Arabia', es: 'Arabia Saudí'  } },
  { code: 'QA', flag: '🇶🇦', currency: 'QAR', name: { ar: 'قطر',         fr: 'Qatar',             en: 'Qatar',        es: 'Catar'         } },
  { code: 'AE', flag: '🇦🇪', currency: 'AED', name: { ar: 'الإمارات',    fr: 'Émirats Arabes',    en: 'UAE',          es: 'EAU'           } },
  { code: 'BH', flag: '🇧🇭', currency: 'BHD', name: { ar: 'البحرين',     fr: 'Bahreïn',           en: 'Bahrain',      es: 'Baréin'        } },
  { code: 'OM', flag: '🇴🇲', currency: 'OMR', name: { ar: 'سلطنة عُمان', fr: 'Oman',              en: 'Oman',         es: 'Omán'          } },
  { code: 'SN', flag: '🇸🇳', currency: 'XOF', name: { ar: 'السنغال',     fr: 'Sénégal',           en: 'Senegal',      es: 'Senegal'       } },
  { code: 'CI', flag: '🇨🇮', currency: 'XOF', name: { ar: 'كوت ديفوار',  fr: "Côte d'Ivoire",     en: "Côte d'Ivoire",es: 'Costa de Marfil'} },
  { code: 'GA', flag: '🇬🇦', currency: 'XAF', name: { ar: 'الغابون',     fr: 'Gabon',             en: 'Gabon',        es: 'Gabón'         } },
  { code: 'KE', flag: '🇰🇪', currency: 'KES', name: { ar: 'كينيا',       fr: 'Kenya',             en: 'Kenya',        es: 'Kenia'         } },
]
const COUNTRY_MAP: Record<string, CountryEntry> = Object.fromEntries(COUNTRIES.map(c => [c.code, c]))
const GROUPS: Record<string, Record<'ar'|'fr'|'en'|'es', string>> = {
  maghreb:    { ar: '🇲🇦 شمال إفريقيا', fr: '🇲🇦 Maghreb', en: '🇲🇦 North Africa', es: '🇲🇦 Norte África' },
  middleeast: { ar: '🌙 الشرق الأوسط',  fr: '🌙 Moyen-Orient', en: '🌙 Middle East', es: '🌙 Oriente Medio' },
  gulf:       { ar: '🛢️ الخليج العربي', fr: '🛢️ Golfe Arabique', en: '🛢️ Arabian Gulf', es: '🛢️ Golfo Arábigo' },
  africa:     { ar: '🌍 غرب وشرق إفريقيا', fr: '🌍 Afrique', en: '🌍 Africa', es: '🌍 África' },
}
const GROUP_CODES: Record<string, string[]> = {
  maghreb: ['MA','DZ','TN','LY','MR'], middleeast: ['EG','JO','SY','IQ'],
  gulf:    ['KW','SA','QA','AE','BH','OM'], africa: ['SN','CI','GA','KE'],
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    welcome: 'مرحباً بك في Smart Resto',
    welcomeSub: 'أكمل الإعداد الأولي في 5 خطوات سريعة',
    steps: ['نوع المنشأة', 'هوية المكان', 'التسعير', 'الهيكلة', 'الأمان', 'المنيو'],
    step0: {
      title: 'ما هو نوع منشأتك؟',
      sub:   'هذا يحدد واجهة النظام والميزات المتاحة لك',
      cafe: {
        label: 'مقهى / كافيه بسيط',
        sub:   'مشروبات، كافيه، حلويات خفيفة وسناكس — بدون مطابخ كبيرة',
        features: ['☕ واجهة مبسطة وسريعة', '🥤 مشروبات وسناكس', '📱 QR & POS بسيط', '💸 اشتراك أقل'],
      },
      restaurant: {
        label: 'مطعم شامل / كافيه+مأكولات',
        sub:   'وجبات كاملة، مطبخ نشط، وشاشة KDS',
        features: ['🍽️ منيو كامل مع مأكولات', '👨‍🍳 شاشة مطبخ KDS', '🔥 إدارة طلبات معقدة', '📊 تقارير تفصيلية'],
      },
      upgradeNote: 'يمكنك الترقية لاحقاً بـ 25$',
    },
    step1: {
      title: 'هوية مطعمك', sub: 'الدولة، اسم المكان، شعاره، والعملة',
      country: 'الدولة', countryPh: 'اختر دولتك',
      name: 'اسم المطعم / المقهى', logo: 'شعار المكان', logoUrl: 'رابط الصورة', uploadBtn: 'رفع',
      currency: 'العملة (تُحدَّد تلقائياً)',
    },
    step2: {
      title: 'التسعير الذكي', sub: 'يستخدم النظام هذه الأسعار لحساب اشتراكك تلقائياً',
      coffee: 'سعر القهوة الأكثر مبيعاً', sandwich: 'سعر الساندويتش المرجعي',
      coffeePlh: 'مثال: 15', sandwichPlh: 'مثال: 35',
      hint: 'يساعد النظام في تحديد خطة الاشتراك المناسبة لك تلقائياً',
    },
    step3: {
      title: 'هيكلة المكان', sub: 'حدد المناطق وعدد الطاولات — QR تلقائي',
      addZone: 'إضافة منطقة', zoneName: 'اسم المنطقة', tableCount: 'الطاولات',
      zoneHint: 'مثال: الداخل، الشرفة، الحديقة، الطابق الأول',
      totalTables: 'إجمالي الطاولات', minOne: 'أضف منطقة واحدة على الأقل',
    },
    step4: {
      title: 'حساب المدير الرئيسي', sub: 'إنشاء حساب مشرف لتسجيل الدخول عبر POS',
      managerName: 'اسم المدير', pin: 'الرمز السري (4 إلى 8 خانات، حروف وأرقام)', pinConfirm: 'تأكيد الرمز السري',
      pinMismatch: 'الرمزان غير متطابقان', pinInvalid: 'من 4 إلى 8 خانات (حروف وأرقام)',
      showPin: 'إظهار', hidePin: 'إخفاء',
    },
    step5: {
      title: 'ابنِ منيو البداية', sub: 'اختر المنتجات الجاهزة حسب دولتك ونوع نشاطك — يمكنك تعديلها لاحقاً',
      typeLabel: 'نوع المنتجات المقترحة', selectAll: 'اختيار الكل', clearAll: 'إلغاء الكل',
      selectedCount: 'منتج محدد', noSuggestions: 'لا توجد اقتراحات لهذه الدولة بعد — يمكنك إضافة المنتجات يدوياً لاحقاً', skip: 'تخطي هذه الخطوة',
    },
    next: 'التالي', back: 'رجوع', launch: 'إنهاء وإطلاق النظام 🚀', launching: 'جارٍ الإطلاق…', error: 'حدث خطأ، حاول مجدداً',
  },
  fr: {
    welcome: 'Bienvenue sur Smart Resto',
    welcomeSub: 'Configurez votre établissement en 5 étapes',
    steps: ['Type', 'Identité', 'Tarification', 'Structure', 'Sécurité', 'Menu'],
    step0: {
      title: "Quel est votre type d'établissement ?",
      sub:   'Cela détermine l\'interface et les fonctionnalités disponibles',
      cafe: {
        label: 'Café / Snack simple',
        sub:   'Boissons, café, pâtisseries légères — sans grande cuisine',
        features: ['☕ Interface simple et rapide', '🥤 Boissons & snacks', '📱 QR & POS simplifié', '💸 Abonnement réduit'],
      },
      restaurant: {
        label: 'Restaurant complet / Café+Restauration',
        sub:   'Plats complets, cuisine active, écran KDS',
        features: ['🍽️ Menu complet avec plats', '👨‍🍳 Écran cuisine KDS', '🔥 Gestion commandes complexes', '📊 Rapports détaillés'],
      },
      upgradeNote: 'Vous pouvez passer à ce niveau plus tard pour 25$',
    },
    step1: {
      title: 'Identité du lieu', sub: 'Pays, nom, logo et devise',
      country: 'Pays', countryPh: 'Choisissez votre pays',
      name: 'Nom du restaurant / café', logo: 'Logo', logoUrl: "URL de l'image", uploadBtn: 'Télécharger',
      currency: 'Devise (détectée automatiquement)',
    },
    step2: {
      title: 'Tarification intelligente', sub: 'Ces prix servent à calculer votre abonnement',
      coffee: 'Prix du café le plus vendu', sandwich: 'Prix du sandwich de référence',
      coffeePlh: 'Ex: 3.5', sandwichPlh: 'Ex: 8',
      hint: 'Aide à sélectionner automatiquement le forfait adapté',
    },
    step3: {
      title: 'Structure du lieu', sub: 'Définissez zones et tables — QR automatiques',
      addZone: 'Ajouter une zone', zoneName: 'Nom de la zone', tableCount: 'Tables',
      zoneHint: 'Ex: Salle, Terrasse, Jardin, 1er étage',
      totalTables: 'Total tables', minOne: 'Ajoutez au moins une zone',
    },
    step4: {
      title: 'Compte gérant principal', sub: 'Accès POS pour le superviseur',
      managerName: 'Nom du gérant', pin: 'Code PIN (4 à 8 caractères, lettres et chiffres)', pinConfirm: 'Confirmer le code PIN',
      pinMismatch: 'Les codes PIN ne correspondent pas', pinInvalid: '4 à 8 caractères requis (lettres et chiffres)',
      showPin: 'Afficher', hidePin: 'Masquer',
    },
    step5: {
      title: 'Construisez votre menu de départ', sub: 'Choisissez des produits prêts selon votre pays et type d\'activité — modifiable plus tard',
      typeLabel: 'Type de produits suggérés', selectAll: 'Tout sélectionner', clearAll: 'Tout désélectionner',
      selectedCount: 'produits sélectionnés', noSuggestions: 'Pas encore de suggestions pour ce pays — vous pourrez ajouter vos produits manuellement plus tard.', skip: 'Passer cette étape',
    },
    next: 'Suivant', back: 'Retour', launch: 'Terminer et lancer 🚀', launching: 'Lancement…', error: 'Erreur, réessayez',
  },
  en: {
    welcome: 'Welcome to Smart Resto',
    welcomeSub: 'Set up your establishment in 5 quick steps',
    steps: ['Type', 'Identity', 'Pricing', 'Structure', 'Security', 'Menu'],
    step0: {
      title: 'What type of establishment are you?',
      sub:   'This determines your system interface and available features',
      cafe: {
        label: 'Simple Cafe / Coffee Shop',
        sub:   'Drinks, coffee, light pastries & snacks — no full kitchen',
        features: ['☕ Simple & fast interface', '🥤 Drinks & snacks', '📱 QR & simple POS', '💸 Lower subscription'],
      },
      restaurant: {
        label: 'Full Restaurant / Cafe + Food',
        sub:   'Complete meals, active kitchen, KDS screen',
        features: ['🍽️ Full menu with meals', '👨‍🍳 Kitchen KDS screen', '🔥 Complex order management', '📊 Detailed reports'],
      },
      upgradeNote: 'You can upgrade later for $25',
    },
    step1: {
      title: 'Restaurant Identity', sub: 'Country, name, logo and currency',
      country: 'Country', countryPh: 'Select your country',
      name: 'Restaurant / Cafe name', logo: 'Logo', logoUrl: 'Image URL', uploadBtn: 'Upload',
      currency: 'Currency (auto-detected)',
    },
    step2: {
      title: 'Smart Pricing', sub: 'Used to automatically calculate your subscription',
      coffee: 'Best-selling coffee price', sandwich: 'Reference sandwich price',
      coffeePlh: 'e.g. 4', sandwichPlh: 'e.g. 9',
      hint: 'Helps the system auto-select the right subscription plan',
    },
    step3: {
      title: 'Place Structure', sub: 'Define zones and tables — QR codes auto-generated',
      addZone: 'Add zone', zoneName: 'Zone name', tableCount: 'Tables',
      zoneHint: 'e.g. Indoor, Terrace, Garden, 1st Floor',
      totalTables: 'Total tables', minOne: 'Add at least one zone',
    },
    step4: {
      title: 'Main Manager Account', sub: 'Supervisor account for POS login',
      managerName: 'Manager name', pin: 'PIN Code (4 to 8 characters, letters and digits)', pinConfirm: 'Confirm PIN Code',
      pinMismatch: 'PIN codes do not match', pinInvalid: '4 to 8 characters required (letters and digits)',
      showPin: 'Show', hidePin: 'Hide',
    },
    step5: {
      title: 'Build your starter menu', sub: 'Pick ready-made products for your country and business type — editable anytime later',
      typeLabel: 'Suggested product type', selectAll: 'Select all', clearAll: 'Clear all',
      selectedCount: 'products selected', noSuggestions: 'No suggestions available for this country yet — you can add products manually later.', skip: 'Skip this step',
    },
    next: 'Next', back: 'Back', launch: 'Finish & Launch 🚀', launching: 'Launching…', error: 'An error occurred, retry',
  },
  es: {
    welcome: 'Bienvenido a Smart Resto',
    welcomeSub: 'Configura tu establecimiento en 5 pasos',
    steps: ['Tipo', 'Identidad', 'Precios', 'Estructura', 'Seguridad', 'Menú'],
    step0: {
      title: '¿Qué tipo de establecimiento tienes?',
      sub:   'Esto determina la interfaz y las funciones disponibles',
      cafe: {
        label: 'Café / Cafetería sencilla',
        sub:   'Bebidas, café, pasteles ligeros y snacks — sin cocina grande',
        features: ['☕ Interfaz simple y rápida', '🥤 Bebidas & snacks', '📱 QR & POS simple', '💸 Suscripción reducida'],
      },
      restaurant: {
        label: 'Restaurante completo / Café+Comida',
        sub:   'Platos completos, cocina activa, pantalla KDS',
        features: ['🍽️ Menú completo con platos', '👨‍🍳 Pantalla cocina KDS', '🔥 Gestión pedidos compleja', '📊 Informes detallados'],
      },
      upgradeNote: 'Puedes mejorar más tarde por $25',
    },
    step1: {
      title: 'Identidad del lugar', sub: 'País, nombre, logo y moneda',
      country: 'País', countryPh: 'Selecciona tu país',
      name: 'Nombre del restaurante / café', logo: 'Logo', logoUrl: 'URL de imagen', uploadBtn: 'Subir',
      currency: 'Moneda (detectada automáticamente)',
    },
    step2: {
      title: 'Precios inteligentes', sub: 'Para calcular tu suscripción automáticamente',
      coffee: 'Precio café más vendido', sandwich: 'Precio sándwich de referencia',
      coffeePlh: 'Ej: 2.5', sandwichPlh: 'Ej: 6',
      hint: 'Ayuda a seleccionar el plan de suscripción correcto',
    },
    step3: {
      title: 'Estructura del local', sub: 'Define zonas y mesas — QR automáticos',
      addZone: 'Agregar zona', zoneName: 'Nombre de zona', tableCount: 'Mesas',
      zoneHint: 'Ej: Interior, Terraza, Jardín, 1er piso',
      totalTables: 'Total mesas', minOne: 'Agrega al menos una zona',
    },
    step4: {
      title: 'Cuenta del gerente principal', sub: 'Acceso POS para el supervisor',
      managerName: 'Nombre del gerente', pin: 'Código PIN (4 a 8 caracteres, letras y números)', pinConfirm: 'Confirmar PIN',
      pinMismatch: 'Los códigos no coinciden', pinInvalid: 'Se requieren de 4 a 8 caracteres (letras y números)',
      showPin: 'Mostrar', hidePin: 'Ocultar',
    },
    step5: {
      title: 'Crea tu menú inicial', sub: 'Elige productos listos según tu país y tipo de negocio — editable después',
      typeLabel: 'Tipo de productos sugeridos', selectAll: 'Seleccionar todo', clearAll: 'Deseleccionar todo',
      selectedCount: 'productos seleccionados', noSuggestions: 'Aún no hay sugerencias para este país — podrás añadir productos manualmente más tarde.', skip: 'Saltar este paso',
    },
    next: 'Siguiente', back: 'Atrás', launch: 'Finalizar y lanzar 🚀', launching: 'Lanzando…', error: 'Error, inténtalo de nuevo',
  },
}

type Lang = keyof typeof T
interface Zone { name: string; tableCount: number }
interface WizardData {
  tier: 'CAFE' | 'RESTAURANT'
  businessName: string; country: string; logoUrl: string; currency: string
  coffeeRefPrice: string; sandwichRefPrice: string
  zones: Zone[]; managerName: string; managerPin: string; pinConfirm: string
}

// ── Step 5: suggested product catalog ─────────────────────────────────────────
// Mirrors src/onboarding/ProductCatalog.ts's shape — kept local to this page
// (app/ never imports server-side src/ modules directly), fetched from
// GET /api/admin/onboarding/product-catalog.
type CatalogBusinessType = 'CAFE' | 'RESTAURANT' | 'TRAITEUR' | 'PASTRY' | 'FOOD_TRUCK' | 'HOTEL'
interface CatalogProductItem { key: string; nameAr: string; nameFr: string; nameEn: string; suggestedPrice?: number }
interface CatalogCategoryItem { key: string; nameAr: string; nameFr: string; nameEn: string; icon: string; products: CatalogProductItem[] }

const CATALOG_TYPE_OPTIONS: { value: CatalogBusinessType; icon: string; label: Record<Lang, string> }[] = [
  { value: 'CAFE',       icon: '☕', label: { ar: 'مقهى',   fr: 'Café',       en: 'Café',       es: 'Cafetería' } },
  { value: 'RESTAURANT', icon: '🍽️', label: { ar: 'مطعم',   fr: 'Restaurant', en: 'Restaurant', es: 'Restaurante' } },
  { value: 'PASTRY',     icon: '🧁', label: { ar: 'حلويات', fr: 'Pâtisserie', en: 'Bakery',     es: 'Pastelería' } },
  { value: 'FOOD_TRUCK', icon: '🚚', label: { ar: 'فود تراك', fr: 'Food Truck', en: 'Food Truck', es: 'Food Truck' } },
  { value: 'TRAITEUR',   icon: '🎂', label: { ar: 'طراتور', fr: 'Traiteur',   en: 'Caterer',    es: 'Catering' } },
  { value: 'HOTEL',      icon: '🏨', label: { ar: 'فندق',   fr: 'Hôtel',      en: 'Hotel',      es: 'Hotel' } },
]

function nameFor(item: { nameAr: string; nameFr: string; nameEn: string }, lang: Lang): string {
  if (lang === 'ar') return item.nameAr
  if (lang === 'fr' || lang === 'es') return item.nameFr
  return item.nameEn
}

const STEP_ICONS = [Sparkles, Building2, DollarSign, LayoutGrid, ShieldCheck, Utensils]
const TOTAL_STEPS = 6

export default function OnboardingPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [lang,    setLang]    = useState<Lang>('ar')
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
  const [showPin, setShowPin] = useState(false)
  const [stepErr, setStepErr] = useState('')

  // Step 5 — suggested product catalog
  const [catalogType,     setCatalogType]     = useState<CatalogBusinessType>('CAFE')
  const [catalog,         setCatalog]         = useState<CatalogCategoryItem[]>([])
  const [catalogLoading,  setCatalogLoading]  = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Set<string>>>({})

  const [data, setData] = useState<WizardData>({
    tier: 'CAFE',
    businessName: '', country: 'MA', logoUrl: '', currency: 'MAD',
    coffeeRefPrice: '', sandwichRefPrice: '',
    zones: [{ name: '', tableCount: 4 }],
    managerName: '', managerPin: '', pinConfirm: '',
  })

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
          tier:             (p.tier as 'CAFE'|'RESTAURANT') ?? 'CAFE',
        }))
        if (p.tier === 'RESTAURANT' || p.tier === 'CAFE') setCatalogType(p.tier)
      })
  }, [])

  // Fetch the suggested product catalog whenever country or catalog type
  // changes — reuses GET /api/admin/onboarding/product-catalog, no client-
  // side catalog data duplicated here.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    setCatalogLoading(true)
    fetch(`/api/admin/onboarding/product-catalog?country=${encodeURIComponent(data.country)}&businessType=${encodeURIComponent(catalogType)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(body => setCatalog(body.categories ?? []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false))
  }, [data.country, catalogType])

  function toggleProduct(categoryKey: string, productKey: string) {
    setSelectedProducts(prev => {
      const next = { ...prev }
      const set = new Set(next[categoryKey] ?? [])
      if (set.has(productKey)) set.delete(productKey); else set.add(productKey)
      next[categoryKey] = set
      return next
    })
  }

  function toggleCategoryAll(category: CatalogCategoryItem) {
    setSelectedProducts(prev => {
      const current = prev[category.key] ?? new Set<string>()
      const allSelected = category.products.every(p => current.has(p.key))
      return { ...prev, [category.key]: allSelected ? new Set() : new Set(category.products.map(p => p.key)) }
    })
  }

  const totalSelectedProducts = Object.values(selectedProducts).reduce((sum, s) => sum + s.size, 0)

  function set<K extends keyof WizardData>(key: K, val: WizardData[K]) {
    setData(d => ({ ...d, [key]: val })); setStepErr('')
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
    setData(d => { const z = [...d.zones]; z[i] = { ...z[i], [field]: val }; return { ...d, zones: z } })
    setStepErr('')
  }
  function addZone()             { setData(d => ({ ...d, zones: [...d.zones, { name: '', tableCount: 2 }] })) }
  function removeZone(i: number) { setData(d => ({ ...d, zones: d.zones.filter((_, idx) => idx !== i) })) }

  function validateStep(): boolean {
    if (step === 0) { /* tier is always selected */ return true }
    if (step === 1) {
      if (!data.country)              { setStepErr(t.step1.country + ' is required'); return false }
      if (!data.businessName.trim())  { setStepErr(t.step1.name + ' is required'); return false }
    }
    if (step === 2) {
      if (!data.coffeeRefPrice || Number(data.coffeeRefPrice) <= 0)     { setStepErr(t.step2.coffee + ' — required'); return false }
      if (!data.sandwichRefPrice || Number(data.sandwichRefPrice) <= 0) { setStepErr(t.step2.sandwich + ' — required'); return false }
    }
    if (step === 3) {
      if (data.zones.length === 0) { setStepErr(t.step3.minOne); return false }
      for (const z of data.zones) {
        if (!z.name.trim())                   { setStepErr(t.step3.zoneName + ' — required'); return false }
        if (!z.tableCount || z.tableCount < 1) { setStepErr(t.step3.tableCount + ' — min 1'); return false }
      }
    }
    if (step === 4) {
      if (!data.managerName.trim())          { setStepErr(t.step4.managerName + ' — required'); return false }
      if (!/^[a-zA-Z0-9]{4,8}$/.test(data.managerPin)) { setStepErr(t.step4.pinInvalid); return false }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tier:            data.tier,
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

      // Best-effort: apply any selected starter-menu products. Never blocks
      // launch — the owner can always add products manually afterwards.
      if (totalSelectedProducts > 0) {
        const selections = Object.entries(selectedProducts)
          .filter(([, keys]) => keys.size > 0)
          .map(([categoryKey, keys]) => ({ categoryKey, productKeys: [...keys] }))
        await fetch('/api/admin/onboarding/apply-product-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ country: data.country, businessType: catalogType, selections }),
        }).catch(() => undefined)
      }

      // After onboarding → go to smart menu generation
      router.replace('/admin/menu-gen')
    } catch {
      setError(t.error)
    } finally {
      setSaving(false)
    }
  }

  const totalTables   = data.zones.reduce((s, z) => s + (Number(z.tableCount) || 0), 0)
  const selectedEntry = COUNTRY_MAP[data.country]

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">

      <div className="absolute -top-24 -end-24 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -start-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {data.logoUrl && (
        <div className="fixed inset-0 bg-center bg-no-repeat bg-contain opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: `url(${data.logoUrl})`, filter: 'blur(3px)' }} />
      )}

      <div className="relative z-10 w-full max-w-xl">

        {/* Lang switcher */}
        <div className={`flex gap-2 mb-6 ${isRTL ? 'justify-start' : 'justify-end'}`}>
          {(Object.keys(T) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="absolute inset-0 bg-amber-400/30 rounded-2xl blur-xl" />
            <img src={brandLogoUrl} alt="Smart Resto" className="relative w-16 h-16 rounded-2xl object-contain bg-white/95 p-1.5 shadow-lg" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t.welcome}</h1>
          <p className="text-slate-400 text-sm mt-1">{t.welcomeSub}</p>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {t.steps.map((label, i) => {
            const Icon   = STEP_ICONS[i]
            const done   = i < step
            const active = i === step
            return (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? 'bg-green-500 text-white' : active ? 'bg-amber-500 text-white ring-4 ring-amber-500/30' : 'bg-slate-700 text-slate-400'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? 'text-amber-400' : done ? 'text-green-400' : 'text-slate-500'}`}>{label}</span>
                </div>
                {i < TOTAL_STEPS - 1 && (
                  <div className={`w-6 sm:w-10 h-0.5 mx-0.5 mt-[-14px] transition-colors ${i < step ? 'bg-green-500' : 'bg-slate-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl ring-1 ring-white/10 p-6 sm:p-8 space-y-5">

          {/* ── Step 0: Tier Selection ─────────────────────────── */}
          {step === 0 && (
            <StepCard title={t.step0.title} sub={t.step0.sub}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* CAFE card */}
                <button
                  type="button"
                  onClick={() => set('tier', 'CAFE')}
                  className={`relative rounded-2xl border-2 p-4 text-start transition-all hover:shadow-md ${
                    data.tier === 'CAFE'
                      ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100'
                      : 'border-slate-200 hover:border-amber-200'
                  }`}
                >
                  {data.tier === 'CAFE' && (
                    <div className="absolute top-3 end-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="text-3xl mb-2">☕</div>
                  <p className="font-extrabold text-slate-800 text-sm">{t.step0.cafe.label}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{t.step0.cafe.sub}</p>
                  <ul className="space-y-1">
                    {t.step0.cafe.features.map((f, i) => (
                      <li key={i} className="text-xs text-slate-600">{f}</li>
                    ))}
                  </ul>
                </button>

                {/* RESTAURANT card */}
                <button
                  type="button"
                  onClick={() => set('tier', 'RESTAURANT')}
                  className={`relative rounded-2xl border-2 p-4 text-start transition-all hover:shadow-md ${
                    data.tier === 'RESTAURANT'
                      ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                      : 'border-slate-200 hover:border-emerald-200'
                  }`}
                >
                  {data.tier === 'RESTAURANT' && (
                    <div className="absolute top-3 end-3 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="text-3xl mb-2">🍽️</div>
                  <p className="font-extrabold text-slate-800 text-sm">{t.step0.restaurant.label}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{t.step0.restaurant.sub}</p>
                  <ul className="space-y-1">
                    {t.step0.restaurant.features.map((f, i) => (
                      <li key={i} className="text-xs text-slate-600">{f}</li>
                    ))}
                  </ul>
                </button>
              </div>

              <p className="text-xs text-center text-slate-400">
                <Coffee className="w-3 h-3 inline me-1" />{t.step0.upgradeNote}
              </p>
            </StepCard>
          )}

          {/* ── Step 1: Identity ───────────────────────────────── */}
          {step === 1 && (
            <StepCard title={t.step1.title} sub={t.step1.sub}>
              <Field label={<><Globe className="w-3.5 h-3.5 inline me-1" />{t.step1.country}</>}>
                <div className="relative">
                  <select value={data.country} onChange={e => handleCountryChange(e.target.value)}
                    className="input appearance-none pe-8 cursor-pointer">
                    <option value="" disabled>{t.step1.countryPh}</option>
                    {Object.entries(GROUPS).map(([gk, gn]) => (
                      <optgroup key={gk} label={gn[lang]}>
                        {(GROUP_CODES[gk] ?? []).map(code => {
                          const c = COUNTRY_MAP[code]; if (!c) return null
                          return <option key={code} value={code}>{c.flag} {c.name[lang]}</option>
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
                      {t.step1.currency.split('(')[0].trim()}: <span className="text-amber-600 font-extrabold">{data.currency}</span>
                    </span>
                  </div>
                )}
              </Field>

              <Field label={t.step1.name}>
                <input value={data.businessName} onChange={e => set('businessName', e.target.value)}
                  placeholder="Le Café de Paris" className="input" />
              </Field>

              <Field label={t.step1.logo}>
                <div className="flex gap-2">
                  <input value={data.logoUrl.startsWith('data:') ? '' : data.logoUrl}
                    onChange={e => set('logoUrl', e.target.value)}
                    placeholder={t.step1.logoUrl} className="input flex-1" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 transition-colors shrink-0">
                    <Upload className="w-4 h-4" /> {t.step1.uploadBtn}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleFileChange} />
                </div>
                <p className="text-xs text-slate-400 mt-1">📐 الأبعاد المثلى: <strong>512 × 512 px</strong> · PNG شفاف · 2 MB max</p>
                {data.logoUrl && (
                  <div className="mt-2 flex items-center gap-3" style={{ animation: 'logoFadeIn 0.3s ease' }}>
                    <img src={data.logoUrl} alt="logo" className="w-14 h-14 rounded-xl object-contain aspect-square border border-slate-200 shadow-sm bg-slate-50" />
                    <span className="text-xs text-slate-400">Preview ✓</span>
                  </div>
                )}
              </Field>
            </StepCard>
          )}

          {/* ── Step 2: Pricing ────────────────────────────────── */}
          {step === 2 && (
            <StepCard title={t.step2.title} sub={t.step2.sub}>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                💡 {t.step2.hint}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`☕ ${t.step2.coffee}`}>
                  <div className="relative">
                    <input type="number" min="0" step="0.5" value={data.coffeeRefPrice}
                      onChange={e => set('coffeeRefPrice', e.target.value)} placeholder={t.step2.coffeePlh} className="input" />
                    <span className="absolute inset-y-0 end-3 flex items-center text-sm text-slate-400 pointer-events-none">{data.currency}</span>
                  </div>
                </Field>
                <Field label={`🥪 ${t.step2.sandwich}`}>
                  <div className="relative">
                    <input type="number" min="0" step="0.5" value={data.sandwichRefPrice}
                      onChange={e => set('sandwichRefPrice', e.target.value)} placeholder={t.step2.sandwichPlh} className="input" />
                    <span className="absolute inset-y-0 end-3 flex items-center text-sm text-slate-400 pointer-events-none">{data.currency}</span>
                  </div>
                </Field>
              </div>
            </StepCard>
          )}

          {/* ── Step 3: Structure ──────────────────────────────── */}
          {step === 3 && (
            <StepCard title={t.step3.title} sub={t.step3.sub}>
              <p className="text-xs text-slate-400">{t.step3.zoneHint}</p>
              <div className="space-y-2">
                {data.zones.map((zone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                    <input value={zone.name} onChange={e => updateZone(i, 'name', e.target.value)}
                      placeholder={t.step3.zoneName} className="input flex-1 min-w-0" />
                    <input type="number" min="1" max="50" value={zone.tableCount}
                      onChange={e => updateZone(i, 'tableCount', Number(e.target.value))}
                      className="input shrink-0 text-center" style={{ width: '5rem' }} />
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

          {/* ── Step 4: Security ───────────────────────────────── */}
          {step === 4 && (
            <StepCard title={t.step4.title} sub={t.step4.sub}>
              <Field label={`👤 ${t.step4.managerName}`}>
                <input value={data.managerName} onChange={e => set('managerName', e.target.value)}
                  placeholder="Ahmed / Marie / Carlos" className="input" />
              </Field>
              <Field label={`🔐 ${t.step4.pin}`}>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} maxLength={8}
                    value={data.managerPin} onChange={e => set('managerPin', e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0,8))}
                    placeholder="••••" className="input text-center text-2xl tracking-[0.4em] font-bold" />
                  <button type="button" onClick={() => setShowPin(p => !p)}
                    className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label={`🔐 ${t.step4.pinConfirm}`}>
                <input type={showPin ? 'text' : 'password'} maxLength={8}
                  value={data.pinConfirm} onChange={e => set('pinConfirm', e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0,8))}
                  placeholder="••••" className="input text-center text-2xl tracking-[0.4em] font-bold" />
              </Field>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-slate-700 mb-2">📋 Summary</p>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium">{data.tier === 'CAFE' ? '☕ Cafe' : '🍽️ Restaurant'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium">{data.businessName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Country</span><span className="font-medium">{selectedEntry?.flag} {selectedEntry?.name.en}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-bold text-amber-600">{data.currency}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tables</span><span className="font-medium">{totalTables} / {data.zones.length} zones</span></div>
              </div>
            </StepCard>
          )}

          {/* ── Step 5: Starter menu ────────────────────────────── */}
          {step === 5 && (
            <StepCard title={t.step5.title} sub={t.step5.sub}>
              <Field label={`🍴 ${t.step5.typeLabel}`}>
                <div className="grid grid-cols-3 gap-2">
                  {CATALOG_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setCatalogType(opt.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center ${
                        catalogType === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}>
                      <span className="text-xl leading-none">{opt.icon}</span>
                      <span className={`text-xs font-bold ${catalogType === opt.value ? 'text-amber-700' : 'text-slate-600'}`}>{opt.label[lang]}</span>
                    </button>
                  ))}
                </div>
              </Field>

              {catalogLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!catalogLoading && catalog.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-500 text-center">
                  {t.step5.noSuggestions}
                </div>
              )}

              {!catalogLoading && catalog.length > 0 && (
                <div className="space-y-3 max-h-80 overflow-y-auto pe-1">
                  {catalog.map(category => {
                    const selectedInCategory = selectedProducts[category.key] ?? new Set<string>()
                    const allSelected = category.products.length > 0 && category.products.every(p => selectedInCategory.has(p.key))
                    return (
                      <div key={category.key} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                          <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                            <span>{category.icon}</span> {nameFor(category, lang)}
                          </span>
                          <button type="button" onClick={() => toggleCategoryAll(category)}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                            {allSelected ? t.step5.clearAll : t.step5.selectAll}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5 px-3 py-2.5">
                          {category.products.map(product => {
                            const checked = selectedInCategory.has(product.key)
                            return (
                              <label key={product.key} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                                <input type="checkbox" checked={checked} onChange={() => toggleProduct(category.key, product.key)}
                                  className="w-4 h-4 rounded accent-amber-500" />
                                <span className={checked ? 'text-slate-800 font-medium' : 'text-slate-500'}>{nameFor(product, lang)}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">
                {totalSelectedProducts} {t.step5.selectedCount}
              </p>
            </StepCard>
          )}

          {stepErr && <p className="text-red-500 text-sm font-medium">{stepErr}</p>}
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>}

          {/* Navigation */}
          <div className={`flex items-center ${step > 0 ? 'justify-between' : 'justify-end'}`}>
            {step > 0 && (
              <button type="button" onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 text-slate-600 hover:text-slate-800 font-semibold transition-colors">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {t.back}
              </button>
            )}
            {step < TOTAL_STEPS - 1 ? (
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
                  : <><Rocket className="w-5 h-5" /> {t.launch}</>}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.875rem; outline: none; background: white; transition: box-shadow 0.15s; }
        .input:focus { box-shadow: 0 0 0 2px rgba(245,158,11,0.4); border-color: #f59e0b; }
        @keyframes logoFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

function StepCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-extrabold text-slate-800">{title}</h2><p className="text-sm text-slate-500 mt-0.5">{sub}</p></div>
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
