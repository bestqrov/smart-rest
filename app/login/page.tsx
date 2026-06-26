'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Crown, Monitor, ChefHat, Bell, ChevronDown, Send, CheckCircle } from 'lucide-react'

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'The AI Operating System for Restaurants',
    demoTitle: 'Try a live demo',
    demoSub: 'One click · No signup needed',
    adminTitle: 'Sign in to your account',
    email: 'Email address', emailPh: 'you@restaurant.com',
    password: 'Password', passwordPh: '••••••••',
    submit: 'Sign in', submitting: 'Signing in…',
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset your password',
    forgotSub: "Enter your email and we'll send you a sign-in link.",
    forgotSend: 'Send link', forgotSending: 'Sending…',
    forgotDone: 'Check your inbox — link sent!',
    noAccount: "Don't have an account?", signup: 'Sign up free',
    orLogin: 'Or sign in',
    back: '← Back',
  },
  fr: {
    tagline: 'Le système d\'exploitation IA pour restaurants',
    demoTitle: 'Essayer la démo en direct',
    demoSub: 'Un clic · Sans inscription',
    adminTitle: 'Connexion à votre compte',
    email: 'Adresse email', emailPh: 'vous@restaurant.com',
    password: 'Mot de passe', passwordPh: '••••••••',
    submit: 'Se connecter', submitting: 'Connexion…',
    forgotPassword: 'Mot de passe oublié ?',
    forgotTitle: 'Réinitialiser le mot de passe',
    forgotSub: 'Entrez votre email et nous vous enverrons un lien de connexion.',
    forgotSend: 'Envoyer le lien', forgotSending: 'Envoi…',
    forgotDone: 'Vérifiez votre boîte mail — lien envoyé !',
    noAccount: 'Pas encore de compte ?', signup: 'Inscription gratuite',
    orLogin: 'Ou se connecter',
    back: '← Retour',
  },
  ar: {
    tagline: 'نظام الذكاء الاصطناعي لإدارة المطاعم',
    demoTitle: 'جرّب الديمو مباشرة',
    demoSub: 'نقرة واحدة · بدون تسجيل',
    adminTitle: 'تسجيل الدخول إلى حسابك',
    email: 'البريد الإلكتروني', emailPh: 'you@restaurant.com',
    password: 'كلمة المرور', passwordPh: '••••••••',
    submit: 'دخول', submitting: 'جاري الدخول…',
    forgotPassword: 'نسيت كلمة المرور؟',
    forgotTitle: 'استعادة كلمة المرور',
    forgotSub: 'أدخل بريدك الإلكتروني وسنرسل لك رابط دخول فوري.',
    forgotSend: 'إرسال الرابط', forgotSending: 'جاري الإرسال…',
    forgotDone: '✅ تم الإرسال — تحقق من بريدك',
    noAccount: 'ليس لديك حساب؟', signup: 'ابدأ مجاناً',
    orLogin: 'أو سجّل الدخول',
    back: 'رجوع ←',
  },
}

const DEMO_CAFE = {
  subdomain: 'plage',
  email:     'plage@demo.com',
  password:  'demo1234',
}

const DEMO_ROLES = [
  {
    role: 'BOSS',
    icon: Crown,
    color: 'amber',
    label: { en: 'Admin', fr: 'Gérant', ar: 'المدير' },
    sub:   { en: 'Full dashboard access', fr: 'Accès tableau de bord', ar: 'لوحة التحكم الكاملة' },
    pin: null,
    dest: '/admin/dashboard',
  },
  {
    role: 'CASHIER',
    icon: Monitor,
    color: 'sky',
    label: { en: 'Cashier / POS', fr: 'Caisse POS', ar: 'الكاشير' },
    sub:   { en: 'Point of sale terminal', fr: 'Terminal de vente', ar: 'نقطة البيع' },
    pin: '1234',
    dest: '/pos',
  },
  {
    role: 'SUPERVISOR',
    icon: ChefHat,
    color: 'emerald',
    label: { en: 'Kitchen', fr: 'Cuisine', ar: 'المطبخ' },
    sub:   { en: 'Live orders screen', fr: 'Écran commandes', ar: 'شاشة الطلبات' },
    pin: '3333',
    dest: '/kitchen',
  },
  {
    role: 'WAITER',
    icon: Bell,
    color: 'violet',
    label: { en: 'Waiter', fr: 'Serveur', ar: 'النادل' },
    sub:   { en: 'Table service app', fr: 'App service tables', ar: 'تطبيق الخدمة' },
    pin: '2222',
    dest: '/waiter',
  },
] as const

