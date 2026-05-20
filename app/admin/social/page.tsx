'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Share2, Instagram, Loader2, Save, Upload,
  ToggleLeft, ToggleRight, Info, CheckCircle, Facebook
} from 'lucide-react'

type SocialLinks = {
  instagram: string
  snapchat:  string
  facebook:  string
}

type Profile = {
  logoUrl:            string
  hasSocialShareAddon: boolean
  socialLinks:        SocialLinks
}

export default function SocialPage() {
  const [profile, setProfile] = useState<Profile>({
    logoUrl: '',
    hasSocialShareAddon: false,
    socialLinks: { instagram: '', snapchat: '', facebook: '' }
  })
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  useEffect(() => {
    fetch('/api/admin/cafe/profile', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const sl = (d.socialLinks as Partial<SocialLinks>) || {}
          setProfile({
            logoUrl:             d.logoUrl || '',
            hasSocialShareAddon: d.hasSocialShareAddon || false,
            socialLinks: {
              instagram: sl.instagram || '',
              snapchat:  sl.snapchat  || '',
              facebook:  sl.facebook  || '',
            }
          })
          if (d.logoUrl) setLogoPreview(d.logoUrl)
        }
        setLoading(false)
      })
  }, [])

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setLogoPreview(url)
      setProfile(p => ({ ...p, logoUrl: url }))
    }
    reader.readAsDataURL(file)
  }

  function setSocial(key: keyof SocialLinks, value: string) {
    setProfile(p => ({ ...p, socialLinks: { ...p.socialLinks, [key]: value } }))
  }

  async function save() {
    setSaving(true)
    await fetch('/api/admin/cafe/profile', {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logoUrl:             profile.logoUrl,
        hasSocialShareAddon: profile.hasSocialShareAddon,
        socialLinks:         profile.socialLinks,
      })
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
        <Share2 className="w-6 h-6 text-emerald-600" /> التسويق الذكي
      </h1>

      {/* ── Social handles ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h2 className="font-bold text-gray-800">حسابات التواصل الاجتماعي</h2>

        {/* Instagram */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
            <Instagram className="w-4 h-4 text-pink-500" /> انستقرام
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
            <span className="px-3 text-gray-400 bg-gray-50 border-l border-gray-200 py-2.5 text-sm">@</span>
            <input
              type="text"
              value={profile.socialLinks.instagram}
              onChange={e => setSocial('instagram', e.target.value)}
              placeholder="your_restaurant"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
            />
          </div>
        </div>

        {/* Snapchat */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
            <span className="text-yellow-500 font-bold text-sm">👻</span> سناب شات
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
            <span className="px-3 text-gray-400 bg-gray-50 border-l border-gray-200 py-2.5 text-sm">@</span>
            <input
              type="text"
              value={profile.socialLinks.snapchat}
              onChange={e => setSocial('snapchat', e.target.value)}
              placeholder="your_restaurant"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
            />
          </div>
        </div>

        {/* Facebook */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
            <Facebook className="w-4 h-4 text-blue-600" /> فيسبوك
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
            <span className="px-3 text-gray-400 bg-gray-50 border-l border-gray-200 py-2.5 text-sm select-none">facebook.com/</span>
            <input
              type="text"
              value={profile.socialLinks.facebook}
              onChange={e => setSocial('facebook', e.target.value)}
              placeholder="your.restaurant.page"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Logo watermark ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-3">شعار المطعم (للعلامة المائية)</h2>
        <div className="flex items-start gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-xl border border-gray-100 bg-gray-50" />
          ) : (
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
              <Upload className="w-6 h-6 text-gray-300" />
            </div>
          )}
          <div className="flex-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" /> رفع صورة PNG
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            <p className="text-xs text-gray-400 mt-2">PNG شفاف مفضل · حجم مناسب 512×512px</p>
            <div className="mt-2">
              <label className="text-xs text-gray-500">أو رابط مباشر</label>
              <input
                type="url"
                value={profile.logoUrl.startsWith('data:') ? '' : profile.logoUrl}
                onChange={e => { setProfile(p => ({ ...p, logoUrl: e.target.value })); setLogoPreview(e.target.value) }}
                placeholder="https://..."
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Pay-per-viral-action toggle ──────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-800 mb-1">الدفع مقابل الانتشار الذكي</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              عند تفعيل هذا الخيار، يتم تحميلك رسومًا رمزية لكل إجراء اجتماعي يُنشئه الزبناء (مشاركة، متابعة، منشور). هذا يضمن أنك لا تدفع إلا عند تحقيق نتائج.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <Info className="w-3.5 h-3.5" />
              <span>0.50 درهم / إجراء (المغرب) · 1.00 ريال (الخليج)</span>
            </div>
          </div>
          <button
            onClick={() => setProfile(p => ({ ...p, hasSocialShareAddon: !p.hasSocialShareAddon }))}
            className="shrink-0"
          >
            {profile.hasSocialShareAddon
              ? <ToggleRight className="w-10 h-10 text-emerald-600" />
              : <ToggleLeft  className="w-10 h-10 text-gray-300" />}
          </button>
        </div>
        {profile.hasSocialShareAddon && (
          <div className="mt-3 bg-emerald-50 rounded-xl p-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            مفعّل — سيتم تحميلك عند كل إجراء اجتماعي يُكتشف تلقائياً.
          </div>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
           saved  ? <CheckCircle className="w-4 h-4" /> :
           <Save className="w-4 h-4" />}
          {saved ? 'تم الحفظ!' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  )
}
