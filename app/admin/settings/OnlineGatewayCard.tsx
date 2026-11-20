'use client'
/**
 * Connect the restaurant's OWN online gateway (Tap / Moyasar / Stripe).
 * The secret key is validated against the provider, stored encrypted, and
 * never sent back — only the last 4 characters are shown.
 */

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'

type Provider = '' | 'TAP' | 'MOYASAR' | 'STRIPE'
type Lang = 'ar' | 'fr' | 'en'

const PROVIDERS: { id: Exclude<Provider, ''>; name: string; region: Record<Lang, string>; methods: string; keysUrl: string }[] = [
  { id: 'TAP',     name: 'Tap Payments', region: { ar: 'السعودية · الإمارات · عُمان · الكويت · البحرين · قطر', fr: 'Arabie saoudite · EAU · Oman · Koweït · Bahreïn · Qatar', en: 'Saudi · UAE · Oman · Kuwait · Bahrain · Qatar' }, methods: 'mada · KNET · Benefit · Apple Pay · Visa / Mastercard', keysUrl: 'https://dashboard.tap.company' },
  { id: 'MOYASAR', name: 'Moyasar',      region: { ar: 'السعودية', fr: 'Arabie saoudite', en: 'Saudi Arabia' }, methods: 'mada · Apple Pay · STC Pay · Visa / Mastercard', keysUrl: 'https://dashboard.moyasar.com' },
  { id: 'STRIPE',  name: 'Stripe',       region: { ar: 'الإمارات ودول أخرى', fr: 'EAU et autres pays', en: 'UAE and other countries' }, methods: 'Apple Pay · Google Pay · Visa / Mastercard', keysUrl: 'https://dashboard.stripe.com/apikeys' },
]

const T = {
  ar: {
    title: 'الدفع الإلكتروني من الطاولة',
    intro: 'اربط حساب بوابة الدفع الخاص بمطعمك. الزبون يدفع الفاتورة من هاتفه، والمبلغ يصل مباشرة إلى حسابك.',
    choose: 'اختر بوابة الدفع',
    secret: 'المفتاح السري (Secret Key)',
    secretHelp: 'تجده في لوحة تحكم البوابة. يبدأ بـ sk_live_ أو sk_test_ للتجربة.',
    getKeys: 'الحصول على المفاتيح',
    connect: 'ربط والتحقق',
    replace: 'تغيير المفتاح',
    disconnect: 'إلغاء الربط',
    connected: 'مربوط',
    testMode: 'وضع التجربة',
    endsWith: 'ينتهي بـ',
    secure: 'يُحفظ المفتاح مشفّراً ولا يُعرض مرة أخرى.',
    noEnc: 'تشفير المفاتيح غير مُفعّل على الخادم. تواصل مع الدعم.',
    errors: {
      PLAN_REQUIRED:  'الدفع الإلكتروني متاح في الباقة الاحترافية، أو كإضافة (19$ شهرياً) للباقة الأساسية.',
      BAD_KEY_FORMAT: 'هذا ليس مفتاحاً سرياً. استعمل المفتاح الذي يبدأ بـ sk_.',
      KEY_REJECTED:   'رفضت البوابة هذا المفتاح. تأكد منه وحاول مجدداً.',
      NO_ENCRYPTION:  'تشفير المفاتيح غير مُفعّل على الخادم.',
      default:        'حدث خطأ، حاول مجدداً.',
    },
    saved: 'تم ربط البوابة بنجاح',
    removed: 'تم إلغاء الربط',
  },
  fr: {
    title: 'Paiement en ligne à table',
    intro: 'Connectez le compte de passerelle de votre restaurant. Le client paie l’addition depuis son téléphone, l’argent arrive directement sur votre compte.',
    choose: 'Choisissez la passerelle',
    secret: 'Clé secrète (Secret Key)',
    secretHelp: 'Disponible dans le tableau de bord de la passerelle. Commence par sk_live_ (ou sk_test_ pour tester).',
    getKeys: 'Obtenir les clés',
    connect: 'Connecter et vérifier',
    replace: 'Changer la clé',
    disconnect: 'Déconnecter',
    connected: 'Connecté',
    testMode: 'Mode test',
    endsWith: 'se termine par',
    secure: 'La clé est stockée chiffrée et n’est plus jamais affichée.',
    noEnc: 'Le chiffrement des clés n’est pas activé sur le serveur. Contactez le support.',
    errors: {
      PLAN_REQUIRED:  'Le paiement en ligne est inclus dans l’offre Pro, ou en option (19 $/mois) avec l’offre Essentiel.',
      BAD_KEY_FORMAT: 'Ce n’est pas une clé secrète. Utilisez la clé qui commence par sk_.',
      KEY_REJECTED:   'La passerelle a refusé cette clé. Vérifiez-la et réessayez.',
      NO_ENCRYPTION:  'Le chiffrement des clés n’est pas activé sur le serveur.',
      default:        'Une erreur est survenue, réessayez.',
    },
    saved: 'Passerelle connectée',
    removed: 'Passerelle déconnectée',
  },
  en: {
    title: 'Online payment at the table',
    intro: 'Connect your restaurant’s own payment gateway account. Guests pay the bill from their phone and the money goes straight to your account.',
    choose: 'Choose your gateway',
    secret: 'Secret key',
    secretHelp: 'Found in your gateway dashboard. Starts with sk_live_ (or sk_test_ for testing).',
    getKeys: 'Get your keys',
    connect: 'Connect & verify',
    replace: 'Change key',
    disconnect: 'Disconnect',
    connected: 'Connected',
    testMode: 'Test mode',
    endsWith: 'ends with',
    secure: 'The key is stored encrypted and never shown again.',
    noEnc: 'Key encryption is not configured on the server. Contact support.',
    errors: {
      PLAN_REQUIRED:  'Online payment is included in Pro, or as a $19/month add-on on Starter.',
      BAD_KEY_FORMAT: 'That is not a secret key. Use the one starting with sk_.',
      KEY_REJECTED:   'The gateway rejected this key. Check it and try again.',
      NO_ENCRYPTION:  'Key encryption is not configured on the server.',
      default:        'Something went wrong, try again.',
    },
    saved: 'Gateway connected',
    removed: 'Gateway disconnected',
  },
} as const

