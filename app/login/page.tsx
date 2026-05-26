'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'Restaurant Management Dashboard',
    email: 'Email Address', emailPh: 'admin@restaurant.com',
    password: 'Password', passwordPh: '••••••••',
    submit: 'Sign In', submitting: 'Signing in...',
    demoTitle: 'Try a Demo Account',
    demoSub: 'Click any account to auto-fill credentials',
    demoSignIn: 'Sign in as',
    noAccount: "Don't have an account?", signup: 'Sign up free',
    forgotPassword: 'Forgot password?',
    country: 'Country', restaurant: 'Restaurant',
  },
  fr: {
    tagline: 'Tableau de bord Restaurant',
    email: 'Adresse Email', emailPh: 'admin@restaurant.com',
    password: 'Mot de passe', passwordPh: '••••••••',
    submit: 'Se connecter', submitting: 'Connexion...',
    demoTitle: 'Essayer un Compte Démo',
    demoSub: 'Cliquez sur un compte pour remplir automatiquement',
    demoSignIn: 'Se connecter en tant que',
    noAccount: "Pas encore de compte ?", signup: 'Inscription gratuite',
    forgotPassword: 'Mot de passe oublié ?',
    country: 'Pays', restaurant: 'Restaurant',
  },
  ar: {
    tagline: 'لوحة تحكم المطعم',
    email: 'البريد الإلكتروني', emailPh: 'admin@restaurant.com',
    password: 'كلمة المرور', passwordPh: '••••••••',
    submit: 'تسجيل الدخول', submitting: 'جاري تسجيل الدخول...',
    demoTitle: 'جرّب حساباً تجريبياً',
    demoSub: 'اضغط على أي حساب لملء البيانات تلقائياً',
    demoSignIn: 'الدخول كـ',
    noAccount: 'ليس لديك حساب؟', signup: 'ابدأ مجاناً',
    forgotPassword: 'نسيت كلمة المرور؟',
    country: 'الدولة', restaurant: 'المطعم',
  },
}

