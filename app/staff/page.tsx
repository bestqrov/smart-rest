'use client'

import { useEffect, useRef, useState } from 'react'
import { ChefHat, Monitor, Bell, Crown, Delete, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'BOSS' | 'CASHIER' | 'SUPERVISOR' | 'WAITER'
type Step = 'role' | 'pin'
type Lang = 'ar' | 'fr' | 'en'

interface CafeInfo {
  name:       string
  logoUrl:    string | null
  accentColor: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    welcome: 'مرحباً بك',
    chooseRole: 'اختر دورك',
    enterPin: 'أدخل رمز PIN',
    boss:       'المدير',
    bossSub:    'لوحة تحكم كاملة',
    cashier:    'الكاشير',
    cashierSub: 'نقطة البيع',
    cuisine:    'المطبخ',
    cuisineSub: 'شاشة الطلبات',
    waiter:     'النادل',
    waiterSub:  'خدمة الطاولات',
    wrongRole:  'رمز PIN غير صحيح أو الدور غير مطابق',
    errorNet:   'خطأ في الشبكة',
    back:       'رجوع',
    cafeSub:    'أدخل الاسم المختصر للمقهى',
    cafeLabel:  'المقهى',
  },
  fr: {
    welcome: 'Bienvenue',
    chooseRole: 'Choisissez votre rôle',
    enterPin: 'Entrez votre PIN',
    boss:       'Gérant',
    bossSub:    'Tableau de bord complet',
    cashier:    'Caissier',
    cashierSub: 'Point de vente',
    cuisine:    'Cuisine',
    cuisineSub: 'Écran des commandes',
    waiter:     'Serveur',
    waiterSub:  'Service des tables',
    wrongRole:  'PIN incorrect ou rôle non autorisé',
    errorNet:   'Erreur réseau',
    back:       'Retour',
    cafeSub:    'Entrez le sous-domaine du café',
    cafeLabel:  'Café',
  },
  en: {
    welcome: 'Welcome',
    chooseRole: 'Choose your role',
    enterPin: 'Enter your PIN',
    boss:       'Manager',
    bossSub:    'Full dashboard',
    cashier:    'Cashier',
    cashierSub: 'Point of sale',
    cuisine:    'Kitchen',
    cuisineSub: 'Order display',
    waiter:     'Waiter',
    waiterSub:  'Table service',
    wrongRole:  'Wrong PIN or role not allowed',
    errorNet:   'Network error',
    back:       'Back',
    cafeSub:    'Enter cafe subdomain',
    cafeLabel:  'Cafe',
  },
} as const

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLES: { role: Role; icon: React.ElementType; color: string; gradient: string; requiredStaffRole?: string }[] = [
  { role: 'BOSS',       icon: Crown,    color: 'text-amber-400',   gradient: 'from-amber-500 to-orange-600',  requiredStaffRole: undefined },
  { role: 'CASHIER',    icon: Monitor,  color: 'text-sky-400',     gradient: 'from-sky-500 to-blue-600',      requiredStaffRole: 'CASHIER' },
  { role: 'SUPERVISOR', icon: ChefHat,  color: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-600',  requiredStaffRole: 'SUPERVISOR' },
  { role: 'WAITER',     icon: Bell,     color: 'text-violet-400',  gradient: 'from-violet-500 to-purple-600', requiredStaffRole: 'WAITER' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPortal() {
  const [lang,      setLang]      = useState<Lang>('fr')
  const [step,      setStep]      = useState<Step>('role')
  const [role,      setRole]      = useState<Role | null>(null)
  const [pin,       setPin]       = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [cafe,      setCafe]      = useState<CafeInfo | null>(null)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  const t = T[lang]
  const MAX_PIN = 8

  // ── Load saved subdomain + cafe info ────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('posLastSubdomain') ?? ''
    if (saved) { setSubdomain(saved); fetchCafe(saved) }
    const l = localStorage.getItem('sm_lang')
    if (l === 'ar' || l === 'fr' || l === 'en') setLang(l as Lang)
  }, [])

  async function fetchCafe(sub: string) {
    try {
      const r = await fetch(`/api/public/cafe/${sub.trim().toLowerCase()}`)
      if (r.ok) {
        const d = await r.json()
        setCafe({ name: d.businessName || d.name || sub, logoUrl: d.logoUrl ?? null, accentColor: d.accentColor ?? '#059669' })
      }
    } catch {}
  }

  // ── Role card click ─────────────────────────────────────────────────────────
  function selectRole(r: Role) {
    if (r === 'BOSS') { window.location.href = '/login'; return }
    setRole(r); setStep('pin'); setPin(''); setError('')
  }

  // ── PIN keypad ──────────────────────────────────────────────────────────────
  function pressDigit(d: string) {
    if (pin.length >= MAX_PIN) return
    setPin(p => p + d)
  }
  function pressDelete() { setPin(p => p.slice(0, -1)) }

  // Auto-submit when PIN reaches likely length and user stopped typing
  const submitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (pin.length < 4) return
    if (submitTimeout.current) clearTimeout(submitTimeout.current)
    submitTimeout.current = setTimeout(() => { if (pin.length >= 4) handleLogin() }, 600)
    return () => { if (submitTimeout.current) clearTimeout(submitTimeout.current) }
  }, [pin])

  // ── Login ───────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!role || pin.length < 4 || loading) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim().toLowerCase(), pinCode: pin, action: 'login' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t.wrongRole); setPin(''); setLoading(false); return }

      const { token, staff } = data as { token: string; staff: { id: string; name: string; role: string } }
      const cfg = ROLES.find(c => c.role === role)!

      // Verify the PIN belongs to a staff member with the expected role
      if (cfg.requiredStaffRole && staff.role !== cfg.requiredStaffRole) {
        setError(t.wrongRole); setPin(''); setLoading(false); return
      }

      // Persist token + metadata
      localStorage.setItem('posToken',          token)
      localStorage.setItem('cafeId',            JSON.parse(atob(token.split('.')[1])).cafeId)
      localStorage.setItem('posLastSubdomain',  subdomain.trim().toLowerCase())
      localStorage.setItem('staffName',         staff.name)
      localStorage.setItem('kitchenToken',      token)

      // Redirect to the right dashboard
      const dest = role === 'CASHIER' ? '/pos' : role === 'SUPERVISOR' ? '/kitchen' : '/waiter'
      window.location.href = dest
    } catch {
      setError(t.errorNet); setPin(''); setLoading(false)
    }
  }

  const accentHex = cafe?.accentColor ?? '#059669'
  const isRTL = lang === 'ar'

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: accentHex }} />
      </div>

      {/* Lang switcher */}
      <div className={`absolute top-5 ${isRTL ? 'left-5' : 'right-5'} flex gap-0.5 bg-white/5 rounded-lg p-0.5`}>
        {(['fr','ar','en'] as Lang[]).map(l => (
          <button key={l} onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${lang === l ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/60'}`}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-sm space-y-6">

        {/* ── Cafe header ── */}
        <div className="text-center">
          {cafe?.logoUrl
            ? <img src={cafe.logoUrl} alt={cafe.name} className="w-16 h-16 rounded-2xl object-contain mx-auto mb-3 bg-white/10 p-1" />
            : <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl"
                style={{ backgroundColor: `${accentHex}22`, border: `1px solid ${accentHex}44` }}>
                🏪
              </div>
          }
          <h1 className="text-xl font-extrabold text-white">{cafe?.name ?? (subdomain || 'SmartMenu')}</h1>
          <p className="text-white/40 text-sm mt-0.5">{t.welcome}</p>
        </div>

        {/* ── Subdomain input (if not known) ── */}
        {!cafe && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-xs text-white/50 font-semibold mb-1.5">{t.cafeLabel}</label>
            <input
              type="text"
              value={subdomain}
              onChange={e => setSubdomain(e.target.value)}
              onBlur={() => subdomain && fetchCafe(subdomain)}
              placeholder={t.cafeSub}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': accentHex } as any}
            />
          </div>
        )}

        {/* ── STEP 1: Role picker ── */}
        {step === 'role' && (
          <div className="space-y-3">
            <p className="text-white/50 text-xs font-semibold text-center uppercase tracking-widest">{t.chooseRole}</p>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(({ role: r, icon: Icon, gradient, color }) => (
                <button
                  key={r}
                  onClick={() => selectRole(r)}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{t[r === 'BOSS' ? 'boss' : r === 'CASHIER' ? 'cashier' : r === 'SUPERVISOR' ? 'cuisine' : 'waiter']}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{t[r === 'BOSS' ? 'bossSub' : r === 'CASHIER' ? 'cashierSub' : r === 'SUPERVISOR' ? 'cuisineSub' : 'waiterSub']}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: PIN entry ── */}
        {step === 'pin' && role && (() => {
          const cfg = ROLES.find(c => c.role === role)!
          const Icon = cfg.icon
          return (
            <div className="space-y-5">
              {/* Back */}
              <button onClick={() => { setStep('role'); setPin(''); setError('') }}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" /> {t.back}
              </button>

              {/* Role badge */}
              <div className="flex items-center justify-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-white font-bold text-lg">
                  {t[role === 'CASHIER' ? 'cashier' : role === 'SUPERVISOR' ? 'cuisine' : 'waiter']}
                </p>
              </div>

              {/* PIN dots */}
              <div>
                <p className="text-white/40 text-xs text-center mb-3 font-semibold uppercase tracking-widest">{t.enterPin}</p>
                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: Math.max(pin.length + 1, 4) }, (_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${
                      i < pin.length
                        ? 'scale-110 shadow-lg'
                        : 'bg-white/15'
                    }`}
                      style={i < pin.length ? { backgroundColor: accentHex } : {}}
                    />
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => {
                  if (k === '') return <div key={i} />
                  if (k === '⌫') return (
                    <button key={i} onClick={pressDelete}
                      className="h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-white/50">
                      <Delete className="w-5 h-5" />
                    </button>
                  )
                  return (
                    <button key={i} onClick={() => pressDigit(k)} disabled={loading}
                      className="h-14 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white text-xl font-bold disabled:opacity-50">
                      {k}
                    </button>
                  )
                })}
              </div>

              {/* Submit */}
              {loading && (
                <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          )
        })()}

      </div>

      {/* Footer */}
      <p className="absolute bottom-4 text-white/15 text-xs">Powered by SmartMenu</p>
    </div>
  )
}