export default function OnlineGatewayCard({ lang }: { lang: string }) {
  const t = T[(lang in T ? lang : 'en') as Lang]
  const l = (lang in T ? lang : 'en') as Lang

  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(false)
  const [state, setState]         = useState({ provider: '' as Provider, connected: false, secretHint: '', encryptionReady: true })
  const [provider, setProvider]   = useState<Provider>('TAP')
  const [secretKey, setSecretKey] = useState('')
  const [editing, setEditing]     = useState(false)
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` })

  useEffect(() => {
    fetch('/api/admin/cafe/online-gateway', { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setState(d)
        if (d.provider) setProvider(d.provider)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(nextProvider: Provider) {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/cafe/online-gateway', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ provider: nextProvider, secretKey }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        const code = d.code as keyof typeof t.errors
        setMsg({ ok: false, text: t.errors[code] ?? t.errors.default })
        return
      }
      setState(s => ({ ...s, provider: nextProvider, connected: !!d.connected, secretHint: d.secretHint ?? '' }))
      setSecretKey(''); setEditing(false)
      setMsg({ ok: true, text: nextProvider ? t.saved : t.removed })
    } catch {
      setMsg({ ok: false, text: t.errors.default })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="bg-gray-900 rounded-2xl p-5 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
  }

  const current   = PROVIDERS.find(p => p.id === provider)
  const showForm  = !state.connected || editing
  const inputCls  = 'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono'

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📱</span>
          <h3 className="font-bold text-white">{t.title}</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{t.intro}</p>
      </div>

      {!state.encryptionReady && (
        <p className="text-xs text-amber-300 bg-amber-900/30 border border-amber-800 rounded-xl p-3">{t.noEnc}</p>
      )}

      {state.connected && !editing && current && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-emerald-300">✅ {t.connected}: {current.name}</p>
            <p className="text-xs text-gray-400 font-mono" dir="ltr">{t.endsWith} ••••{state.secretHint}</p>
          </div>
          <p className="text-xs text-gray-400">{current.methods}</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700">{t.replace}</button>
            <button onClick={() => save('')} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/40 text-red-300 hover:bg-red-900/60 disabled:opacity-50">{t.disconnect}</button>
          </div>
        </div>
      )}

      {showForm && (
        <>
          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-2">{t.choose}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROVIDERS.map(p => (
                <button key={p.id} type="button" onClick={() => setProvider(p.id)}
                  className={`text-start rounded-xl border p-3 transition-colors ${provider === p.id ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}>
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{p.region[l]}</p>
                </button>
              ))}
            </div>
            {current && <p className="text-[11px] text-gray-500 mt-2">{current.methods}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400 font-semibold">{t.secret}</label>
              {current && <a href={current.keysUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline">{t.getKeys} ↗</a>}
            </div>
            <input type="password" autoComplete="off" dir="ltr" value={secretKey}
              onChange={e => setSecretKey(e.target.value.trim())} placeholder="sk_live_..." className={inputCls} />
            <p className="text-[11px] text-gray-500 mt-1">{t.secretHelp}</p>
            {secretKey.startsWith('sk_test_') && <p className="text-[11px] text-amber-300 mt-1">⚠️ {t.testMode}</p>}
          </div>

          <p className="text-[11px] text-gray-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {t.secure}</p>

          <div className="flex gap-2">
            <button onClick={() => save(provider)} disabled={busy || !secretKey || !state.encryptionReady}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t.connect}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setSecretKey(''); setProvider(state.provider || 'TAP') }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-800 text-gray-300">✕</button>
            )}
          </div>
        </>
      )}

      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.ok ? '✅' : '❌'} {msg.text}</p>}
    </div>
  )
}
