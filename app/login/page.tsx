'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Crown, Monitor, ChefHat, Bell, ChevronLeft } from 'lucide-react'

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'Restaurant Management Dashboard',
    email: 'Email Address', emailPh: 'admin@restaurant.com',
    password: 'Password', passwordPh: '••••••••',
    submit: 'Sign In', submitting: 'Signing in...',
    demoTitle: 'Try a Demo',
    demoSub: 'Choose a role to explore the platform',
    noAccount: "Don't have an account?", signup: 'Sign up free',
    forgotPassword: 'Forgot password?',
    orAdmin: 'Admin login',
    back: 'Back',
    connecting: 'Connecting...',
  },
  fr: {
    tagline: 'Tableau de bord Restaurant',
    email: 'Adresse Email', emailPh: 'admin@restaurant.com',
    password: 'Mot de passe', passwordPh: '••••••••',
    submit: 'Se connecter', submitting: 'Connexion...',
    demoTitle: 'Essayer la Démo',
    demoSub: 'Choisissez un rôle pour explorer la plateforme',
    noAccount: 'Pas encore de compte ?', signup: 'Inscription gratuite',
    forgotPassword: 'Mot de passe oublié ?',
    orAdmin: 'Connexion admin',
    back: 'Retour',
    connecting: 'Connexion...',
  },
  ar: {
    tagline: 'لوحة تحكم المطعم',
    email: 'البريد الإلكتروني', emailPh: 'admin@restaurant.com',
    password: 'كلمة المرور', passwordPh: '••••••••',
    submit: 'تسجيل الدخول', submitting: 'جاري الدخول...',
    demoTitle: 'جرّب الديمو',
    demoSub: 'اختر دورك واستكشف المنصة',
    noAccount: 'ليس لديك حساب؟', signup: 'ابدأ مجاناً',
    forgotPassword: 'نسيت كلمة المرور؟',
    orAdmin: 'دخول المدير',
    back: 'رجوع',
    connecting: 'جاري الدخول...',
  },
}

// ─── Demo cafe config ──────────────────────────────────────────────────────────

const DEMO_CAFE = {
  flag: '🇲🇦',
  name: 'Café de la Plage',
  city: { en: 'Agadir', fr: 'Agadir', ar: 'أكادير' },
  subdomain: 'plage',
  email: 'plage@demo.com',
  password: 'demo1234',
}

