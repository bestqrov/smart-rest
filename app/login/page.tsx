'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Crown, Monitor, ChefHat, Bell, Send, CheckCircle, AlertCircle } from 'lucide-react'

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'The Business OS for Food & Hospitality',
    demoTitle: 'Try a live demo',
    demoSub: 'One click · No signup needed',
    adminTitle: 'Sign in to your account',
    adminSub: 'Welcome back',
    email: 'Email address', emailPh: 'you@restaurant.com',
    password: 'Password', passwordPh: '••••••••',
    submit: 'Sign in', submitting: 'Signing in…',
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset your password',
    forgotSub: "Enter your email — we'll send you a sign-in link.",
    forgotSend: 'Send link', forgotSending: 'Sending…',
    forgotDone: 'Check your inbox — link sent!',
    noAccount: "No account yet?", signup: 'Sign up free',
    back: '← Back',
    copyright: 'Business OS · Food & Hospitality',
    orWith: 'or continue with',
    googleBtn: 'Sign in with Google',
    errInvalid: 'Incorrect email or password. Forgot your password?',
    errNetwork: 'Network error — please try again',
    errGoogleOnly: 'This account uses Google sign-in. Click "Sign in with Google" below.',
    errGoogleNoAccount: 'No account found for this email. Sign up first.',
    errGoogleFailed: 'Google sign-in failed. Try again.',
    demoErrUnavailable: 'Demo not available — try again in a moment',
    demoErrPin: 'PIN error — please try again',
    demoErrNetwork: 'Network error',
    hint: 'Tip: use the magic link (forgot password) to sign in without a password',
  },
  fr: {
    tagline: 'The Business OS for Food & Hospitality',
    demoTitle: 'Essayer la démo en direct',
    demoSub: 'Un clic · Sans inscription',
    adminTitle: 'Connexion à votre compte',
    adminSub: 'Bienvenue',
    email: 'Adresse email', emailPh: 'vous@restaurant.com',
    password: 'Mot de passe', passwordPh: '••••••••',
    submit: 'Se connecter', submitting: 'Connexion…',
    forgotPassword: 'Mot de passe oublié ?',
    forgotTitle: 'Réinitialiser le mot de passe',
    forgotSub: 'Entrez votre email — nous vous enverrons un lien de connexion.',
    forgotSend: 'Envoyer le lien', forgotSending: 'Envoi…',
    forgotDone: 'Vérifiez votre boîte mail — lien envoyé !',
    noAccount: 'Pas encore de compte ?', signup: 'Inscription gratuite',
    back: '← Retour',
    copyright: 'Business OS · Food & Hospitality',
    orWith: 'ou continuer avec',
    googleBtn: 'Se connecter avec Google',
    errInvalid: 'Email ou mot de passe incorrect. Mot de passe oublié ?',
    errNetwork: 'Erreur réseau — réessayez',
    errGoogleOnly: 'Ce compte utilise Google. Cliquez "Se connecter avec Google" ci-dessous.',
    errGoogleNoAccount: 'Aucun compte trouvé. Inscrivez-vous d\'abord.',
    errGoogleFailed: 'Connexion Google échouée. Réessayez.',
    demoErrUnavailable: 'Démo non disponible — réessayez',
    demoErrPin: 'Erreur PIN — réessayez',
    demoErrNetwork: 'Erreur réseau',
    hint: 'Astuce : utilisez le lien magique (mot de passe oublié) pour vous connecter sans mot de passe',
  },
  ar: {
    tagline: 'The Business OS for Food & Hospitality',
    demoTitle: 'جرّب الديمو مباشرة',
    demoSub: 'نقرة واحدة · بدون تسجيل',
    adminTitle: 'تسجيل الدخول إلى حسابك',
    adminSub: 'أهلاً بك',
    email: 'البريد الإلكتروني', emailPh: 'you@restaurant.com',
    password: 'كلمة المرور', passwordPh: '••••••••',
    submit: 'دخول', submitting: 'جاري الدخول…',
    forgotPassword: 'نسيت كلمة المرور؟',
    forgotTitle: 'استعادة كلمة المرور',
    forgotSub: 'أدخل بريدك — سنرسل لك رابط دخول فوري.',
    forgotSend: 'إرسال الرابط', forgotSending: 'جاري الإرسال…',
    forgotDone: '✅ تم الإرسال — تحقق من بريدك',
    noAccount: 'ليس لديك حساب؟', signup: 'ابدأ مجاناً',
    back: 'رجوع ←',
    copyright: 'Business OS · Food & Hospitality',
    orWith: 'أو الدخول عبر',
    googleBtn: 'الدخول بحساب Google',
    errInvalid: 'البريد أو كلمة المرور غير صحيحة. هل نسيت كلمة المرور؟',
    errNetwork: 'خطأ في الشبكة — حاول مجدداً',
    errGoogleOnly: 'هذا الحساب مرتبط بـ Google. اضغط "الدخول بحساب Google" أدناه.',
    errGoogleNoAccount: 'لا يوجد حساب بهذا البريد. سجّل أولاً.',
    errGoogleFailed: 'فشل الدخول عبر Google. حاول مجدداً.',
    demoErrUnavailable: 'الديمو غير متاح — حاول لاحقاً',
    demoErrPin: 'خطأ في PIN — حاول مجدداً',
    demoErrNetwork: 'خطأ في الشبكة',
    hint: 'تلميح: استخدم رابط الدخول السريع (نسيت كلمة المرور) للدخول بدون كلمة مرور',
  },
}

