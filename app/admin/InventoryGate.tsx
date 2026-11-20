'use client'
/**
 * Wraps Smart-Inventory pages (purchases, suppliers, purchase orders).
 * If the feature isn't enabled for this cafe, shows a clear locked state with
 * a link to /admin/inventory (where activation is requested) instead of the
 * page rendering empty / with a generic error while every API call 403s.
 */

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { useLang } from './lang-context'

const T = {
  ar: { title: 'المخزون الذكي غير مفعّل', body: 'هذه الصفحة جزء من وحدة المخزون الذكي، وهي غير مفعّلة لحسابك بعد.', pending: 'طلب التفعيل قيد المراجعة.', cta: 'طلب التفعيل' },
  fr: { title: 'Smart Inventory non activé', body: 'Cette page fait partie du module Smart Inventory, qui n’est pas encore activé pour votre compte.', pending: 'Votre demande d’activation est en cours d’examen.', cta: 'Demander l’activation' },
  en: { title: 'Smart Inventory is not enabled', body: 'This page is part of the Smart Inventory module, which isn’t enabled for your account yet.', pending: 'Your activation request is being reviewed.', cta: 'Request activation' },
  es: { title: 'Smart Inventory no está activado', body: 'Esta página forma parte del módulo Smart Inventory, que aún no está activado para tu cuenta.', pending: 'Tu solicitud de activación está en revisión.', cta: 'Solicitar activación' },
} as const

export default function InventoryGate({ children }: { children: ReactNode }) {
  const { lang, isRTL } = useLang()
  const t = T[(lang in T ? lang : 'en') as keyof typeof T]
  const [state, setState] = useState<'loading' | 'enabled' | 'locked' | 'pending'>('loading')

  useEffect(() => {
    fetch('/api/v1/inventory/activation-status', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return setState('enabled') // can't tell — let the page handle it as before
        setState(d.isSmartInventoryEnabled ? 'enabled' : d.inventoryActivationRequested ? 'pending' : 'locked')
      })
      .catch(() => setState('enabled'))
  }, [])

  if (state === 'enabled') return <>{children}</>
  if (state === 'loading') {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-lg mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
        <p className="text-sm text-gray-500">{state === 'pending' ? t.pending : t.body}</p>
        {state === 'locked' && (
          <Link href="/admin/inventory" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
            {t.cta}
          </Link>
        )}
      </div>
    </div>
  )
}
