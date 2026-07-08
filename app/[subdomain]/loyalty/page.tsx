'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Loader2, Award } from 'lucide-react'

type Lang = 'ar' | 'fr' | 'en' | 'es'

const T: Record<Lang, Record<string, string>> = {
  ar: {
    title: 'برنامج الولاء', subtitle: 'أدخل رقم هاتفك باش تشوف نقطك',
    phonePlaceholder: 'رقم الهاتف (+212...)', lookup: 'بحث',
    points: 'النقط الحالية', lifetime: 'مجموع النقط', tier: 'المستوى',
    nextTier: 'باقي لك', pointsToGo: 'نقطة للمستوى الجاي',
    profileTitle: 'الملف الشخصي', name: 'الاسم', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'حفظ', saved: 'تم الحفظ ✓',
    bronze: 'برونز', silver: 'فضي', gold: 'ذهبي', notFound: 'المطعم غير موجود',
  },
  fr: {
    title: 'Programme Fidélité', subtitle: 'Entrez votre numéro pour voir vos points',
    phonePlaceholder: 'Téléphone (+212...)', lookup: 'Rechercher',
    points: 'Points actuels', lifetime: 'Total des points', tier: 'Niveau',
    nextTier: 'Il vous reste', pointsToGo: 'points pour le niveau suivant',
    profileTitle: 'Profil', name: 'Nom', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Enregistrer', saved: 'Enregistré ✓',
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', notFound: 'Restaurant introuvable',
  },
  en: {
    title: 'Loyalty Program', subtitle: 'Enter your phone to see your points',
    phonePlaceholder: 'Phone (+212...)', lookup: 'Look up',
    points: 'Current Points', lifetime: 'Lifetime Points', tier: 'Tier',
    nextTier: 'You need', pointsToGo: 'more points for the next tier',
    profileTitle: 'Profile', name: 'Name', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Save', saved: 'Saved ✓',
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', notFound: 'Restaurant not found',
  },
  es: {
    title: 'Programa de Fidelidad', subtitle: 'Ingresa tu teléfono para ver tus puntos',
    phonePlaceholder: 'Teléfono (+212...)', lookup: 'Buscar',
    points: 'Puntos actuales', lifetime: 'Puntos totales', tier: 'Nivel',
    nextTier: 'Te faltan', pointsToGo: 'puntos para el siguiente nivel',
    profileTitle: 'Perfil', name: 'Nombre', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Guardar', saved: 'Guardado ✓',
    bronze: 'Bronce', silver: 'Plata', gold: 'Oro', notFound: 'Restaurante no encontrado',
  },
}

interface ProfileData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  lifetimePoints: number
  currentPoints: number
  nextTier: { tier: string; pointsNeeded: number } | null
  customer: { name: string | null; instagramHandle: string | null; facebookHandle: string | null; tiktokHandle: string | null }
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'text-orange-400', SILVER: 'text-slate-300', GOLD: 'text-amber-400',
}

export default function CustomerLoyaltyPage() {
  const params = useParams()
  const subdomain = params.subdomain as string
  const [lang, setLang] = useState<Lang>('fr')
  const t = T[lang]

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState({ name: '', instagramHandle: '', facebookHandle: '', tiktokHandle: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function lookup() {
    if (!phone.trim()) return
    setLoading(true); setNotFound(false)
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`)
      if (!res.ok) { setNotFound(true); setProfile(null); return }
      const data: ProfileData = await res.json()
      setProfile(data)
      setForm({
        name: data.customer.name ?? '',
        instagramHandle: data.customer.instagramHandle ?? '',
        facebookHandle:  data.customer.facebookHandle  ?? '',
        tiktokHandle:    data.customer.tiktokHandle    ?? '',
      })
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex justify-center gap-2 mb-2">
          {(['ar', 'fr', 'en', 'es'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${lang === l ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.subtitle}</p>
        </div>

        <div className="flex gap-2">
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={lookup} disabled={loading || !phone.trim()}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.lookup}
          </button>
        </div>

        {notFound && <p className="text-rose-400 text-sm text-center">{t.notFound}</p>}

        {profile && (
          <>
            <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.points}</span>
                <span className="text-white font-extrabold text-2xl">{profile.currentPoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.lifetime}</span>
                <span className="text-gray-300 font-bold">{profile.lifetimePoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.tier}</span>
                <span className={`font-bold flex items-center gap-1 ${TIER_COLORS[profile.tier]}`}>
                  <Award className="w-4 h-4" /> {t[profile.tier.toLowerCase() as 'bronze' | 'silver' | 'gold']}
                </span>
              </div>
              {profile.nextTier && (
                <p className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
                  {t.nextTier} {profile.nextTier.pointsNeeded} {t.pointsToGo}
                </p>
              )}
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <h3 className="text-white font-bold text-sm">{t.profileTitle}</h3>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t.name}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.instagramHandle} onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value }))}
                placeholder={t.instagram}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.facebookHandle} onChange={e => setForm(f => ({ ...f, facebookHandle: e.target.value }))}
                placeholder={t.facebook}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.tiktokHandle} onChange={e => setForm(f => ({ ...f, tiktokHandle: e.target.value }))}
                placeholder={t.tiktok}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={saveProfile} disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : saved ? t.saved : t.save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
