'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Plus, Trash2, ArrowLeft, Loader2, CheckCircle,
  Star, Image as ImageIcon, Phone, Mail, BarChart3, MessageSquare,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Stat = { value: string; en: string; fr: string; ar: string }

type Testimonial = {
  name: string
  role: { en: string; fr: string; ar: string }
  rating: number
  text: { en: string; fr: string; ar: string }
  avatarUrl?: string
}

type LandingConfig = {
  stats: Stat[]
  testimonials: Testimonial[]
  contact: { whatsapp: string; email: string }
  heroImageUrl: string
}

const DEFAULT_CONFIG: LandingConfig = {
  stats: [
    { value: '500+', en: 'Restaurants', fr: 'Restaurants', ar: 'مطعم ومقهى' },
    { value: '8+',   en: 'Countries',   fr: 'Pays',        ar: 'دول مخدومة' },
    { value: '50K+', en: 'Daily Orders',fr: 'Cmd/jour',    ar: 'طلب يومياً' },
    { value: '4.9★', en: 'Avg Rating',  fr: 'Note moy.',   ar: 'تقييم متوسط' },
  ],
  testimonials: [
    {
      name: 'Mohammed Idrissi',
      role: { en: 'Owner, Brahim Restaurant — Marrakech', fr: 'Propriétaire, Restaurant Brahim — Marrakech', ar: 'صاحب مطعم ببراهيم، مراكش' },
      rating: 5,
      text: {
        en: 'Before SmartMenu we lost so much time on wrong orders. Now the kitchen reads everything clearly.',
        fr: 'Avant SmartMenu, nous perdions beaucoup de temps sur les erreurs.',
        ar: 'قبل SmartMenu كنت نخسر وقت كبير في الطلبات الغلوطة.',
      },
    },
    {
      name: 'Fatima Bouzidi',
      role: { en: 'Manager, Café Latte — Agadir', fr: 'Directrice, Café Latte — Agadir', ar: 'مديرة كافي لاتيه، أكادير' },
      rating: 5,
      text: {
        en: 'Setup was incredibly easy — in under an hour the menu was live and QR stickers printed.',
        fr: "Configuration incroyablement facile — en moins d'une heure le menu était en ligne.",
        ar: 'إعداد سهل جداً — في أقل من ساعة كان المنيو جاهز.',
      },
    },
    {
      name: 'Khalid Al-Omari',
      role: { en: 'Owner, Food Court — Riyadh', fr: 'Propriétaire, Food Court — Riyad', ar: 'صاحب فود كورت، الرياض' },
      rating: 5,
      text: {
        en: 'The table merge feature solved a huge problem for large families.',
        fr: 'La fusion de tables a résolu un énorme problème pour les grandes familles.',
        ar: 'نظام دمج الطاولات للعائلات الكبيرة حل لنا مشكلة كبيرة.',
      },
    },
  ],
  contact: { whatsapp: '+212 6 00 00 00 00', email: 'contact@smartmenu.ma' },
  heroImageUrl: '/assets/mobile.png',
}

function superHeader(secret: string) {
  return { 'x-superadmin-secret': secret, 'Content-Type': 'application/json' }
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-emerald-600" />
      </div>
      <h2 className="font-bold text-slate-800">{title}</h2>
    </div>
  )
}

