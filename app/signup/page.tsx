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

// ─── i18n (client-side subset) ────────────────────────────────────────────────

type Lang = 'ar' | 'fr' | 'en' | 'es'

const D = {
  page_title:       { ar: 'أنشئ حسابك مجاناً', fr: 'Créer votre compte', en: 'Create your account', es: 'Crea tu cuenta' },
  page_subtitle:    { ar: 'جاهز في دقيقتين · بدون بطاقة بنكية', fr: 'Prêt en 2 min · Sans carte bancaire', en: 'Ready in 2 min · No credit card', es: 'Listo en 2 min · Sin tarjeta' },
  brand_tagline:    { ar: 'قائمة طعام ذكية لمطعمك', fr: 'Menu numérique intelligent', en: 'Smart digital menu', es: 'Menú digital inteligente' },
  label_lang:       { ar: 'اللغة', fr: 'Langue', en: 'Language', es: 'Idioma' },
  label_cafe:       { ar: 'اسم المطعم أو المقهى', fr: 'Nom du restaurant / café', en: 'Restaurant or café name', es: 'Nombre del restaurante / café' },
  label_sub:        { ar: 'رابط المطعم (subdomain)', fr: 'Adresse web (sous-domaine)', en: 'Web address (subdomain)', es: 'Dirección web (subdominio)' },
  label_email:      { ar: 'البريد الإلكتروني', fr: 'Adresse e-mail', en: 'E-mail address', es: 'Correo electrónico' },
  label_country:    { ar: 'الدولة', fr: 'Pays', en: 'Country', es: 'País' },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function toSlug(name: string): string {
  return name.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// ─── Inner component (needs useSearchParams, must be inside Suspense) ─────────

function SignupInner() {
  const params = useSearchParams()

  const initialLang: Lang = (() => {
    const q = params.get('lang')
    if (q === 'ar' || q === 'fr' || q === 'en' || q === 'es') return q
    return 'ar'
  })()

  const [lang, setLang]   = useState<Lang>(initialLang)
  const isRTL             = lang === 'ar'
  const dir               = isRTL ? 'rtl' : 'ltr'

  const [form, setForm]   = useState({ cafeName: '', subdomain: '', email: '', country: 'MA' })
  const [manualSub, setManualSub] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error,   setError]       = useState<string | null>(null)
  const [emailTaken, setEmailTaken] = useState(false)
  const [sent,    setSent]        = useState(false)
  const [sentEmail, setSentEmail] = useState('')

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
        body:    JSON.stringify({ ...form, lang })
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-emerald-950 via-emerald-900 to-gray-900" dir={dir}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-8 text-center">
            <div className="text-6xl mb-3">✉️</div>
            <h1 className="text-xl font-extrabold text-white">{tx('ok_title', lang)}</h1>
          </div>
          <div className="px-8 py-8 text-center space-y-4">
            <p className="text-gray-700 leading-relaxed">{tx('ok_body', lang, { email: sentEmail })}</p>
            <p className="text-gray-400 text-sm">{tx('ok_spam', lang)}</p>
            <button
              onClick={() => { setSent(false); setError(null) }}
              className="text-amber-600 hover:text-amber-700 text-sm font-bold underline"
            >
              {tx('ok_back', lang)}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-emerald-950 via-emerald-900 to-gray-900"
      dir={dir}
    >
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%23ffffff'/%3E%3C/svg%3E")` }}
      />

      {/* Brand */}
      <Link href="/landing" className="mb-8 flex flex-col items-center gap-2">
        <Image src="/assets/logo.png" alt="Smart Resto" width={56} height={56} className="rounded-2xl shadow-lg" />
        <span className="text-white text-xl font-extrabold">Smart Resto</span>
        <span className="text-emerald-300 text-sm">{tx('brand_tagline', lang)}</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Card header */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-6 text-center">
          <h1 className="text-2xl font-extrabold text-white">{tx('page_title', lang)}</h1>
          <p className="text-amber-100 text-sm mt-1">{tx('page_subtitle', lang)}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pt-6 pb-8 space-y-5" noValidate>

          {/* Language picker */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{tx('label_lang', lang)}</p>
            <div className="flex gap-2 flex-wrap">
              {LANG_OPTIONS.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    lang === l.code
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {l.flag} {l.native}
                </button>
              ))}
            </div>
          </div>

          {/* Cafe name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tx('label_cafe', lang)}</label>
            <input
              type="text"
              name="cafeName"
              value={form.cafeName}
              onChange={handleChange}
              placeholder={tx('ph_cafe', lang)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* Subdomain */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tx('label_sub', lang)}</label>
            <div className={`flex rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-amber-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input
                type="text"
                name="subdomain"
                value={form.subdomain}
                onChange={handleChange}
                placeholder={tx('ph_sub', lang)}
                required
                pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                dir="ltr"
                className="flex-1 px-4 py-3 focus:outline-none text-gray-800 placeholder-gray-400 bg-white min-w-0"
              />
              <span className={`flex items-center px-3 bg-gray-50 text-gray-400 text-xs whitespace-nowrap ${isRTL ? 'border-l' : 'border-r'} border-gray-200`}>
                .smartmenu.ma
              </span>
            </div>
            {form.subdomain && (
              <p className="text-xs text-emerald-600 mt-1">
                {tx('sub_preview', lang)}{' '}
                <span dir="ltr" className="font-mono font-bold">{form.subdomain}.smartmenu.ma</span>
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 bg-white"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label[lang]}</option>
              ))}
            </select>
          </div>

          {/* Email already taken — show login prompt */}
          {emailTaken && (
            <div className={`bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="font-semibold text-amber-800 mb-2">
                {lang === 'ar' ? '⚠️ هذا البريد الإلكتروني مسجل مسبقاً'
                 : lang === 'fr' ? '⚠️ Cet e-mail est déjà enregistré'
                 : lang === 'es' ? '⚠️ Este correo ya está registrado'
                 : '⚠️ This email already has an account'}
              </p>
              <p className="text-amber-700 mb-3">
                {lang === 'ar' ? 'يرجى تسجيل الدخول للوصول إلى لوحة التحكم.'
                 : lang === 'fr' ? 'Veuillez vous connecter pour accéder à votre tableau de bord.'
                 : lang === 'es' ? 'Por favor inicia sesión para acceder a tu panel.'
                 : 'Please log in to access your dashboard.'}
              </p>
              <Link
                href={`/login?lang=${lang}`}
                className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-bold px-5 py-2 rounded-xl transition-colors text-sm"
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
            className="w-full py-4 rounded-xl font-extrabold text-white text-base transition-all active:scale-95 disabled:opacity-60 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 shadow-lg shadow-amber-200"
          >
            {loading ? tx('btn_sending', lang) : tx('btn_send', lang)}
          </button>

          {/* Login link */}
          <p className={`text-center text-sm text-gray-500`}>
            {tx('have_account', lang)}{' '}
            <Link href={`/login?lang=${lang}`} className="text-amber-600 font-bold hover:underline">
              {tx('sign_in', lang)}
            </Link>
          </p>

        </form>

        {/* Trust badges */}
        <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <span>{tx('badge_card', lang)}</span>
          <span>{tx('badge_trial', lang)}</span>
          <span>{tx('badge_cancel', lang)}</span>
        </div>
      </div>

      {/* Back link */}
      <Link href="/landing" className="mt-6 text-emerald-300 text-sm hover:text-white transition-colors">
        {tx('back_home', lang)}
      </Link>
    </div>
  )
}

// ─── Page export (Suspense required for useSearchParams) ──────────────────────

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-emerald-950">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupInner />
    </Suspense>
  )
}