const DEMO_CAFE = { subdomain: 'welcome', email: 'plage@demo.com', password: 'demo1234' }

const DEMO_ROLES = [
  { role: 'BOSS',       icon: Crown,   color: 'amber',   label: { en: 'Admin',       fr: 'Gérant',    ar: 'المدير'  }, sub: { en: 'Full dashboard', fr: 'Tableau de bord',  ar: 'لوحة التحكم' }, pin: null,   dest: '/admin/dashboard' },
  { role: 'CASHIER',    icon: Monitor, color: 'sky',     label: { en: 'Cashier/POS', fr: 'Caisse POS', ar: 'الكاشير' }, sub: { en: 'Point of sale',  fr: 'Terminal de vente', ar: 'نقطة البيع'  }, pin: '1234', dest: '/pos'            },
  { role: 'SUPERVISOR', icon: ChefHat, color: 'emerald', label: { en: 'Kitchen',     fr: 'Cuisine',    ar: 'المطبخ'  }, sub: { en: 'Live orders',    fr: 'Écran commandes',   ar: 'شاشة الطلبات'}, pin: '3333', dest: '/kitchen'        },
  { role: 'WAITER',     icon: Bell,    color: 'violet',  label: { en: 'Waiter',      fr: 'Serveur',    ar: 'النادل'  }, sub: { en: 'Table service',  fr: 'Service tables',    ar: 'خدمة الطاولات'}, pin: '2222', dest: '/waiter'         },
] as const

const ICON_BG: Record<string, string> = {
  amber: 'bg-amber-500', sky: 'bg-sky-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500',
}
const CARD_RING: Record<string, string> = {
  amber: 'ring-amber-500/20 hover:ring-amber-500/40', sky: 'ring-sky-500/20 hover:ring-sky-500/40',
  emerald: 'ring-emerald-500/20 hover:ring-emerald-500/40', violet: 'ring-violet-500/20 hover:ring-violet-500/40',
}

const LANGS: { code: Lang; flag: string }[] = [
  { code: 'fr', flag: '🇫🇷' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'ar', flag: '🇸🇦' },
]

