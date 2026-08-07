'use client'

/**
 * /verify-success — Welcome (Step 2)
 *
 * Landing page after magic-link verification. Receives ?token=&cafeId=&
 * subdomain=&lang= from the server redirect, persists the session, then
 * shows a short Welcome screen with a single "Continue" action into the
 * 3-step onboarding wizard — no auto-redirect, no dashboard detour.
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

type Lang = 'ar' | 'fr' | 'en' | 'es'

const T = {
  loading:      { ar: 'جارٍ التحقق من الرابط…',          fr: 'Vérification du lien…',                  en: 'Verifying your link…',            es: 'Verificando tu enlace…'       },
  welcome:      { ar: 'مرحباً بك في Smart Resto 🎉',      fr: 'Bienvenue sur Smart Resto 🎉',            en: 'Welcome to Smart Resto 🎉',        es: '¡Bienvenido a Smart Resto! 🎉'  },
  ready:        { ar: 'مطعمك جاهز.',                     fr: 'Votre restaurant est prêt.',              en: 'Your restaurant is ready.',        es: 'Tu restaurante está listo.'    },
  personalize:  { ar: 'خلينا نخصصو مساحة العمل ديالك.',   fr: 'Personnalisons votre espace de travail.', en: "Let's personalize your workspace.", es: 'Personalicemos tu espacio de trabajo.' },
  trial:        { ar: 'بدأ أسبوعك التجريبي المجاني الآن — استمتع بجميع الميزات 7 أيام', fr: 'Votre semaine d\'essai commence maintenant — 7 jours gratuits', en: 'Your 7-day free trial has started — enjoy all features', es: 'Tu prueba de 7 días ha comenzado — disfruta todas las funciones' },
  btn_continue: { ar: 'متابعة', fr: 'Continuer', en: 'Continue', es: 'Continuar' },
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

  const [state, setState] = useState<'loading' | 'welcome' | 'error'>('loading')

  useEffect(() => {
    const token     = params.get('token')
    const cafeId    = params.get('cafeId')
    const subdomain = params.get('subdomain')

    if (!token || !cafeId) { setState('error'); return }

    // Persist session
    localStorage.setItem('token',     token)
    localStorage.setItem('cafeId',    cafeId)
    localStorage.setItem('subdomain', subdomain ?? '')

    setState('welcome')
  }, [params])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-950 via-blue-900 to-gray-900" dir={dir}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-center">

        <div className={`px-8 py-8 ${state === 'error' ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`}>
          <Image src="/assets/logo.png" alt="Smart Resto" width={48} height={48} className="rounded-xl mx-auto mb-3" unoptimized />
          <h1 className="text-xl font-extrabold text-white">
            {state === 'loading' ? tx('loading', lang)
             : state === 'welcome' ? tx('welcome', lang)
             : tx('error_title', lang)}
          </h1>
        </div>

        <div className="px-8 py-8 space-y-4">
          {state === 'loading' && (
            <div className="flex justify-center">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {state === 'welcome' && (
            <>
              <div className="text-5xl">🎉</div>
              <p className="text-gray-900 text-base font-bold">{tx('ready', lang)}</p>
              <p className="text-gray-500 text-sm">{tx('personalize', lang)}</p>
              <p className="text-gray-400 text-xs leading-relaxed">{tx('trial', lang)}</p>
              <button
                onClick={() => router.push('/admin/onboarding')}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base transition-all active:scale-[0.98] bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-200/60"
              >
                {tx('btn_continue', lang)}
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="text-gray-600 text-sm">{tx('error_body', lang)}</p>
              <a
                href={`/signup?lang=${lang}`}
                className="inline-block bg-gradient-to-r from-blue-400 to-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all hover:from-blue-500 hover:to-blue-600"
              >
                {tx('btn_signup', lang)}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifySuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-blue-950">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifySuccessInner />
    </Suspense>
  )
}
