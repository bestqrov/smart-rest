'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Crown, Monitor, ChefHat, Bell, Send, CheckCircle } from 'lucide-react'

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
  },
}

const DEMO_CAFE = { subdomain: 'plage', email: 'plage@demo.com', password: 'demo1234' }

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

export default function LoginPage() {
  const router = useRouter()
  const [lang, setLang]         = useState<Lang>('fr')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)
  const [demoError,   setDemoError]   = useState('')
  const [forgotMode,    setForgotMode]    = useState(false)
  const [forgotEmail,   setForgotEmail]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone,    setForgotDone]    = useState(false)

  const isRtl = lang === 'ar'
  const t = (k: string) => T[lang][k] ?? k

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      localStorage.setItem('token', data.token)
      localStorage.setItem('cafeId', data.cafeId)
      localStorage.setItem('subdomain', data.subdomain ?? '')
      router.push('/admin/dashboard')
    } catch { setError(lang === 'ar' ? 'خطأ في الشبكة' : lang === 'fr' ? 'Erreur réseau' : 'Network error') }
    finally { setLoading(false) }
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!forgotEmail.trim()) return
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
        const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: DEMO_CAFE.email, password: DEMO_CAFE.password }) })
        const data = await res.json()
        if (!res.ok) { setDemoError(data.error ?? 'Erreur'); setDemoLoading(null); return }
        localStorage.setItem('token', data.token); localStorage.setItem('cafeId', data.cafeId); localStorage.setItem('subdomain', data.subdomain ?? '')
        const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` }
        const staffRes = await fetch('/api/admin/staff', { headers: h })
        if (staffRes.ok) {
          const list: { name: string }[] = await staffRes.json()
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
        if (!res.ok) { setDemoError(data.error ?? 'Erreur PIN'); setDemoLoading(null); return }
        localStorage.setItem('posToken', data.token)
        localStorage.setItem('cafeId', JSON.parse(atob(data.token.split('.')[1])).cafeId)
        localStorage.setItem('posLastSubdomain', DEMO_CAFE.subdomain)
        localStorage.setItem('staffName', data.staff.name)
        localStorage.setItem('kitchenToken', data.token)
        window.location.href = r.dest
      }
    } catch { setDemoError(lang === 'ar' ? 'خطأ في الشبكة' : 'Erreur réseau'); setDemoLoading(null) }
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
            <p className="mt-3 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2.5">
              ⚠ {demoError}
            </p>
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
            /* ── Forgot password ── */
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
            <div className="space-y-7">
              <div>
                <p className="text-2xl font-black text-white">{t('adminTitle')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('adminSub')}</p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-2xl px-4 py-3">
                  ⚠ {error}
                </p>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('email')}</label>
                  <div className="relative">
                    <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600`} />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
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
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
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
