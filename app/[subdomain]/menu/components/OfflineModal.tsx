'use client'
import { useEffect, useState } from 'react'
import { ConnState } from '../hooks/useOffline'

interface Props {
  conn:       ConnState
  marketType: 'Local' | 'Global'
  lang?:      string
  queuedOrders: number
}

// Emergency WiFi credentials (restaurant's local hotspot as final fallback)
const EMERGENCY_SSID = 'SmartResto_Emergency'
const EMERGENCY_PASS = 'Resto2026'

const T = {
  ar: {
    title_offline:      'انقطع الاتصال بالإنترنت',
    title_lan:          '⚡ الطلب محلي',
    lan_body:           'تم إرسال طلبك مباشرة إلى المطبخ عبر الشبكة المحلية.',
    local_step1_title:  'الخطوة 1 — تحقق من رصيد الإنترنت',
    local_step1_body:   'يبدو أن WiFi المطعم انقطع. قم بتفعيل بيانات الهاتف أو اتصل برمز الرصيد:',
    ussd_label:         'كود الشحن',
    local_step2_title:  'الخطوة 2 — لا رصيد؟ اتصل بالشبكة الطارئة',
    local_step2_body:   'اتصل بالشبكة المجانية أدناه لإرسال طلبك مجاناً:',
    wifi_name:          'اسم الشبكة',
    wifi_pass:          'كلمة المرور',
    copy:               'نسخ',
    copied:             'تم ✓',
    global_title:       'لا يوجد اتصال بالإنترنت',
    global_body:        'يرجى التحقق من شبكتك والمحاولة مرة أخرى.',
    queued:             'تم حفظ طلبك محلياً — سيُرسَل تلقائياً عند الاتصال.',
    queued_count:       (n: number) => `${n} طلب في الانتظار`,
    retry:              'إعادة المحاولة',
    dismiss:            'حسناً، سأحاول لاحقاً',
  },
  fr: {
    title_offline:      'Connexion perdue',
    title_lan:          '⚡ Commande locale',
    lan_body:           'Votre commande a été envoyée directement en cuisine via le réseau local.',
    local_step1_title:  'Étape 1 — Vérifiez votre données mobiles',
    local_step1_body:   'Le WiFi du restaurant semble coupé. Activez vos données mobiles ou composez:',
    ussd_label:         'Code de solde',
    local_step2_title:  'Étape 2 — Pas de données ? Réseau d\'urgence',
    local_step2_body:   'Connectez-vous au réseau gratuit ci-dessous pour envoyer votre commande:',
    wifi_name:          'Nom du réseau',
    wifi_pass:          'Mot de passe',
    copy:               'Copier',
    copied:             'Copié ✓',
    global_title:       'Pas de connexion internet',
    global_body:        'Veuillez vérifier votre réseau et réessayer.',
    queued:             'Commande sauvegardée — sera envoyée dès reconnexion.',
    queued_count:       (n: number) => `${n} commande(s) en attente`,
    retry:              'Réessayer',
    dismiss:            'OK, je réessaierai plus tard',
  },
  en: {
    title_offline:      'Connection Lost',
    title_lan:          '⚡ Local Order',
    lan_body:           'Your order was sent directly to the kitchen via the local network.',
    local_step1_title:  'Step 1 — Check your mobile data',
    local_step1_body:   "The restaurant's WiFi seems to be down. Turn on mobile data or dial:",
    ussd_label:         'Balance code',
    local_step2_title:  'Step 2 — No data? Use the emergency network',
    local_step2_body:   'Connect to the free network below to send your order for free:',
    wifi_name:          'Network name',
    wifi_pass:          'Password',
    copy:               'Copy',
    copied:             'Copied ✓',
    global_title:       'No Internet Connection',
    global_body:        'Please check your network and try again.',
    queued:             'Order saved locally — will sync automatically when reconnected.',
    queued_count:       (n: number) => `${n} order(s) pending sync`,
    retry:              'Retry',
    dismiss:            'OK, I\'ll try later',
  },
  es: {
    title_offline:      'Sin conexión',
    title_lan:          '⚡ Pedido local',
    lan_body:           'Tu pedido fue enviado directamente a la cocina por la red local.',
    local_step1_title:  'Paso 1 — Verifica tus datos móviles',
    local_step1_body:   'El WiFi del restaurante parece estar caído. Activa tus datos o marca:',
    ussd_label:         'Código de saldo',
    local_step2_title:  'Paso 2 — ¿Sin datos? Red de emergencia',
    local_step2_body:   'Conéctate a la red gratuita para enviar tu pedido sin costo:',
    wifi_name:          'Nombre de red',
    wifi_pass:          'Contraseña',
    copy:               'Copiar',
    copied:             'Copiado ✓',
    global_title:       'Sin conexión a internet',
    global_body:        'Por favor verifica tu red e intenta de nuevo.',
    queued:             'Pedido guardado — se enviará al reconectarse.',
    queued_count:       (n: number) => `${n} pedido(s) pendiente(s)`,
    retry:              'Reintentar',
    dismiss:            'OK, lo intentaré después',
  },
} as const