function LangTabs({ active, onChange }: { active: 'en' | 'fr' | 'ar'; onChange: (l: 'en' | 'fr' | 'ar') => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg w-fit mb-3">
      {(['en', 'fr', 'ar'] as const).map(l => (
        <button key={l} onClick={() => onChange(l)}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${active === l ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LandingEditorPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [cfg, setCfg] = useState<LandingConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTestiLang, setActiveTestiLang] = useState<'en' | 'fr' | 'ar'>('en')
  const [authErr, setAuthErr] = useState(false)

  async function login() {
    if (!secret.trim()) return
    setLoading(true); setAuthErr(false)
    const r = await fetch('/api/superadmin/landing-config', { headers: superHeader(secret) })
    setLoading(false)
    if (!r.ok) { setAuthErr(true); return }
    const d = await r.json()
    if (d && Object.keys(d).length > 0) setCfg({ ...DEFAULT_CONFIG, ...d })
    setAuthed(true)
  }

  async function save() {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/superadmin/landing-config', {
        method: 'PUT',
        headers: superHeader(secret),
        body: JSON.stringify(cfg),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  // ─── Stats helpers ─────────────────────────────────────────────────────────

  function updateStat(i: number, field: keyof Stat, val: string) {
    setCfg(c => ({ ...c, stats: c.stats.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }))
  }

  // ─── Testimonial helpers ───────────────────────────────────────────────────

  function addTestimonial() {
    const blank: Testimonial = {
      name: '', role: { en: '', fr: '', ar: '' }, rating: 5,
      text: { en: '', fr: '', ar: '' }, avatarUrl: '',
    }
    setCfg(c => ({ ...c, testimonials: [...c.testimonials, blank] }))
  }

  function removeTestimonial(i: number) {
    setCfg(c => ({ ...c, testimonials: c.testimonials.filter((_, idx) => idx !== i) }))
  }

  function updateTesti(i: number, field: keyof Testimonial, val: any) {
    setCfg(c => ({ ...c, testimonials: c.testimonials.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }))
  }

  function updateTestiLang(i: number, subField: 'role' | 'text', lang: 'en' | 'fr' | 'ar', val: string) {
    setCfg(c => ({
      ...c,
      testimonials: c.testimonials.map((t, idx) =>
        idx === i ? { ...t, [subField]: { ...t[subField], [lang]: val } } : t
      ),
    }))
  }

  if (!authed) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 w-full max-w-sm space-y-4">
        <h1 className="font-extrabold text-slate-800 text-xl text-center">Landing Editor</h1>
        <p className="text-xs text-slate-400 text-center">Enter the superadmin secret to continue</p>
        <input
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          placeholder="Superadmin secret"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        {authErr && <p className="text-red-500 text-xs text-center">Wrong secret</p>}
        <button onClick={login} disabled={loading}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/superadmin')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="font-extrabold text-slate-800">Landing Page Editor</h1>
            <p className="text-xs text-slate-400">Changes go live immediately after saving</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/landing" target="_blank" rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:underline font-medium px-3 py-1.5 border border-emerald-200 rounded-lg">
            Preview →
          </a>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : saved
              ? <><CheckCircle className="w-4 h-4" /> Saved!</>
              : <><Save className="w-4 h-4" /> Save Changes</>
            }
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">

        {/* ── Hero Image ──────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={ImageIcon} title="Hero Image" />
          <p className="text-xs text-slate-400 mb-3">URL or path to the hero screenshot (e.g. /assets/mobile.png or https://…)</p>
          <input
            value={cfg.heroImageUrl}
            onChange={e => setCfg(c => ({ ...c, heroImageUrl: e.target.value }))}
            placeholder="/assets/mobile.png"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {cfg.heroImageUrl && (
            <div className="mt-3 max-h-40 overflow-hidden rounded-xl border border-slate-100">
              <img src={cfg.heroImageUrl} alt="preview" className="w-auto max-h-40 object-contain mx-auto" />
            </div>
          )}
        </section>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={BarChart3} title="Stats Bar (4 numbers)" />
          <div className="space-y-3">
            {cfg.stats.map((s, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <input value={s.value} onChange={e => updateStat(i, 'value', e.target.value)}
                  placeholder="500+"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={s.en} onChange={e => updateStat(i, 'en', e.target.value)}
                  placeholder="Label EN"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={s.fr} onChange={e => updateStat(i, 'fr', e.target.value)}
                  placeholder="Label FR"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={s.ar} onChange={e => updateStat(i, 'ar', e.target.value)}
                  placeholder="التسمية AR" dir="rtl"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Columns: Value · EN label · FR label · AR label</p>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={Phone} title="Contact Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1">
                <Phone className="w-3 h-3" /> WhatsApp / Phone
              </label>
              <input
                value={cfg.contact.whatsapp}
                onChange={e => setCfg(c => ({ ...c, contact: { ...c.contact, whatsapp: e.target.value } }))}
                placeholder="+212 6 00 00 00 00"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input
                value={cfg.contact.email}
                onChange={e => setCfg(c => ({ ...c, contact: { ...c.contact, email: e.target.value } }))}
                placeholder="contact@smartmenu.ma"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="font-bold text-slate-800">Testimonials</h2>
            </div>
            <div className="flex items-center gap-2">
              <LangTabs active={activeTestiLang} onChange={setActiveTestiLang} />
              <button onClick={addTestimonial}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {cfg.testimonials.map((tm, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input value={tm.name} onChange={e => updateTesti(i, 'name', e.target.value)}
                      placeholder="Customer name"
                      className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <input value={tm.avatarUrl ?? ''} onChange={e => updateTesti(i, 'avatarUrl', e.target.value)}
                      placeholder="Avatar URL (optional)"
                      className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => updateTesti(i, 'rating', n)}>
                        <Star className={`w-4 h-4 ${n <= tm.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                      </button>
                    ))}
                  </div>
                  <button onClick={() => removeTestimonial(i)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    value={tm.role[activeTestiLang]}
                    onChange={e => updateTestiLang(i, 'role', activeTestiLang, e.target.value)}
                    placeholder={`Role (${activeTestiLang.toUpperCase()})`}
                    dir={activeTestiLang === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <textarea
                    value={tm.text[activeTestiLang]}
                    onChange={e => updateTestiLang(i, 'text', activeTestiLang, e.target.value)}
                    placeholder={`Review text (${activeTestiLang.toUpperCase()})`}
                    rows={3}
                    dir={activeTestiLang === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save footer */}
        <div className="flex justify-end pb-8">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save All Changes</>}
          </button>
        </div>
      </main>
    </div>
  )
}
