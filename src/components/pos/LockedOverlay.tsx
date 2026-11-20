'use client'

import { Lock } from 'lucide-react'
import { tr, trf, getLang, isRTL, type Lang } from '../../lib/posI18n'

const LOCALE: Record<Lang, string> = { ar: 'ar', fr: 'fr-FR', en: 'en-GB', es: 'es-ES' }

export default function LockedOverlay({ staffName, plannedEndTime, lang: langProp }: { staffName: string; plannedEndTime: string | null; lang?: Lang }) {
  const lang = langProp ?? getLang()
  const time = plannedEndTime
    ? ` (${new Date(plannedEndTime).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' })})`
    : ''
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
      <div className="max-w-sm text-center" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-white font-black text-xl mb-2">{tr('lk_title', lang)}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          {trf('lk_body', lang, { name: staffName, time })}
        </p>
      </div>
    </div>
  )
}