const DEMO_ROLES = [
  {
    role: 'BOSS',
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    label: { en: 'Admin', fr: 'Gérant', ar: 'المدير' },
    sub:   { en: 'Full dashboard', fr: 'Tableau de bord', ar: 'لوحة التحكم' },
    pin: null,
    dest: '/admin/dashboard',
  },
  {
    role: 'CASHIER',
    icon: Monitor,
    gradient: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20',
    label: { en: 'Cashier', fr: 'Caissier', ar: 'الكاشير' },
    sub:   { en: 'Point of sale', fr: 'Point de vente', ar: 'نقطة البيع' },
    pin: '1234',
    dest: '/pos',
  },
  {
    role: 'SUPERVISOR',
    icon: ChefHat,
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
    label: { en: 'Kitchen', fr: 'Cuisine', ar: 'المطبخ' },
    sub:   { en: 'Orders screen', fr: 'Écran commandes', ar: 'شاشة الطلبات' },
    pin: '3333',
    dest: '/kitchen',
  },
  {
    role: 'WAITER',
    icon: Bell,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20',
    label: { en: 'Waiter', fr: 'Serveur', ar: 'النادل' },
    sub:   { en: 'Table service', fr: 'Service tables', ar: 'خدمة الطاولات' },
    pin: '2222',
    dest: '/waiter',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [lang, setLang]         = useState<Lang>('fr')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [demoLoading, setDemoLoading]     = useState<string | null>(null)
  const [demoError, setDemoError]         = useState('')
  const [showMagicOption, setShowMagicOption] = useState(false)
  const [magicSent, setMagicSent]             = useState(false)
  const [magicLoading, setMagicLoading]       = useState(false)

  const isRtl = lang === 'ar'
  const t = (k: string) => T[lang][k] ?? k

  // ── Admin email login ──────────────────────────────────────────────────────
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
      if (!res.ok) {
        setError(data.error || 'Login failed')
        setShowMagicOption(true)
        return
      }
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

  async function sendMagicLogin() {
    if (!email) return
    setMagicLoading(true)
    try {
      await fetch('/api/auth/magic-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setMagicSent(true)
    } catch {}
    finally { setMagicLoading(false) }
  }

  // ── Demo role login ────────────────────────────────────────────────────────
  async function loginAsRole(roleConfig: typeof DEMO_ROLES[number]) {
    setDemoLoading(roleConfig.role)
    setDemoError('')
    try {
      if (roleConfig.role === 'BOSS') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: DEMO_CAFE.email, password: DEMO_CAFE.password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setDemoError(data.error ?? 'Erreur de connexion')
          setDemoLoading(null)
          return
        }
        localStorage.setItem('token',     data.token)
        localStorage.setItem('cafeId',    data.cafeId)
        localStorage.setItem('subdomain', data.subdomain ?? '')
        router.push('/admin/dashboard')
      } else {
        const res = await fetch('/api/pos/shift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: DEMO_CAFE.subdomain, pinCode: roleConfig.pin, action: 'login' }),
        })
        const data = await res.json()
        if (!res.ok) {
          setDemoError(data.error ?? 'PIN invalide')
          setDemoLoading(null)
          return
        }
        const { token, staff } = data
        localStorage.setItem('posToken',         token)
        localStorage.setItem('cafeId',           JSON.parse(atob(token.split('.')[1])).cafeId)
        localStorage.setItem('posLastSubdomain', DEMO_CAFE.subdomain)
        localStorage.setItem('staffName',        staff.name)
        localStorage.setItem('kitchenToken',     token)
        window.location.href = roleConfig.dest
      }
    } catch (err) {
      setDemoError(lang === 'ar' ? 'خطأ في الشبكة' : 'Erreur réseau')
      setDemoLoading(null)
    }
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

      {/* Language switcher */}
      <div className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800`}>
        {LANGS.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${lang === l.code ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-md space-y-4">

        {/* ── Logo ── */}
        <div className="text-center mb-2">
          <Image src="/assets/logo.png" alt="SmartMenu" width={72} height={72} priority
            className="mx-auto mb-4 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SmartMenu</h1>
          <p className="text-gray-500 text-sm mt-1">{t('tagline')}</p>
        </div>

        {/* ── Demo section ── */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-white">{t('demoTitle')} — {DEMO_CAFE.flag} {DEMO_CAFE.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('demoSub')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ROLES.map(r => {
              const Icon = r.icon
              const isLoading = demoLoading === r.role
              return (
                <button
                  key={r.role}
                  onClick={() => loginAsRole(r)}
                  disabled={demoLoading !== null}
                  className={`relative border rounded-2xl p-4 text-left transition-all active:scale-95 disabled:opacity-60 ${r.bg}`}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-3`}>
                    {isLoading
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Icon className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-white font-bold text-sm leading-tight">{r.label[lang]}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{r.sub[lang]}</p>
                  {r.pin && (
                    <span className="absolute top-3 right-3 text-[10px] font-mono text-gray-600">
                      PIN {r.pin}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {demoError && (
            <div className="mt-3 bg-red-900/40 border border-red-700/50 text-red-300 text-xs rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {demoError}
            </div>
          )}
        </div>

        {/* ── Admin login (collapsible) ── */}
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <button
            onClick={() => setShowAdminForm(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="font-semibold">{t('orAdmin')}</span>
            <ChevronLeft className={`w-4 h-4 transition-transform ${showAdminForm ? (isRtl ? 'rotate-90' : '-rotate-90') : (isRtl ? '-rotate-90' : 'rotate-90')}`} />
          </button>

          {showAdminForm && (
            <div className="px-5 pb-5 space-y-4 border-t border-gray-800 pt-4">
              {error && (
                <div className="space-y-2">
                  <div className="bg-red-900/40 border border-red-700/60 text-red-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {error}
                  </div>
                  {showMagicOption && !magicSent && (
                    <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
                      <p className="mb-2">
                        {lang === 'ar' ? 'سجّلت عبر رابط البريد؟' :
                         lang === 'fr' ? 'Compte créé via lien magique ?' :
                         'Signed up via email link?'}
                      </p>
                      <button type="button" onClick={sendMagicLogin} disabled={magicLoading || !email}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors">
                        {magicLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        {lang === 'ar' ? 'إرسال رابط الدخول' : lang === 'fr' ? 'Envoyer le lien' : 'Send login link'}
                      </button>
                    </div>
                  )}
                  {magicSent && (
                    <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
                      {lang === 'ar' ? '✅ تم إرسال رابط الدخول' :
                       lang === 'fr' ? '✅ Lien envoyé — vérifiez votre boîte mail' :
                       '✅ Login link sent — check your inbox'}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 font-medium mb-1.5">{t('email')}</label>
                  <div className="relative">
                    <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder={t('emailPh')} dir="ltr"
                      className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-gray-400 font-medium">{t('password')}</label>
                    <a href="#" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">{t('forgotPassword')}</a>
                  </div>
                  <div className="relative">
                    <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={t('passwordPh')} dir="ltr"
                      className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`} />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors`}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{t('submitting')}</>
                    : <>{t('submit')}<ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500">
                {t('noAccount')}{' '}
                <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  {t('signup')}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pb-4">
          © {new Date().getFullYear()} SmartMenu · MA · SA · AE · SN · CI · KE
        </p>

      </div>
    </div>
  )
}
