'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Loader2, Award } from 'lucide-react'

type Lang = 'ar' | 'fr' | 'en' | 'es'

const T: Record<Lang, Record<string, string>> = {
  ar: {
    title: 'برنامج الولاء', subtitle: 'أدخل رقم هاتفك باش تشوف نقطك',
    howItWorks: 'كتربح نقطة مع كل طلب تديرو فالمطعم — واخا فـ QR وخا مباشرة. كل ما زادت نقطك كتطلع لمستوى أعلى وتوصل لمزايا أكثر.',
    phonePlaceholder: 'رقم الهاتف (+212...)', lookup: 'بحث',
    points: 'النقط الحالية', lifetime: 'مجموع النقط', tier: 'المستوى',
    nextTier: 'باقي لك', pointsToGo: 'نقطة للمستوى الجاي',
    profileTitle: 'الملف الشخصي', name: 'الاسم', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'حفظ', saved: 'تم الحفظ ✓',
    bronze: 'برونز', silver: 'فضي', gold: 'ذهبي', notFound: 'لم نجد نقط ولاء بهذا الرقم',
    lookupFailed: 'تعذر البحث — حاول مجدداً', saveFailed: 'فشل الحفظ — حاول مجدداً',
  },
  fr: {
    title: 'Programme Fidélité', subtitle: 'Entrez votre numéro pour voir vos points',
    howItWorks: 'Vous gagnez des points à chaque commande passée au restaurant — via QR ou sur place. Plus vous cumulez, plus vous montez de niveau et débloquez des avantages.',
    phonePlaceholder: 'Téléphone (+212...)', lookup: 'Rechercher',
    points: 'Points actuels', lifetime: 'Total des points', tier: 'Niveau',
    nextTier: 'Il vous reste', pointsToGo: 'points pour le niveau suivant',
    profileTitle: 'Profil', name: 'Nom', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Enregistrer', saved: 'Enregistré ✓',
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', notFound: 'Aucun point trouvé pour ce numéro',
    lookupFailed: 'Recherche impossible — réessayez', saveFailed: 'Échec de l\'enregistrement — réessayez',
  },
  en: {
    title: 'Loyalty Program', subtitle: 'Enter your phone to see your points',
    howItWorks: 'You earn points on every order at this restaurant — via QR or in person. The more you earn, the higher your tier and the more perks you unlock.',
    phonePlaceholder: 'Phone (+212...)', lookup: 'Look up',
    points: 'Current Points', lifetime: 'Lifetime Points', tier: 'Tier',
    nextTier: 'You need', pointsToGo: 'more points for the next tier',
    profileTitle: 'Profile', name: 'Name', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Save', saved: 'Saved ✓',
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', notFound: 'No loyalty points found for this number',
    lookupFailed: 'Could not look up — try again', saveFailed: 'Failed to save — try again',
  },
  es: {
    title: 'Programa de Fidelidad', subtitle: 'Ingresa tu teléfono para ver tus puntos',
    howItWorks: 'Ganas puntos con cada pedido en el restaurante — por QR o en persona. Cuantos más puntos, mayor tu nivel y más ventajas desbloqueas.',
    phonePlaceholder: 'Teléfono (+212...)', lookup: 'Buscar',
    points: 'Puntos actuales', lifetime: 'Puntos totales', tier: 'Nivel',
    nextTier: 'Te faltan', pointsToGo: 'puntos para el siguiente nivel',
    profileTitle: 'Perfil', name: 'Nombre', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Guardar', saved: 'Guardado ✓',
    bronze: 'Bronce', silver: 'Plata', gold: 'Oro', notFound: 'No se encontraron puntos para este número',
    lookupFailed: 'No se pudo buscar — intenta de nuevo', saveFailed: 'Error al guardar — intenta de nuevo',
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
  const [lookupError, setLookupError] = useState('')
  const [saveError, setSaveError] = useState('')

  async function lookup() {
    if (!phone.trim()) return
    setLoading(true); setNotFound(false); setLookupError(''); setProfile(null)
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`)
      if (!res.ok) { setNotFound(true); return }
      const data: ProfileData = await res.json()
      setProfile(data)
      setForm({
        name: data.customer.name ?? '',
        instagramHandle: data.customer.instagramHandle ?? '',
        facebookHandle:  data.customer.facebookHandle  ?? '',
        tiktokHandle:    data.customer.tiktokHandle    ?? '',
      })
    } catch {
      // Network failure previously left the screen stuck on "loading" with
      // no explanation — surface it instead of failing silently.
      setLookupError(t.lookupFailed)
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true); setSaved(false); setSaveError('')
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) setSaved(true)
      else setSaveError(t.saveFailed)
    } catch {
      setSaveError(t.saveFailed)
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

        {/* First-time visitors have no idea what "points" means here or why
            they'd hand over their phone number — explain the value before
            asking for it. */}
        {!profile && (
          <p className="text-gray-500 text-xs text-center leading-relaxed bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-3">
            {t.howItWorks}
          </p>
        )}

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
        {lookupError && <p className="text-rose-400 text-sm text-center">{lookupError}</p>}

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
              {saveError && <p className="text-rose-400 text-xs text-center">{saveError}</p>}
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
