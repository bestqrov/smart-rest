'use client'

/**
 * /verify-success
 *
 * Landing page after magic-link verification.
 * Receives ?token=&cafeId=&subdomain=&lang= from the server redirect.
 * Persists the session, then auto-redirects to /admin/dashboard.
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

type Lang = 'ar' | 'fr' | 'en' | 'es'

const T = {
  loading:      { ar: 'جارٍ التحقق من الرابط…',          fr: 'Vérification du lien…',                  en: 'Verifying your link…',            es: 'Verificando tu enlace…'       },
  success:      { ar: 'تم تفعيل حسابك 🎉',                fr: 'Compte activé avec succès 🎉',            en: 'Account activated! 🎉',            es: '¡Cuenta activada! 🎉'          },
  redirect:     { ar: 'جارٍ توجيهك للوحة التحكم…',       fr: 'Redirection vers le tableau de bord…',    en: 'Redirecting to your dashboard…',   es: 'Redirigiendo al panel…'        },
  trial:        { ar: 'بدأ أسبوعك التجريبي المجاني الآن — استمتع بجميع الميزات 7 أيام', fr: 'Votre semaine d\'essai commence maintenant — 7 jours gratuits', en: 'Your 7-day free trial has started — enjoy all features', es: 'Tu prueba de 7 días ha comenzado — disfruta todas las funciones' },
  error_title:  { ar: 'رابط غير صالح',                   fr: 'Lien invalide',                           en: 'Invalid link',                     es: 'Enlace inválido'               },
  error_body:   { ar: 'الرابط منتهي الصلاحية أو مستخدم. يرجى التسجيل مجدداً.', fr: 'Le lien a expiré ou a déjà été utilisé. Veuillez vous réinscrire.', en: 'The link has expired or was already used. Please sign up again.', es: 'El enlace expiró o ya fue usado. Regístrate de nuevo.' },
  btn_signup:   { ar: 'التسجيل مجدداً', fr: 'S\'inscrire à nouveau', en: 'Sign up again', es: 'Registrarse de nuevo' },
}

function tx(key: keyof typeof T, lang: Lang): string {
  return T[key][lang] ?? T[key].en
}

function VerifySuccessInner() {
  const params = useSearchParams()
  const router = useRouter()
  const lang: Lang = (() => {
    const l = params.get('lang')
    return (l === 'ar' || l === 'fr' || l === 'en' || l === 'es') ? l : 'ar'
  })()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token     = params.get('token')
    const cafeId    = params.get('cafeId')
    const subdomain = params.get('subdomain')

    if (!token || !cafeId) { setState('error'); return }

    // Persist session
    localStorage.setItem('token',     token)
    localStorage.setItem('cafeId',    cafeId)
    localStorage.setItem('subdomain', subdomain ?? '')

    setState('success')

    // Auto-redirect after 2.5 seconds
    const timer = setTimeout(() => router.push('/admin/dashboard'), 2500)
    return () => clearTimeout(timer)
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-emerald-950 via-emerald-900 to-gray-900" dir={dir}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-center">

        <div className={`px-8 py-8 ${state === 'error' ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}>
          <Image src="/assets/logo.png" alt="Smart Resto" width={48} height={48} className="rounded-xl mx-auto mb-3" />
          <h1 className="text-xl font-extrabold text-white">
            {state === 'loading' ? tx('loading', lang)
             : state === 'success' ? tx('success', lang)
             : tx('error_title', lang)}
          </h1>
        </div>

        <div className="px-8 py-8 space-y-4">
          {state === 'loading' && (
            <div className="flex justify-center">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {state === 'success' && (
            <>
              <div className="text-5xl">🎉</div>
              <p className="text-gray-700 text-sm leading-relaxed">{tx('trial', lang)}</p>
              <p className="text-gray-400 text-xs">{tx('redirect', lang)}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-400 animate-[progress_2.5s_linear_forwards]" style={{ width: '0%', animation: 'progress 2.5s linear forwards' }} />
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="text-gray-600 text-sm">{tx('error_body', lang)}</p>
              <a
                href={`/signup?lang=${lang}`}
                className="inline-block bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold px-6 py-3 rounded-xl transition-all hover:from-amber-500 hover:to-amber-600"
              >
                {tx('btn_signup', lang)}
              </a>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}

export default function VerifySuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-emerald-950">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifySuccessInner />
    </Suspense>
  )
}
