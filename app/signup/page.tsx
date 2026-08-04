'use client'

/**
 * Smart Resto — Magic-Link Signup Page
 *
 * Supports 4 languages: Arabic (RTL), French, English, Spanish.
 * Language is selected by the user from a dropdown or read from ?lang= query param.
 *
 * Flow:
 *  1. User fills form (cafeName, subdomain, email, country)
 *  2. POST /api/auth/magic-send → server validates whitelist, creates token, sends email
 *  3. Page shows "check your inbox" state
 *  4. User clicks email link → /api/auth/magic-verify → creates account → /verify-success
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Globe } from 'lucide-react'

// ─── i18n (client-side subset) ────────────────────────────────────────────────

type Lang = 'ar' | 'fr' | 'en' | 'es'

const D = {
  page_title:       { ar: 'أنشئ حسابك مجاناً', fr: 'Créer votre compte', en: 'Create your account', es: 'Crea tu cuenta' },
  page_subtitle:    { ar: 'جاهز في دقيقتين · بدون بطاقة بنكية', fr: 'Prêt en 2 min · Sans carte bancaire', en: 'Ready in 2 min · No credit card', es: 'Listo en 2 min · Sin tarjeta' },
  brand_tagline:    { ar: 'الحل الذكي الشامل للمطاعم والفنادق والتريتور', fr: 'La solution intelligente pour restaurants, hôtels & traiteurs', en: 'The all-in-one platform for restaurants, hotels & caterers', es: 'La plataforma inteligente para restaurantes, hoteles y catering' },
  label_lang:       { ar: 'اللغة', fr: 'Langue', en: 'Language', es: 'Idioma' },
  label_btype:      { ar: 'اختر نوع نشاطك', fr: 'Sélectionnez votre type d\'activité', en: 'Select your business type', es: 'Selecciona tu tipo de negocio' },
  label_cafe:       { ar: 'اسم المطعم أو المقهى', fr: 'Nom du restaurant / café', en: 'Restaurant or café name', es: 'Nombre del restaurante / café' },
  label_sub:        { ar: 'رابط المطعم (subdomain)', fr: 'Adresse web (sous-domaine)', en: 'Web address (subdomain)', es: 'Dirección web (subdominio)' },
  label_email:      { ar: 'البريد الإلكتروني', fr: 'Adresse e-mail', en: 'E-mail address', es: 'Correo electrónico' },
  label_country:    { ar: 'الدولة', fr: 'Pays', en: 'Country', es: 'País' },
  ph_btype:         { ar: 'اختر نوع المنشأة', fr: 'Choisissez un type', en: 'Select a type', es: 'Selecciona un tipo' },
  ph_cafe:          { ar: 'مثال: مقهى النجمة', fr: 'Ex. Café des Étoiles', en: 'E.g. The Golden Star', es: 'Ej. Café La Estrella' },
  ph_sub:           { ar: 'my-cafe', fr: 'mon-cafe', en: 'my-cafe', es: 'mi-cafe' },
  ph_email:         { ar: 'you@gmail.com', fr: 'vous@gmail.com', en: 'you@gmail.com', es: 'tu@gmail.com' },
  sub_preview:      { ar: 'سيكون رابطك:', fr: 'Votre adresse sera :', en: 'Your link will be:', es: 'Tu enlace será:' },
  email_hint:       { ar: 'نقبل Gmail · Outlook · Hotmail · Yahoo فقط', fr: 'Nous acceptons Gmail · Outlook · Hotmail · Yahoo uniquement', en: 'We accept Gmail · Outlook · Hotmail · Yahoo only', es: 'Solo aceptamos Gmail · Outlook · Hotmail · Yahoo' },
  btn_send:         { ar: 'إرسال رابط التفعيل', fr: 'Envoyer le lien magique', en: 'Send magic link', es: 'Enviar enlace mágico' },
  btn_sending:      { ar: 'جارٍ الإرسال…', fr: 'Envoi en cours…', en: 'Sending…', es: 'Enviando…' },
  ok_title:         { ar: 'تحقق من بريدك ✉️', fr: 'Vérifiez votre boîte mail ✉️', en: 'Check your inbox ✉️', es: 'Revisa tu correo ✉️' },
  ok_body:          { ar: 'أرسلنا رابطاً سحرياً إلى {email}. صالح 15 دقيقة.', fr: 'Lien envoyé à {email}. Valide 15 minutes.', en: 'Magic link sent to {email}. Valid for 15 minutes.', es: 'Enlace enviado a {email}. Válido 15 minutos.' },
  ok_spam:          { ar: 'لم يصلك؟ تحقق من السبام.', fr: 'Pas reçu ? Vérifiez le spam.', en: 'Not received? Check your spam folder.', es: '¿No lo recibiste? Revisa spam.' },
  ok_back:          { ar: '← تعديل البيانات', fr: '← Modifier', en: '← Edit details', es: '← Editar datos' },
  have_account:     { ar: 'لديك حساب؟', fr: 'Déjà un compte ?', en: 'Already have an account?', es: '¿Ya tienes cuenta?' },
  sign_in:          { ar: 'تسجيل الدخول', fr: 'Se connecter', en: 'Sign in', es: 'Iniciar sesión' },
  back_home:        { ar: '← الصفحة الرئيسية', fr: '← Accueil', en: '← Home', es: '← Inicio' },
  badge_card:       { ar: '✓ بدون بطاقة', fr: '✓ Sans carte', en: '✓ No card', es: '✓ Sin tarjeta' },
  badge_trial:      { ar: '✓ تجربة مجانية 7 أيام', fr: '✓ Essai 7 jours', en: '✓ 7-day free trial', es: '✓ 7 días gratis' },
  badge_cancel:     { ar: '✓ إلغاء في أي وقت', fr: '✓ Annulation libre', en: '✓ Cancel anytime', es: '✓ Cancela cuando quieras' },
  err_fields:       { ar: 'يرجى ملء جميع الحقول.', fr: 'Remplissez tous les champs.', en: 'Please fill in all fields.', es: 'Completa todos los campos.' },
  err_email_fmt:    { ar: 'صيغة البريد غير صحيحة.', fr: 'Adresse e-mail invalide.', en: 'Invalid email format.', es: 'Formato de correo inválido.' },
  err_sub_fmt:      { ar: 'الرابط: أحرف إنجليزية صغيرة وأرقام وشرطات فقط.', fr: 'Sous-domaine : lettres minuscules, chiffres, tirets.', en: 'Subdomain: lowercase letters, numbers and hyphens only.', es: 'Subdominio: minúsculas, números y guiones.' },
  err_network:      { ar: 'خطأ في الشبكة. حاول مجدداً.', fr: 'Erreur réseau. Réessayez.', en: 'Network error. Please try again.', es: 'Error de red. Inténtalo de nuevo.' },

  // Left panel (split-screen)
  hero_headline:    { ar: 'شغّل مطعمك بذكاء اصطناعي', fr: 'Pilotez votre restaurant avec l\'IA', en: 'Run your restaurant with AI', es: 'Gestiona tu restaurante con IA' },
  hero_sub:         { ar: 'القوائم، الطلبات، المخزون، التسويق والموظفون — كل شيء في منصة واحدة.', fr: 'Menus, commandes, stock, marketing et équipe — tout sur une seule plateforme.', en: 'Menus, orders, inventory, marketing and staff — all on one platform.', es: 'Menús, pedidos, stock, marketing y personal — todo en una plataforma.' },
  feat_menu:        { ar: 'قائمة رقمية عبر QR بدون تطبيق', fr: 'Menu numérique QR, sans application', en: 'QR digital menu, no app needed', es: 'Menú digital QR, sin app' },
  feat_ai:          { ar: 'رؤى ذكاء اصطناعي يومية لعملك', fr: 'Analyses IA quotidiennes de votre activité', en: 'Daily AI insights for your business', es: 'Análisis de IA diarios para tu negocio' },
  feat_ops:         { ar: 'إدارة الطلبات والمطبخ والموظفين', fr: 'Gestion commandes, cuisine & équipe', en: 'Orders, kitchen & staff management', es: 'Gestión de pedidos, cocina y personal' },
  feat_marketing:   { ar: 'تسويق تلقائي عبر واتساب وSocial', fr: 'Marketing automatisé WhatsApp & réseaux', en: 'Automated WhatsApp & social marketing', es: 'Marketing automático WhatsApp y redes' },
  trust_bar:        { ar: 'موثوق من طرف مطاعم في أفريقيا والخليج وأوروبا', fr: 'Utilisé par des restaurants en Afrique, GCC et Europe', en: 'Trusted by restaurants across Africa, GCC and Europe', es: 'Usado por restaurantes en África, Golfo y Europa' },
  stat_restaurants: { ar: 'مطعم نشط', fr: 'restaurants actifs', en: 'active restaurants', es: 'restaurantes activos' },
  stat_countries:   { ar: 'دولة', fr: 'pays', en: 'countries', es: 'países' },
  stat_uptime:      { ar: 'وقت تشغيل', fr: 'disponibilité', en: 'uptime', es: 'disponibilidad' },
  quote_text:       { ar: 'في أقل من ساعة كان كل شيء شغّال — طلبات، مطبخ، إدارة موظفين وإحصاءات. الإيرادات ارتفعت 25% الشهر الأول لأننا توقفنا عن خسارة الطلبات.', fr: "En moins d'une heure, toute l'opération était en ligne — commandes, cuisine, gestion du staff et analytics. Les revenus ont augmenté de 25% le premier mois.", en: 'In under an hour the entire operation was live — orders, kitchen, staff management and analytics. Revenue went up 25% the first month because we stopped losing orders.', es: 'En menos de una hora toda la operación estaba en línea — pedidos, cocina, personal y analíticas. Los ingresos subieron 25% el primer mes porque dejamos de perder pedidos.' },
  quote_author:     { ar: 'مديرة كافي لاتيه، أكادير', fr: 'Directrice, Café Latte — Agadir', en: 'Manager, Café Latte — Agadir', es: 'Directora, Café Latte — Agadir' },
  quote_name:       { ar: 'فاطمة بوزيدي', fr: 'Fatima Bouzidi', en: 'Fatima Bouzidi', es: 'Fatima Bouzidi' },
  step_label:       { ar: 'التسجيل', fr: 'Inscription', en: 'Sign up', es: 'Registro' },
} as const

type Key = keyof typeof D

function tx(key: Key, lang: Lang, vars?: Record<string, string>): string {
  let s: string = (D[key] as Record<Lang, string>)[lang] ?? (D[key] as Record<Lang, string>).en
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
  return s
}

// ─── Static data ──────────────────────────────────────────────────────────────

const LANG_OPTIONS: { code: Lang; native: string; flag: string }[] = [
  { code: 'ar', native: 'العربية',  flag: '🇲🇦' },
  { code: 'fr', native: 'Français', flag: '🇫🇷' },
  { code: 'en', native: 'English',  flag: '🇬🇧' },
  { code: 'es', native: 'Español',  flag: '🇪🇸' },
]

const COUNTRIES: { code: string; label: Record<Lang, string> }[] = [
  { code: 'MA', label: { ar: 'المغرب 🇲🇦',           fr: 'Maroc 🇲🇦',                en: 'Morocco 🇲🇦',       es: 'Marruecos 🇲🇦'      } },
  { code: 'SA', label: { ar: 'السعودية 🇸🇦',          fr: 'Arabie Saoudite 🇸🇦',      en: 'Saudi Arabia 🇸🇦',  es: 'Arabia Saudita 🇸🇦' } },
  { code: 'AE', label: { ar: 'الإمارات 🇦🇪',          fr: 'Émirats Arabes Unis 🇦🇪',  en: 'UAE 🇦🇪',           es: 'Emiratos 🇦🇪'       } },
  { code: 'FR', label: { ar: 'فرنسا 🇫🇷',             fr: 'France 🇫🇷',               en: 'France 🇫🇷',        es: 'Francia 🇫🇷'        } },
  { code: 'ES', label: { ar: 'إسبانيا 🇪🇸',           fr: 'Espagne 🇪🇸',              en: 'Spain 🇪🇸',         es: 'España 🇪🇸'         } },
  { code: 'US', label: { ar: 'الولايات المتحدة 🇺🇸',  fr: 'États-Unis 🇺🇸',           en: 'United States 🇺🇸', es: 'Estados Unidos 🇺🇸' } },
]

// ── Business types ────────────────────────────────────────────────────────────
// accountMode values: 'RESTAURANT' (default) | 'TRAITEUR'
type BusinessType = {
  value: string        // accountMode value stored in DB
  icon:  string
  label: Record<Lang, string>
  desc:  Record<Lang, string>
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    value: 'RESTAURANT',
    icon:  '🍽️',
    label: { ar: 'مطعم',      fr: 'Restaurant',   en: 'Restaurant',  es: 'Restaurante' },
    desc:  { ar: 'أكل ومأكولات يومية', fr: 'Cuisine du jour', en: 'Daily meals', es: 'Comidas diarias' },
  },
  {
    value: 'CAFE',
    icon:  '☕',
    label: { ar: 'مقهى',      fr: 'Café',          en: 'Café',        es: 'Cafetería' },
    desc:  { ar: 'مشروبات وحلويات', fr: 'Boissons & snacks', en: 'Drinks & snacks', es: 'Bebidas y snacks' },
  },
  {
    value: 'TRAITEUR',
    icon:  '🎂',
    label: { ar: 'تريتور',    fr: 'Traiteur',      en: 'Caterer',     es: 'Catering' },
    desc:  { ar: 'تنظيم مناسبات وحفلات', fr: 'Événements & buffets', en: 'Events & catering', es: 'Eventos y catering' },
  },
  {
    value: 'PASTRY',
    icon:  '🧁',
    label: { ar: 'حلويات',    fr: 'Pâtisserie',    en: 'Bakery',      es: 'Pastelería' },
    desc:  { ar: 'حلويات ومعجنات', fr: 'Gâteaux & viennoiseries', en: 'Cakes & pastries', es: 'Pasteles y repostería' },
  },
  {
    value: 'FOOD_TRUCK',
    icon:  '🚚',
    label: { ar: 'فود تراك',  fr: 'Food Truck',    en: 'Food Truck',  es: 'Food Truck' },
    desc:  { ar: 'مطعم متنقل', fr: 'Restaurant mobile', en: 'Mobile restaurant', es: 'Restaurante móvil' },
  },
  {
    value: 'HOTEL',
    icon:  '🏨',
    label: { ar: 'فندق',      fr: 'Hôtel',         en: 'Hotel',       es: 'Hotel' },
    desc:  { ar: 'خدمة الغرف والمطعم', fr: 'Room service & restaurant', en: 'Room service & dining', es: 'Room service y restaurante' },
  },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function toSlug(name: string): string {
  return name.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// ─── Inner component (needs useSearchParams, must be inside Suspense) ─────────

// Arab League country codes
const ARAB_COUNTRIES = new Set(['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'])
// French-speaking (non-Arab)
const FRENCH_COUNTRIES = new Set(['FR','BE','LU','CH','SN','CI','CM','ML','BF','NE','GN','CD','CG','MG','RW','BI','TG','BJ','GA','GQ','MU','SC','HT','VU','NC','PF','RE','GP','MQ','GF','PM'])
// Spanish-speaking
const SPANISH_COUNTRIES = new Set(['ES','MX','AR','CO','PE','VE','CL','EC','BO','PY','UY','CR','PA','DO','GT','HN','SV','NI','CU','PR'])

function SignupInner() {
  const params = useSearchParams()

  const urlLang = params.get('lang')
  const hasUrlLang = urlLang === 'ar' || urlLang === 'fr' || urlLang === 'en' || urlLang === 'es'

  const [lang, setLang]   = useState<Lang>(hasUrlLang ? (urlLang as Lang) : 'ar')
  const isRTL             = lang === 'ar'
  const dir               = isRTL ? 'rtl' : 'ltr'

  const [logoUrl, setLogoUrl] = useState('/assets/logo.png')
  // Pre-fill from the landing page's email-capture CTA (?email=...), if present
  const [form, setForm]   = useState({ cafeName: '', subdomain: '', email: params.get('email') ?? '', country: 'MA' })
  const [businessType, setBusinessType] = useState<string>('')
  const [manualSub, setManualSub] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error,   setError]       = useState<string | null>(null)
  const [emailTaken, setEmailTaken] = useState(false)
  const [sent,    setSent]        = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  // Fetch logo from landing config
  useEffect(() => {
    fetch('/api/public/landing-config')
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => { if (d?.logoImageUrl) setLogoUrl(d.logoImageUrl) })
      .catch(() => {})
  }, [])

  // IP-based language detection (only when no ?lang= param)
  useEffect(() => {
    if (hasUrlLang) return
    fetch('https://ipapi.co/json/')
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => {
        const cc: string = (d?.country_code ?? '').toUpperCase()
        if (ARAB_COUNTRIES.has(cc))   setLang('ar')
        else if (FRENCH_COUNTRIES.has(cc)) setLang('fr')
        else if (SPANISH_COUNTRIES.has(cc)) setLang('es')
        else if (cc)                   setLang('en')
      })
      .catch(() => {})
  }, [hasUrlLang])

  // Pick up inline error from magic-verify redirect
  useEffect(() => {
    const ve = params.get('verifyError')
    if (ve) setError(decodeURIComponent(ve))
  }, [params])

  // Auto-slug cafeName → subdomain
  useEffect(() => {
    if (!manualSub) setForm(f => ({ ...f, subdomain: toSlug(f.cafeName) }))
  }, [form.cafeName, manualSub])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'subdomain') setManualSub(true)
    setForm(f => ({ ...f, [name]: value }))
    setError(null)
    setEmailTaken(false)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!businessType) {
      setError(lang === 'ar' ? 'يرجى اختيار نوع المنشأة' : lang === 'fr' ? 'Choisissez le type d\'établissement' : 'Please select your establishment type')
      return
    }
    if (!form.cafeName.trim() || !form.subdomain.trim() || !form.email.trim()) {
      setError(tx('err_fields', lang)); return
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError(tx('err_email_fmt', lang)); return
    }
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(form.subdomain.trim())) {
      setError(tx('err_sub_fmt', lang)); return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/auth/magic-send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, businessType, lang })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.error?.toLowerCase().includes('email')) {
          setEmailTaken(true)
          return
        }
        setError(data.error ?? tx('err_fields', lang))
        return
      }
      setSentEmail(form.email.trim().toLowerCase())
      setSent(true)
    } catch {
      setError(tx('err_network', lang))
    } finally {
      setLoading(false)
    }
  }, [form, lang])

  // ── Success screen ───────────────────────────────────────────────────────────

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-950 via-blue-900 to-gray-900" dir={dir}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400 to-blue-500 px-8 py-8 text-center">
            <div className="text-6xl mb-3">✉️</div>
            <h1 className="text-xl font-extrabold text-white">{tx('ok_title', lang)}</h1>
          </div>
          <div className="px-8 py-8 text-center space-y-4">
            <p className="text-gray-700 leading-relaxed">{tx('ok_body', lang, { email: sentEmail })}</p>
            <p className="text-gray-400 text-sm">{tx('ok_spam', lang)}</p>
            <button
              onClick={() => { setSent(false); setError(null) }}
              className="text-blue-600 hover:text-blue-700 text-sm font-bold underline"
            >
              {tx('ok_back', lang)}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────────

  const FEATURES: { key: Key; icon: string }[] = [
    { key: 'feat_menu',      icon: '📱' },
    { key: 'feat_ai',        icon: '🧠' },
    { key: 'feat_ops',       icon: '🍳' },
    { key: 'feat_marketing', icon: '📣' },
  ]

  return (
    <div className="h-screen lg:flex overflow-hidden" dir={dir}>

      {/* ── Left panel — brand / benefits (hidden on mobile) ──────────────────── */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] h-screen relative flex-col justify-between bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-900 px-10 py-8 overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%23ffffff'/%3E%3C/svg%3E")` }}
        />
        <div className="absolute -top-20 -end-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -start-24 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -end-10 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand */}
        <Link href="/landing" className="relative flex items-center gap-2.5 shrink-0">
          <Image src={logoUrl} alt="Smart Resto" width={36} height={36} className="rounded-lg shadow-lg object-contain" unoptimized />
          <div className="flex flex-col leading-tight">
            <span className="text-white text-base font-extrabold">Smart Resto</span>
            <span className="text-blue-300 text-[11px] leading-tight max-w-[220px]">{tx('brand_tagline', lang)}</span>
          </div>
        </Link>

        {/* Headline + features */}
        <div className="relative min-h-0">
          <h2 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight mb-3">
            {tx('hero_headline', lang)}
          </h2>
          <p className="text-blue-200/90 text-sm leading-relaxed mb-5 max-w-md">
            {tx('hero_sub', lang)}
          </p>

          <ul className="space-y-2.5">
            {FEATURES.map(f => (
              <li key={f.key} className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-base shrink-0">{f.icon}</span>
                <span className="text-blue-50 text-sm font-medium">{tx(f.key, lang)}</span>
              </li>
            ))}
          </ul>

          {/* Testimonial */}
          <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-yellow-400 text-xs mb-1.5" dir="ltr">★★★★★</div>
            <p className="text-blue-50 text-xs leading-relaxed italic mb-2.5 line-clamp-3">
              &ldquo;{tx('quote_text', lang)}&rdquo;
            </p>
            <p className="text-white text-xs font-bold">{tx('quote_name', lang)}</p>
            <p className="text-blue-300 text-[11px]">{tx('quote_author', lang)}</p>
          </div>
        </div>

        {/* Stats + trust bar */}
        <div className="relative shrink-0">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-white text-xl font-extrabold">500+</div>
              <div className="text-blue-300 text-[11px]">{tx('stat_restaurants', lang)}</div>
            </div>
            <div>
              <div className="text-white text-xl font-extrabold">6+</div>
              <div className="text-blue-300 text-[11px]">{tx('stat_countries', lang)}</div>
            </div>
            <div>
              <div className="text-white text-xl font-extrabold">99.9%</div>
              <div className="text-blue-300 text-[11px]">{tx('stat_uptime', lang)}</div>
            </div>
          </div>
          <p className="text-blue-400/70 text-[11px]">{tx('trust_bar', lang)}</p>
        </div>
      </aside>

      {/* ── Right panel — form ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-gradient-to-b from-blue-50/40 via-white to-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 sm:px-10 lg:px-14 pt-5 lg:pt-6 shrink-0">
          <Link href="/landing" className="flex items-center gap-2 lg:hidden">
            <Image src={logoUrl} alt="Smart Resto" width={28} height={28} className="rounded-lg object-contain" unoptimized />
            <span className="text-gray-900 text-sm font-extrabold">Smart Resto</span>
          </Link>
          <Link href="/landing" className="hidden lg:flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">
            {tx('back_home', lang)}
          </Link>

          {/* Language picker */}
          <div className="flex gap-1.5">
            {LANG_OPTIONS.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                title={l.native}
                aria-label={l.native}
                className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm border transition-all ${
                  lang === l.code
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-4">
          <div className="w-full max-w-md">

            <div className="mb-4">
              <span className="inline-block text-[11px] font-bold tracking-wide uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-2">
                {tx('step_label', lang)}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">{tx('page_title', lang)}</h1>
              <p className="text-gray-500 text-sm mt-1">{tx('page_subtitle', lang)}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

              {/* Business type selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {tx('label_btype', lang)}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BUSINESS_TYPES.map((bt) => {
                    const selected = businessType === bt.value
                    return (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => { setBusinessType(bt.value); setError(null) }}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all text-center ${
                          selected
                            ? 'border-blue-400 bg-blue-50 shadow-sm shadow-blue-100'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="text-2xl leading-none">{bt.icon}</span>
                        <span className={`text-xs font-bold leading-tight ${selected ? 'text-blue-700' : 'text-gray-700'}`}>
                          {bt.label[lang]}
                        </span>
                        <span className={`text-[10px] leading-tight hidden sm:block ${selected ? 'text-blue-500' : 'text-gray-400'}`}>
                          {bt.desc[lang]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {/* Traiteur highlight banner */}
                {businessType === 'TRAITEUR' && (
                  <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
                    🎉{' '}
                    {lang === 'ar'
                      ? 'ستحصل على Smart Traîteur — لوحة تحكم متكاملة لإدارة الحجوزات والفعاليات والقوائم بشكل احترافي.'
                      : lang === 'fr'
                      ? 'Vous accéderez à Smart Traiteur — tableau de bord complet pour gérer vos événements, réservations et menus.'
                      : 'You\'ll get Smart Caterer — a full dashboard to manage your events, bookings and menus professionally.'}
                  </div>
                )}
              </div>

              {/* Cafe name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {businessType === 'TRAITEUR'
                    ? (lang === 'ar' ? 'اسم شركة التريتور' : lang === 'fr' ? 'Nom de votre entreprise traiteur' : 'Catering company name')
                    : tx('label_cafe', lang)
                  }
                </label>
                <input
                  type="text"
                  name="cafeName"
                  value={form.cafeName}
                  onChange={handleChange}
                  placeholder={tx('ph_cafe', lang)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-gray-400 transition-shadow"
                />
              </div>

              {/* Subdomain */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tx('label_sub', lang)}</label>
                <div className={`flex items-stretch rounded-2xl overflow-hidden border-2 border-blue-100 bg-blue-50/40 focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex items-center gap-2 px-4 text-blue-500 ${isRTL ? 'border-l' : 'border-r'} border-blue-100`}>
                    <Globe className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    name="subdomain"
                    value={form.subdomain}
                    onChange={handleChange}
                    placeholder={tx('ph_sub', lang)}
                    required
                    pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                    dir="ltr"
                    className="flex-1 px-3 py-3.5 focus:outline-none text-gray-800 placeholder-gray-400 bg-transparent min-w-0 text-base font-medium"
                  />
                  <span className={`flex items-center px-4 bg-blue-100/60 text-blue-700 text-sm font-semibold whitespace-nowrap ${isRTL ? 'border-l' : 'border-r'} border-blue-100`}>
                    .smartrestau.com
                  </span>
                </div>
                {form.subdomain && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <span>{tx('sub_preview', lang)}</span>
                    <span dir="ltr" className="font-mono font-bold">{form.subdomain}.smartrestau.com</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tx('label_email', lang)}</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={tx('ph_email', lang)}
                  required
                  dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-gray-400 transition-shadow"
                />
                <p className="text-xs text-gray-400 mt-1">{tx('email_hint', lang)}</p>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tx('label_country', lang)}</label>
                <select
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 bg-white transition-shadow"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label[lang]}</option>
                  ))}
                </select>
              </div>

              {/* Email already taken — show login prompt */}
              {emailTaken && (
                <div className={`bg-blue-50 border border-blue-300 rounded-xl px-4 py-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="font-semibold text-blue-800 mb-2">
                    {lang === 'ar' ? '⚠️ هذا البريد الإلكتروني مسجل مسبقاً'
                     : lang === 'fr' ? '⚠️ Cet e-mail est déjà enregistré'
                     : lang === 'es' ? '⚠️ Este correo ya está registrado'
                     : '⚠️ This email already has an account'}
                  </p>
                  <p className="text-blue-700 mb-3">
                    {lang === 'ar' ? 'يرجى تسجيل الدخول للوصول إلى لوحة التحكم.'
                     : lang === 'fr' ? 'Veuillez vous connecter pour accéder à votre tableau de bord.'
                     : lang === 'es' ? 'Por favor inicia sesión para acceder a tu panel.'
                     : 'Please log in to access your dashboard.'}
                  </p>
                  <Link
                    href={`/login?lang=${lang}`}
                    className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 py-2 rounded-xl transition-colors text-sm"
                  >
                    {lang === 'ar' ? 'تسجيل الدخول ←'
                     : lang === 'fr' ? 'Se connecter →'
                     : lang === 'es' ? 'Iniciar sesión →'
                     : 'Log in →'}
                  </Link>
                </div>
              )}

              {/* Generic error message */}
              {error && !emailTaken && (
                <div className={`bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-extrabold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-200/60"
              >
                {loading ? tx('btn_sending', lang) : tx('btn_send', lang)}
              </button>

              {/* Login link */}
              <p className="text-center text-sm text-gray-500">
                {tx('have_account', lang)}{' '}
                <Link href={`/login?lang=${lang}`} className="text-blue-600 font-bold hover:underline">
                  {tx('sign_in', lang)}
                </Link>
              </p>

            </form>

            {/* Trust badges */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
              <span>{tx('badge_card', lang)}</span>
              <span>{tx('badge_trial', lang)}</span>
              <span>{tx('badge_cancel', lang)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Page export (Suspense required for useSearchParams) ──────────────────────

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-blue-950">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupInner />
    </Suspense>
  )
}