// ─── Demo accounts ─────────────────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  // ── Gulf & Middle East ──────────────────────────────────────────────────────
  {
    flag: '🇲🇦',
    country: { en: 'Morocco', fr: 'Maroc', ar: 'المغرب' },
    name: 'Café de la Plage',
    city: { en: 'Agadir', fr: 'Agadir', ar: 'أكادير' },
    email: 'plage@demo.com',
    password: 'demo1234',
    color: 'border-emerald-700/50 hover:border-emerald-500 hover:bg-emerald-950/40',
    badge: 'bg-emerald-900/60 text-emerald-300',
  },
  {
    flag: '🇸🇦',
    country: { en: 'Saudi Arabia', fr: 'Arabie Saoudite', ar: 'السعودية' },
    name: 'مطعم نجد الأصيل',
    city: { en: 'Riyadh', fr: 'Riyad', ar: 'الرياض' },
    email: 'najd@demo.com',
    password: 'demo1234',
    color: 'border-green-700/50 hover:border-green-500 hover:bg-green-950/40',
    badge: 'bg-green-900/60 text-green-300',
  },
  {
    flag: '🇦🇪',
    country: { en: 'UAE', fr: 'Émirats', ar: 'الإمارات' },
    name: 'مطعم الخليج',
    city: { en: 'Dubai', fr: 'Dubaï', ar: 'دبي' },
    email: 'khalij@demo.com',
    password: 'demo1234',
    color: 'border-red-700/50 hover:border-red-500 hover:bg-red-950/40',
    badge: 'bg-red-900/60 text-red-300',
  },
  // ── North Africa ────────────────────────────────────────────────────────────
  {
    flag: '🇩🇿',
    country: { en: 'Algeria', fr: 'Algérie', ar: 'الجزائر' },
    name: 'مطعم القصبة',
    city: { en: 'Algiers', fr: 'Alger', ar: 'الجزائر العاصمة' },
    email: 'casbah@demo.com',
    password: 'demo1234',
    color: 'border-teal-700/50 hover:border-teal-500 hover:bg-teal-950/40',
    badge: 'bg-teal-900/60 text-teal-300',
  },
  {
    flag: '🇹🇳',
    country: { en: 'Tunisia', fr: 'Tunisie', ar: 'تونس' },
    name: 'مطعم سيدي بوسعيد',
    city: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' },
    email: 'sidi@demo.com',
    password: 'demo1234',
    color: 'border-rose-700/50 hover:border-rose-500 hover:bg-rose-950/40',
    badge: 'bg-rose-900/60 text-rose-300',
  },
  {
    flag: '🇱🇾',
    country: { en: 'Libya', fr: 'Libye', ar: 'ليبيا' },
    name: 'مطعم طرابلس',
    city: { en: 'Tripoli', fr: 'Tripoli', ar: 'طرابلس' },
    email: 'tripoli@demo.com',
    password: 'demo1234',
    color: 'border-sky-700/50 hover:border-sky-500 hover:bg-sky-950/40',
    badge: 'bg-sky-900/60 text-sky-300',
  },
  {
    flag: '🇪🇬',
    country: { en: 'Egypt', fr: 'Égypte', ar: 'مصر' },
    name: 'مطعم النيل',
    city: { en: 'Cairo', fr: 'Le Caire', ar: 'القاهرة' },
    email: 'nil@demo.com',
    password: 'demo1234',
    color: 'border-amber-700/50 hover:border-amber-500 hover:bg-amber-950/40',
    badge: 'bg-amber-900/60 text-amber-300',
  },
  // ── Sub-Saharan Africa ───────────────────────────────────────────────────────
  {
    flag: '🇸🇳',
    country: { en: 'Senegal', fr: 'Sénégal', ar: 'السنغال' },
    name: 'Restaurant Teranga',
    city: { en: 'Dakar', fr: 'Dakar', ar: 'داكار' },
    email: 'teranga@demo.com',
    password: 'demo1234',
    color: 'border-yellow-700/50 hover:border-yellow-500 hover:bg-yellow-950/40',
    badge: 'bg-yellow-900/60 text-yellow-300',
  },
  {
    flag: '🇨🇮',
    country: { en: "Côte d'Ivoire", fr: "Côte d'Ivoire", ar: 'ساحل العاج' },
    name: 'Maquis Le Baobab',
    city: { en: 'Abidjan', fr: 'Abidjan', ar: 'أبيدجان' },
    email: 'baobab@demo.com',
    password: 'demo1234',
    color: 'border-orange-700/50 hover:border-orange-500 hover:bg-orange-950/40',
    badge: 'bg-orange-900/60 text-orange-300',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [activeDemo, setActiveDemo] = useState<string | null>(null)

  const isRtl = lang === 'ar'
  const t = (k: string) => T[lang][k] ?? k

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      localStorage.setItem('token',     data.token)
      localStorage.setItem('cafeId',    data.cafeId)
      localStorage.setItem('subdomain', data.subdomain ?? '')
      router.push('/admin/dashboard')
    } catch {
      setError(lang === 'ar' ? 'خطأ في الشبكة' : lang === 'fr' ? 'Erreur réseau' : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setActiveDemo(acc.email)
    setError('')
  }

  const LANGS: { code: Lang; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'ar', label: 'AR' },
  ]

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Language switcher — top right */}
      <div className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800`}>
        {LANGS.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${lang === l.code ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-md space-y-5">

        {/* ── Logo & tagline ── */}
        <div className="text-center mb-2">
          <Image
            src="/assets/logo.png"
            alt="SmartMenu"
            width={72}
            height={72}
            className="mx-auto mb-4 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SmartMenu</h1>
          <p className="text-gray-500 text-sm mt-1">{t('tagline')}</p>
        </div>

        {/* ── Login form ── */}
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {error && (
            <div className="bg-red-900/40 border border-red-700/60 text-red-300 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 font-medium mb-1.5">{t('email')}</label>
              <div className="relative">
                <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t('emailPh')}
                  dir="ltr"
                  className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className={`flex items-center justify-between mb-1.5`}>
                <label className="text-sm text-gray-400 font-medium">{t('password')}</label>
                <a href="#" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">{t('forgotPassword')}</a>
              </div>
              <div className="relative">
                <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t('passwordPh')}
                  dir="ltr"
                  className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors`}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('submitting')}</>
                : <>{t('submit')}<ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className={`mt-5 text-center text-sm text-gray-500`}>
            {t('noAccount')}{' '}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              {t('signup')}
            </Link>
          </p>
        </div>

        {/* ── Demo accounts ── */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-sm font-bold text-white">{t('demoTitle')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('demoSub')}</p>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc)}
                className={`w-full border rounded-xl p-3.5 transition-all text-left group ${acc.color} ${activeDemo === acc.email ? 'ring-1 ring-emerald-500' : ''}`}
              >
                <div className={`flex items-start justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {/* Left: flag + name */}
                  <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-2xl leading-none">{acc.flag}</span>
                    <div className={isRtl ? 'text-right' : ''}>
                      <p className="text-sm font-bold text-white leading-tight">{acc.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {acc.country[lang]} · {acc.city[lang]}
                      </p>
                    </div>
                  </div>
                  {/* Right: credentials */}
                  <div className={`shrink-0 ${isRtl ? 'text-left' : 'text-right'}`}>
                    <p className="text-xs text-gray-400 font-mono leading-tight">{acc.email}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${acc.badge}`}>
                      demo1234
                    </span>
                  </div>
                </div>
                {activeDemo === acc.email && (
                  <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {t('demoSignIn')} {acc.name}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pb-4">
          © {new Date().getFullYear()} SmartMenu · MA · SA · AE · SN · CI · KE
        </p>

      </div>
    </div>
  )
}
