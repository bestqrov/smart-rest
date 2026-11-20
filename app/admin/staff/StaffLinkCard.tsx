'use client'
/**
 * The restaurant's staff login link (/staff?sub=<subdomain>). Staff open it
 * once on their phone/tablet: the restaurant is pre-filled, they only pick a
 * role and type their PIN — no "subdomain" to remember.
 */

import { useEffect, useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'

const T = {
  ar: { title: 'رابط دخول الموظفين', body: 'أرسل هذا الرابط لموظفيك. يفتحونه مرة واحدة، ثم يختارون الدور ويدخلون رمز PIN فقط.', copy: 'نسخ', copied: 'تم النسخ', share: 'إرسال عبر واتساب', msg: 'رابط الدخول إلى نظام المطعم:' },
  fr: { title: 'Lien de connexion du personnel', body: 'Envoyez ce lien à votre équipe. Ils l’ouvrent une fois, puis choisissent leur rôle et saisissent leur PIN.', copy: 'Copier', copied: 'Copié', share: 'Envoyer par WhatsApp', msg: 'Lien de connexion au système du restaurant :' },
  en: { title: 'Staff login link', body: 'Send this link to your team. They open it once, then just pick their role and enter their PIN.', copy: 'Copy', copied: 'Copied', share: 'Send via WhatsApp', msg: 'Login link for the restaurant system:' },
  es: { title: 'Enlace de acceso del personal', body: 'Envía este enlace a tu equipo. Lo abren una vez y luego eligen su rol e introducen su PIN.', copy: 'Copiar', copied: 'Copiado', share: 'Enviar por WhatsApp', msg: 'Enlace de acceso al sistema del restaurante:' },
} as const

export default function StaffLinkCard({ lang }: { lang: string }) {
  const t = T[(lang in T ? lang : 'en') as keyof typeof T]
  const [link, setLink]     = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const sub = localStorage.getItem('subdomain')
      if (sub) setLink(`${window.location.origin}/staff?sub=${encodeURIComponent(sub)}`)
    } catch {}
  }, [])

  if (!link) return null
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-600" /> {t.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{t.body}</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <code dir="ltr" className="flex-1 min-w-0 truncate bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700">{link}</code>
        <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t.copied : t.copy}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${t.msg} ${link}`)}`} target="_blank" rel="noreferrer"
          className="px-3 py-2 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: '#25D366' }}>
          {t.share}
        </a>
      </div>
    </div>
  )
}
