'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const T = {
  ar: {
    title: 'تسجيل دخول النادل',
    subtitle: 'أدخل الرمز السري المكوّن من 4 أرقام',
    demoTitle: 'اختر حسابك',
    demoSubtitle: 'وضع التجريبي — بدون رمز سري',
    invalidToken: 'رمز QR غير صالح أو منتهي الصلاحية',
    invalidPin: 'الرمز السري غير صحيح، حاول مجدداً',
    error: 'خطأ في تسجيل الدخول',
    noToken: 'لا يوجد رمز QR — اطلب من المدير مسح الرمز',
    delete: 'مسح',
  },
  en: {
    title: 'Waiter Login',
    subtitle: 'Enter your 4-digit PIN',
    demoTitle: 'Choose your account',
    demoSubtitle: 'Demo mode — no PIN required',
    invalidToken: 'QR code is invalid or expired',
    invalidPin: 'Wrong PIN, please try again',
    error: 'Login failed',
    noToken: 'No QR token — ask manager to scan the code',
    delete: 'Del',
  },
  fr: {
    title: 'Connexion Serveur',
    subtitle: 'Entrez votre code PIN à 4 chiffres',
    demoTitle: 'Choisissez votre compte',
    demoSubtitle: 'Mode démo — sans code PIN',
    invalidToken: 'QR code invalide ou expiré',
    invalidPin: 'PIN incorrect, réessayez',
    error: 'Échec de connexion',
    noToken: 'Pas de token QR — demandez au manager',
    delete: 'Sup',
  },
  es: {
    title: 'Inicio de sesión',
    subtitle: 'Ingrese su PIN de 4 dígitos',
    demoTitle: 'Elige tu cuenta',
    demoSubtitle: 'Modo demo — sin PIN',
    invalidToken: 'Código QR inválido o caducado',
    invalidPin: 'PIN incorrecto, inténtelo de nuevo',
    error: 'Error de inicio de sesión',
    noToken: 'Sin token QR — pida al manager',
    delete: 'Bor',
  },
}

type Lang = keyof typeof T
interface DemoStaff { id: string; name: string; role: string }

const ROLE_EMOJI: Record<string, string> = {
  WAITER: '🛎️', SUPERVISOR: '👨‍🍳', CASHIER: '💳', BOSS: '👑',
  COOK: '🍳', HEAD_CHEF: '👨‍🍳', BARISTA: '☕', BARTENDER: '🍹',
}

function roleEmoji(role: string) { return ROLE_EMOJI[role] ?? '👤' }

export default function WaiterLoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const qrToken = params.get('token')

  const [lang, setLang] = useState<Lang>('ar')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [demoStaff, setDemoStaff] = useState<DemoStaff[]>([])
  const [demoLoading, setDemoLoading] = useState(false)

  const t = T[lang]
  const isRTL = lang === 'ar'

  // Detect browser language + check demo mode
  useEffect(() => {
    const nav = navigator.language?.slice(0, 2)
    if (nav === 'fr') setLang('fr')
    else if (nav === 'es') setLang('es')
    else if (nav === 'ar') setLang('ar')
    else setLang('en')

    if (qrToken) {
      fetch(`/api/public/qr-token-info?token=${encodeURIComponent(qrToken)}`)
        .then(r => r.json())
        .then(d => {
          if (d.isDemo && d.staff?.length) {
            setIsDemo(true)
            setDemoStaff(d.staff)
          }
        })
        .catch(() => {})
    }
  }, [qrToken])

  async function handleDemoLogin(staffId: string) {
    if (!qrToken || demoLoading) return
    setDemoLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waiters/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: qrToken, demoStaffId: staffId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t.error); return }
      localStorage.setItem('waiterToken', data.token)
      localStorage.setItem('waiterStaff', JSON.stringify(data.staff))
      localStorage.setItem('waiterCafeId', data.cafeId)
      router.replace('/w/dashboard')
    } catch {
      setError(t.error)
    } finally {
      setDemoLoading(false)
    }
  }

  function pressDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) submitPin(next)
  }

  function pressDelete() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  async function submitPin(code: string) {
    if (!qrToken) { setError(t.noToken); return }
    setLoading(true)
    try {
      const res = await fetch('/api/waiters/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: qrToken, pinCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t.error); setPin(''); return }
      localStorage.setItem('waiterToken', data.token)
      localStorage.setItem('waiterStaff', JSON.stringify(data.staff))
      localStorage.setItem('waiterCafeId', data.cafeId)
      router.replace('/w/dashboard')
    } catch {
      setError(t.error)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del']

  // ── Demo mode: staff tap cards ─────────────────────────────────────────────
  if (isDemo) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4"
      >
        {/* Lang switcher */}
        <div className="absolute top-4 right-4 flex gap-2">
          {(Object.keys(T) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >{l.toUpperCase()}</button>
          ))}
        </div>

        <div className="mb-8 text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">{t.demoTitle}</h1>
          <p className="text-amber-400 text-sm mt-1 font-medium">{t.demoSubtitle}</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-900/60 border border-red-500 rounded-xl text-red-300 text-sm text-center max-w-xs">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          {demoStaff.map(s => (
            <button
              key={s.id}
              onClick={() => handleDemoLogin(s.id)}
              disabled={demoLoading}
              className="w-full flex items-center gap-4 px-5 py-4 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 hover:border-amber-500 rounded-2xl transition-all text-left"
            >
              <span className="text-3xl">{roleEmoji(s.role)}</span>
              <div>
                <div className="text-white font-semibold">{s.name}</div>
                <div className="text-slate-400 text-sm">{s.role}</div>
              </div>
              {demoLoading && <div className="ml-auto w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Normal PIN mode ────────────────────────────────────────────────────────
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4"
    >
      {/* Lang switcher */}
      <div className="absolute top-4 right-4 flex gap-2">
        {(Object.keys(T) as Lang[]).map(l => (
          <button key={l} onClick={() => setLang(l)}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >{l.toUpperCase()}</button>
        ))}
      </div>

      {/* Logo / Title */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🍽️</div>
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
            pin.length > i ? 'bg-amber-400 border-amber-400 scale-110' : 'bg-transparent border-slate-500'
          }`} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/60 border border-red-500 rounded-xl text-red-300 text-sm text-center max-w-xs">
          {error}
        </div>
      )}

      {/* No token warning */}
      {!qrToken && (
        <div className="mb-4 px-4 py-2 bg-yellow-900/60 border border-yellow-500 rounded-xl text-yellow-300 text-sm text-center max-w-xs">
          {t.noToken}
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') return (
            <button key={i} onPointerDown={pressDelete} disabled={loading}
              className="h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all text-white font-semibold text-sm flex items-center justify-center"
            >{t.delete}</button>
          )
          return (
            <button key={i} onPointerDown={() => pressDigit(d)} disabled={loading || pin.length >= 4}
              className="h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all text-white font-bold text-2xl flex items-center justify-center"
            >{d}</button>
          )
        })}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          …
        </div>
      )}
    </div>
  )
}