// Google SVG icon (no external deps)
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const router        = useRouter()
  const searchParams  = useSearchParams()

  const [lang, setLang]         = useState<Lang>('fr')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [showHint, setShowHint] = useState(false)   // show magic-link hint after wrong password
  const [loading, setLoading]   = useState(false)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)
  const [demoError,   setDemoError]   = useState('')
  const [forgotMode,    setForgotMode]    = useState(false)
  const [forgotEmail,   setForgotEmail]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone,    setForgotDone]    = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isRtl = lang === 'ar'
  const t = (k: string) => T[lang][k] ?? k

  // Handle OAuth redirect back to /login?oauth_error=...
  // And OAuth success redirect to /admin/dashboard?oauth=...
  useEffect(() => {
    const oauthError = searchParams.get('oauth_error')
    if (oauthError === 'no_account') setError(T[lang].errGoogleNoAccount)
    else if (oauthError) setError(T[lang].errGoogleFailed)
  }, [searchParams, lang])

  function friendlyError(code: string): string {
    if (code === 'Invalid credentials') return t('errInvalid')
    if (code === 'google_account')      return t('errGoogleOnly')
    return code
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setShowHint(false); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) {
        const msg = friendlyError(data.error ?? 'Erreur')
        setError(msg)
        // Show magic-link hint on wrong password
        if (data.error === 'Invalid credentials' || data.error === 'google_account') setShowHint(true)
        return
      }
      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('cafeId', data.cafeId)
      localStorage.setItem('subdomain', data.subdomain ?? '')
      router.push('/admin/dashboard')
    } catch {
      setError(t('errNetwork'))
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleLogin() {
    setGoogleLoading(true)
    window.location.href = '/api/auth/google'
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    try {
      await fetch('/api/auth/magic-login-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail.trim() }) })
      setForgotDone(true)
    } catch {}
    finally { setForgotLoading(false) }
  }

  async function loginAsRole(r: typeof DEMO_ROLES[number]) {
    setDemoLoading(r.role); setDemoError('')
    try {
      if (r.role === 'BOSS') {
        const res  = await fetch('/api/demo-login', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { setDemoError(t('demoErrUnavailable')); setDemoLoading(null); return }
        localStorage.setItem('token', data.token)
        localStorage.setItem('cafeId', data.cafeId)
        localStorage.setItem('subdomain', data.subdomain ?? '')
        localStorage.setItem('isDemo', '1')   // flag for demo banner + onboarding assistant
        const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` }
        const staffRes = await fetch('/api/admin/staff', { headers: h })
        if (staffRes.ok) {
          const body = await staffRes.json()
          const list: { name: string }[] = Array.isArray(body) ? body : (body.staff ?? [])
          const names = list.map((s: any) => s.name)
          await Promise.all(
            [{ name: 'Demo Cashier', role: 'CASHIER', pinCode: '1234' }, { name: 'Demo Supervisor', role: 'SUPERVISOR', pinCode: '3333' }, { name: 'Demo Waiter', role: 'WAITER', pinCode: '2222' }]
              .filter(s => !names.includes(s.name))
              .map(s => fetch('/api/admin/staff', { method: 'POST', headers: h, body: JSON.stringify(s) }))
          )
        }
        router.push(r.dest)
      } else {
        const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subdomain: DEMO_CAFE.subdomain, pinCode: r.pin, action: 'login' }) })
        const data = await res.json()
        if (!res.ok) { setDemoError(t('demoErrPin')); setDemoLoading(null); return }
        localStorage.setItem('posToken', data.token)
        localStorage.setItem('cafeId', JSON.parse(atob(data.token.split('.')[1])).cafeId)
        localStorage.setItem('posLastSubdomain', DEMO_CAFE.subdomain)
        localStorage.setItem('staffName', data.staff.name)
        localStorage.setItem('kitchenToken', data.token)
        window.location.href = r.dest
      }
    } catch {
      setDemoError(t('demoErrNetwork'))
      setDemoLoading(null)
    }
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0a0f] lg:grid lg:grid-cols-2">

      {/* ════════════════ LEFT — Branding + Demo ════════════════ */}
      <div className="relative flex flex-col px-6 py-10 lg:px-12 overflow-hidden bg-[#0d0d14] border-b lg:border-b-0 lg:border-r border-white/5">

        {/* Background glow */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-950/30 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/4" />

        {/* Lang + top bar */}
        <div className="relative flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              <Image src="/assets/logo.png" alt="SmartRestau" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-none">Smart<span className="text-emerald-400">Restau</span></p>
              <p className="text-[10px] text-gray-600 mt-0.5">{t('copyright')}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`w-8 h-8 rounded-xl text-base transition-all ${lang === l.code ? 'bg-white/10' : 'opacity-40 hover:opacity-70'}`}>
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Tagline */}
        <div className="relative mb-8">
          <p className="text-2xl lg:text-3xl font-black text-white leading-tight max-w-xs">
            {t('tagline')}
          </p>
        </div>

        {/* Demo section */}
        <div className="relative flex-1">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{t('demoTitle')}</p>
          <p className="text-xs text-gray-600 mb-4">{t('demoSub')} · 🇲🇦 Café de la Plage</p>

          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_ROLES.map(r => {
              const Icon = r.icon
              const isLoading = demoLoading === r.role
              return (
                <button key={r.role} onClick={() => loginAsRole(r)} disabled={demoLoading !== null}
                  className={`group relative bg-white/4 hover:bg-white/7 ring-1 ${CARD_RING[r.color]} rounded-2xl p-4 text-left transition-all active:scale-[0.98] disabled:opacity-60`}>
                  <div className={`w-9 h-9 rounded-xl ${ICON_BG[r.color]} flex items-center justify-center mb-3 shadow-lg`}>
                    {isLoading
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Icon className="w-4 h-4 text-white" />}
                  </div>
                  <p className="font-bold text-white text-sm leading-snug">{r.label[lang]}</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">{r.sub[lang]}</p>
                </button>
              )
            })}
          </div>

          {demoError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {demoError}
            </div>
          )}
        </div>

        {/* Copyright footer */}
        <div className="relative mt-10 pt-6 border-t border-white/5">
          <p className="text-[11px] text-gray-700">
            © {new Date().getFullYear()} SmartRestau · 🇲🇦 MA · 🇸🇦 SA · 🇦🇪 AE · 🇸🇳 SN · 🇨🇮 CI · 🇰🇪 KE
          </p>
          <p className="text-[10px] text-gray-800 mt-1">All rights reserved · smartrestau.com</p>
        </div>
      </div>

      {/* ════════════════ RIGHT — Login form ════════════════ */}
      <div className="flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">

          {forgotMode ? (
            /* ── Forgot password / magic link ── */
            <div className="space-y-6">
              <div>
                <p className="text-xl font-black text-white">{t('forgotTitle')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('forgotSub')}</p>
              </div>

              {forgotDone ? (
                <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-800/50 rounded-2xl px-5 py-4">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-emerald-300 text-sm font-medium">{t('forgotDone')}</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-3">
                  <div className="relative">
                    <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600`} />
                    <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder={t('emailPh')} dir="ltr"
                      className={`w-full bg-white/5 border border-white/10 text-white rounded-2xl ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3.5 text-sm placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm">
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {forgotLoading ? t('forgotSending') : t('forgotSend')}
                  </button>
                </form>
              )}

              <button onClick={() => { setForgotMode(false); setForgotDone(false); setForgotEmail('') }}
                className="text-sm text-gray-600 hover:text-gray-300 transition-colors">
                {t('back')}
              </button>
            </div>

          ) : (
            /* ── Normal login ── */
            <div className="space-y-6">
              <div>
                <p className="text-2xl font-black text-white">{t('adminTitle')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('adminSub')}</p>
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-3 text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-2xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{error}</p>
                    {showHint && (
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setForgotEmail(email); setShowHint(false) }}
                        className="mt-1.5 text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors font-semibold"
                      >
                        {t('forgotPassword')} →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Google sign-in */}
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold py-3.5 rounded-2xl transition-all text-sm disabled:opacity-50"
              >
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                {t('googleBtn')}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-gray-700">{t('orWith')}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('email')}</label>
                  <div className="relative">
                    <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600`} />
                    <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setError(''); setShowHint(false) }}
                      placeholder={t('emailPh')} dir="ltr"
                      className={`w-full bg-white/5 border border-white/10 text-white rounded-2xl ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3.5 text-sm placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('password')}</label>
                    <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email) }}
                      className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-semibold">
                      {t('forgotPassword')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600`} />
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => { setPassword(e.target.value); setError(''); setShowHint(false) }}
                      placeholder={t('passwordPh')} dir="ltr"
                      className={`w-full bg-white/5 border border-white/10 text-white rounded-2xl ${isRtl ? 'pr-11 pl-11' : 'pl-11 pr-11'} py-3.5 text-sm placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors`}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{t('submitting')}</>
                    : <>{t('submit')}<ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-center text-sm text-gray-600">
                {t('noAccount')}{' '}
                <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                  {t('signup')}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