type Lang = keyof typeof T

// USSD codes for common African operators
const USSD_CODES: Record<string, string> = {
  MA: '*6#',  SN: '*222#',  CI: '*555#',  TN: '*22#',
  DZ: '*100#',NG: '*323#',  GH: '*124#',  KE: '*144#',
}

export default function OfflineModal({ conn, marketType, lang = 'ar', queuedOrders }: Props) {
  const [step,       setStep]       = useState<1 | 2>(1)
  const [copied,     setCopied]     = useState<string | null>(null)
  const [dismissed,  setDismissed]  = useState(false)
  const [visible,    setVisible]    = useState(false)

  const t    = T[(lang as Lang) in T ? (lang as Lang) : 'ar']
  const isRTL = lang === 'ar'

  // Animate in
  useEffect(() => {
    if (conn === 'offline') { setDismissed(false); setStep(1); setVisible(true) }
    if (conn === 'online')  { setVisible(false); setStep(1) }
  }, [conn])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2200)
    })
  }

  function retry() {
    window.location.reload()
  }

  // LAN-only: small toast, not blocking modal
  if (conn === 'lan-only') {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed bottom-4 inset-x-4 z-50 bg-emerald-700 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl animate-slide-up"
      >
        <span className="text-2xl">⚡</span>
        <div className="flex-1">
          <p className="font-bold text-sm">{t.title_lan}</p>
          <p className="text-xs opacity-80">{t.lan_body}</p>
          {queuedOrders > 0 && (
            <p className="text-xs mt-1 text-emerald-200">{t.queued_count(queuedOrders)}</p>
          )}
        </div>
      </div>
    )
  }

  if (conn !== 'offline' || dismissed || !visible) {
    // If online but still has queued orders — show small sync badge
    if (conn === 'online' && queuedOrders > 0) {
      return (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed bottom-4 inset-x-4 z-50 bg-blue-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
        >
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm font-medium">{t.queued_count(queuedOrders)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-2xl shrink-0">
              📶
            </div>
            <div>
              <h2 className="text-white font-extrabold text-base leading-tight">
                {marketType === 'Local' ? t.title_offline : t.global_title}
              </h2>
              {queuedOrders > 0 && (
                <p className="text-emerald-300 text-xs mt-1">{t.queued_count(queuedOrders)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* ── Global market: simple message ─────────────────────────── */}
          {marketType === 'Global' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">{t.global_body}</p>
              {queuedOrders > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
                  {t.queued}
                </div>
              )}
            </div>
          )}

          {/* ── Local market: step-by-step guide ──────────────────────── */}
          {marketType === 'Local' && (
            <>
              {/* Step tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([1, 2] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      step === s
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {s === 1 ? `📱 ${t.local_step1_title}` : `📶 ${t.local_step2_title}`}
                  </button>
                ))}
              </div>

              {/* Step 1: Mobile data */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{t.local_step1_body}</p>

                  {/* USSD codes for common operators */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(USSD_CODES).slice(0, 4).map(([cc, code]) => (
                      <button
                        key={cc}
                        onClick={() => copy(code, cc)}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm hover:border-emerald-400 transition-colors"
                      >
                        <span className="font-mono font-bold text-slate-800">{code}</span>
                        <span className="text-xs text-slate-400">{copied === cc ? '✓' : t.copy}</span>
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    {isRTL ? '⬇️ لا رصيد؟ جرّب الخطوة 2' : '⬇️ No balance? Try step 2'}
                  </p>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                  >
                    {t.local_step2_title} →
                  </button>
                </div>
              )}

              {/* Step 2: Emergency WiFi */}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{t.local_step2_body}</p>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">{t.wifi_name}</p>
                        <p className="font-bold text-lg text-gray-900 tracking-tight">{EMERGENCY_SSID}</p>
                      </div>
                      <button
                        onClick={() => copy(EMERGENCY_SSID, 'ssid')}
                        className="text-xs px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-emerald-700 font-medium hover:bg-emerald-600 hover:text-white transition-colors"
                      >
                        {copied === 'ssid' ? t.copied : t.copy}
                      </button>
                    </div>

                    <div className="h-px bg-emerald-200" />

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">{t.wifi_pass}</p>
                        <p className="font-mono font-bold text-lg text-gray-900">{EMERGENCY_PASS}</p>
                      </div>
                      <button
                        onClick={() => copy(EMERGENCY_PASS, 'pass')}
                        className="text-xs px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-emerald-700 font-medium hover:bg-emerald-600 hover:text-white transition-colors"
                      >
                        {copied === 'pass' ? t.copied : t.copy}
                      </button>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-center">
                    📱 {isRTL
                      ? 'بعد الاتصال، ارجع للتطبيق وأرسل طلبك — الإنترنت مجاني!'
                      : "After connecting, come back and place your order — it's free!"}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Queued order notice */}
          {queuedOrders > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-sm text-blue-700">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
              {t.queued}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={retry}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              {t.retry}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