const COLOR_MAP: Record<string, { ring: string; bg: string; icon: string; badge: string }> = {
  amber:   { ring: 'ring-amber-500/30',   bg: 'bg-amber-500/8 hover:bg-amber-500/15',   icon: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300' },
  sky:     { ring: 'ring-sky-500/30',     bg: 'bg-sky-500/8 hover:bg-sky-500/15',       icon: 'bg-sky-500',     badge: 'bg-sky-500/20 text-sky-300' },
  emerald: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/8 hover:bg-emerald-500/15', icon: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300' },
  violet:  { ring: 'ring-violet-500/30',  bg: 'bg-violet-500/8 hover:bg-violet-500/15',  icon: 'bg-violet-500',  badge: 'bg-violet-500/20 text-violet-300' },
}

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ar', label: 'AR', flag: '🇸🇦' },
]

export default function LoginPage() {
  const router = useRouter()
  const [lang, setLang]         = useState<Lang>('fr')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [demoLoading, setDemoLoading]     = useState<string | null>(null)
  const [demoError, setDemoError]         = useState('')
  // Forgot password flow
  const [forgotMode, setForgotMode]   = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone, setForgotDone]   = useState(false)

  const isRtl = lang === 'ar'
  const t = (k: string) => T[lang][k] ?? k

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)
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
    } finally { setLoading(false) }
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    try {
      await fetch('/api/auth/magic-login-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      setForgotDone(true)
    } catch {}
    finally { setForgotLoading(false) }
  }

  async function loginAsRole(r: typeof DEMO_ROLES[number]) {
    setDemoLoading(r.role); setDemoError('')
    try {
      if (r.role === 'BOSS') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: DEMO_CAFE.email, password: DEMO_CAFE.password }),
        })
        const data = await res.json()
        if (!res.ok) { setDemoError(data.error ?? 'Erreur'); setDemoLoading(null); return }
        localStorage.setItem('token',     data.token)
        localStorage.setItem('cafeId',    data.cafeId)
        localStorage.setItem('subdomain', data.subdomain ?? '')
        const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` }
        const staffRes = await fetch('/api/admin/staff', { headers: h })
        if (staffRes.ok) {
          const list: { name: string }[] = await staffRes.json()
          const names = list.map((s: any) => s.name)
          const toCreate = [
            { name: 'Demo Cashier',    role: 'CASHIER',    pinCode: '1234' },
            { name: 'Demo Supervisor', role: 'SUPERVISOR', pinCode: '3333' },
            { name: 'Demo Waiter',     role: 'WAITER',     pinCode: '2222' },
          ].filter(s => !names.includes(s.name))
          await Promise.all(toCreate.map(s => fetch('/api/admin/staff', { method: 'POST', headers: h, body: JSON.stringify(s) })))
        }
        router.push(r.dest)
      } else {
        const res = await fetch('/api/pos/shift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: DEMO_CAFE.subdomain, pinCode: r.pin, action: 'login' }),
        })
        const data = await res.json()
        if (!res.ok) { setDemoError(data.error ?? 'Erreur PIN'); setDemoLoading(null); return }
        localStorage.setItem('posToken',         data.token)
        localStorage.setItem('cafeId',           JSON.parse(atob(data.token.split('.')[1])).cafeId)
        localStorage.setItem('posLastSubdomain', DEMO_CAFE.subdomain)
        localStorage.setItem('staffName',        data.staff.name)
        localStorage.setItem('kitchenToken',     data.token)
        window.location.href = r.dest
      }
    } catch {
      setDemoError(lang === 'ar' ? 'خطأ في الشبكة' : 'Erreur réseau')
      setDemoLoading(null)
    }
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-950/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-950/20 rounded-full blur-[100px]" />
      </div>

      {/* Lang switcher */}
      <div className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} flex items-center gap-1`}>
        {LANGS.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === l.code
                ? 'bg-gray-800 text-white ring-1 ring-gray-700'
                : 'text-gray-600 hover:text-gray-400'
            }`}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-[420px] space-y-3">

        {/* ── Logo ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-4 shadow-2xl">
            <Image src="/assets/logo.png" alt="SmartRestau" width={40} height={40} priority className="object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Smart<span className="text-emerald-400">Restau</span>
          </h1>
          <p className="text-gray-500 text-xs mt-1.5 max-w-[280px] mx-auto leading-relaxed">{t('tagline')}</p>
        </div>

        {/* ── Demo section ── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white font-bold text-sm">{t('demoTitle')}</p>
              <p className="text-gray-500 text-xs mt-0.5">{t('demoSub')}</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              🇲🇦 Café de la Plage
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ROLES.map(r => {
              const Icon = r.icon
              const c = COLOR_MAP[r.color]
              const isLoading = demoLoading === r.role
              return (
                <button key={r.role} onClick={() => loginAsRole(r)} disabled={demoLoading !== null}
                  className={`group relative rounded-xl p-4 text-left transition-all active:scale-95 disabled:opacity-60 ring-1 ${c.ring} ${c.bg}`}>
                  <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center mb-3 shadow-lg`}>
                    {isLoading
                      ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      : <Icon className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <p className="text-white font-bold text-xs leading-snug">{r.label[lang]}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{r.sub[lang]}</p>
                </button>
              )
            })}
          </div>

          {demoError && (
            <p className="mt-3 text-red-400 text-xs bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2.5">
              ⚠ {demoError}
            </p>
          )}
        </div>

        {/* ── Admin login (collapsible) ── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur overflow-hidden">
          <button onClick={() => { setShowLoginForm(v => !v); setForgotMode(false); setForgotDone(false) }}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm transition-colors hover:bg-gray-800/40">
            <span className="text-gray-400 font-semibold text-sm">{t('adminTitle')}</span>
            <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${showLoginForm ? 'rotate-180' : ''}`} />
          </button>

          {showLoginForm && (
            <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">

              {/* ── Forgot password mode ── */}
              {forgotMode ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-white font-bold text-sm mb-0.5">{t('forgotTitle')}</p>
                    <p className="text-gray-500 text-xs">{t('forgotSub')}</p>
                  </div>

                  {forgotDone ? (
                    <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-800/50 rounded-xl px-4 py-3.5">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <p className="text-emerald-300 text-sm font-medium">{t('forgotDone')}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleForgot} className="space-y-3">
                      <div className="relative">
                        <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                        <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                          placeholder={t('emailPh')} dir="ltr"
                          className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                      </div>
                      <button type="submit" disabled={forgotLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                        {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {forgotLoading ? t('forgotSending') : t('forgotSend')}
                      </button>
                    </form>
                  )}

                  <button type="button" onClick={() => { setForgotMode(false); setForgotDone(false); setForgotEmail('') }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    {t('back')}
                  </button>
                </div>
              ) : (
                /* ── Normal login mode ── */
                <div className="space-y-4">
                  {error && (
                    <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2.5">
                      ⚠ {error}
                    </p>
                  )}

                  <form onSubmit={handleLogin} className="space-y-3">
                    {/* Email */}
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-1.5">{t('email')}</label>
                      <div className="relative">
                        <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                          placeholder={t('emailPh')} dir="ltr"
                          className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-gray-400 font-semibold">{t('password')}</label>
                        <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email) }}
                          className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium">
                          {t('forgotPassword')}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                        <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                          placeholder={t('passwordPh')} dir="ltr"
                          className={`w-full bg-gray-800 border border-gray-700 text-white rounded-xl ${isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`} />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors`}>
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/30">
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{t('submitting')}</>
                        : <>{t('submit')}<ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>

                  <p className="text-center text-xs text-gray-600">
                    {t('noAccount')}{' '}
                    <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                      {t('signup')}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-700 pb-2">
          © {new Date().getFullYear()} SmartRestau · 🇲🇦 MA · 🇸🇦 SA · 🇦🇪 AE · 🇸🇳 SN · 🇨🇮 CI · 🇰🇪 KE
        </p>
      </div>
    </div>
  )
}
