'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Palette, Lock, Users,
  Save, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
  RefreshCw
} from 'lucide-react'
import { useLang } from '../lang-context'
import { A } from '../../../lib/adminI18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  businessName:        string
  name:                string
  country:             string
  currency:            string
  logoUrl:             string
  accentColor:         string
  primaryFont:         string
  localIp:             string
  reservationsEnabled: boolean
  googleMapsUrl:       string
  tripadvisorUrl:      string
}

type StaffMember = {
  id:         string
  name:       string
  role:       string
  pinDisplay: string | null
  shiftStatus: string
}

type Tab = 'profile' | 'branding' | 'password' | 'staff'

// ─── Font options ─────────────────────────────────────────────────────────────

const FONTS = [
  { value: 'Cairo',    label: 'Cairo (Arabic)' },
  { value: 'Tajawal',  label: 'Tajawal (Arabic)' },
  { value: 'Rubik',    label: 'Rubik' },
  { value: 'Inter',    label: 'Inter' },
  { value: 'Poppins',  label: 'Poppins' },
]

const PRESET_COLORS = [
  '#059669', // emerald (default)
  '#2563eb', // blue
  '#7c3aed', // violet
  '#dc2626', // red
  '#d97706', // amber
  '#0891b2', // cyan
  '#db2777', // pink
  '#16a34a', // green
  '#ea580c', // orange
  '#1e293b', // slate dark
]

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { lang, isRTL } = useLang()
  const t = A[lang]

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving, setSaving]       = useState(false)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  const [profile, setProfile] = useState<Profile>({
    businessName: '', name: '', country: '', currency: '',
    logoUrl: '', accentColor: '#059669', primaryFont: 'Cairo', localIp: '',
    reservationsEnabled: true, googleMapsUrl: '', tripadvisorUrl: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setProfile({
          businessName:        d.businessName ?? '',
          name:                d.name ?? '',
          country:             d.country ?? '',
          currency:            d.currency ?? '',
          logoUrl:             d.logoUrl ?? '',
          accentColor:         d.accentColor ?? '#059669',
          primaryFont:         d.primaryFont ?? 'Cairo',
          localIp:             d.localIp ?? '',
          reservationsEnabled: d.reservationsEnabled ?? true,
          googleMapsUrl:       d.googleMapsUrl ?? '',
          tripadvisorUrl:      d.tripadvisorUrl ?? '',
        })
      })
  }, [router])

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cafe/profile', {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({
          businessName:        profile.businessName,
          logoUrl:             profile.logoUrl || null,
          accentColor:         profile.accentColor,
          primaryFont:         profile.primaryFont,
          localIp:             profile.localIp || null,
          reservationsEnabled: profile.reservationsEnabled,
          googleMapsUrl:       profile.googleMapsUrl || null,
          tripadvisorUrl:      profile.tripadvisorUrl || null,
        })
      })
      if (res.ok) showToast('تم الحفظ بنجاح ✓', 'success')
      else showToast('فشل الحفظ', 'error')
    } finally { setSaving(false) }
  }

  // ── Password ──────────────────────────────────────────────────────────────

  const [pwForm, setPwForm]   = useState({ current: '', newPw: '', confirm: '' })
  const [showPw, setShowPw]   = useState({ current: false, newPw: false, confirm: false })

  async function changePassword() {
    if (pwForm.newPw !== pwForm.confirm) { showToast('كلمات المرور غير متطابقة', 'error'); return }
    if (pwForm.newPw.length < 8)         { showToast('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw })
      })
      const d = await res.json()
      if (res.ok) { showToast('تم تغيير كلمة المرور ✓', 'success'); setPwForm({ current: '', newPw: '', confirm: '' }) }
      else         showToast(d.error ?? 'فشل التغيير', 'error')
    } finally { setSaving(false) }
  }

  // ── Staff PINs ────────────────────────────────────────────────────────────

  const [staff, setStaff]         = useState<StaffMember[]>([])
  const [editingPin, setEditingPin]= useState<Record<string, string>>({})
  const [savingPin, setSavingPin]  = useState<string | null>(null)

  useEffect(() => {
    if (activeTab !== 'staff') return
    fetch('/api/admin/staff', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setStaff(Array.isArray(d) ? d : d.staff ?? []))
  }, [activeTab])

  async function updatePin(staffId: string) {
    const pin = editingPin[staffId] ?? ''
    if (!/^\d{4,8}$/.test(pin)) { showToast('PIN يجب أن يكون بين 4 و 8 أرقام', 'error'); return }
    setSavingPin(staffId)
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/pin`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ pinCode: pin })
      })
      if (res.ok) {
        showToast('تم تحديث الـ PIN ✓', 'success')
        setStaff(prev => prev.map(s => s.id === staffId ? { ...s, pinDisplay: pin } : s))
        setEditingPin(prev => { const n = { ...prev }; delete n[staffId]; return n })
      } else {
        const d = await res.json()
        showToast(d.error ?? 'فشل التحديث', 'error')
      }
    } finally { setSavingPin(null) }
  }

  const ROLE_LABEL: Record<string, string> = {
    CASHIER: 'كاشير', WAITER: 'نادل', SUPERVISOR: 'مشرف'
  }
  const ROLE_COLOR: Record<string, string> = {
    CASHIER:    'bg-amber-100 text-amber-700',
    WAITER:     'bg-sky-100 text-sky-700',
    SUPERVISOR: 'bg-violet-100 text-violet-700',
  }

  // ─────────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'profile',  icon: User,    label: t.profile },
    { id: 'branding', icon: Palette, label: t.branding },
    { id: 'password', icon: Lock,    label: t.password },
    { id: 'staff',    icon: Users,   label: t.staffPins },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{t.settings}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t.profile} · {t.branding} · {t.password}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><User className="w-5 h-5 text-emerald-600" /> {t.profile}</h2>

          <div className="space-y-4">
            <Field label={t.businessName}>
              <input
                value={profile.businessName}
                onChange={e => setProfile(p => ({ ...p, businessName: e.target.value }))}
                placeholder="مثال: مقهى النجمة"
                className="input"
              />
            </Field>

            <Field label={t.logoUrl}>
              <div className="flex gap-2">
                <input
                  value={profile.logoUrl}
                  onChange={e => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://..."
                  className="input flex-1"
                />
                {profile.logoUrl && (
                  <img
                    src={profile.logoUrl}
                    alt="logo"
                    className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-gray-50 shrink-0"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">ارفع الصورة على Imgur أو Cloudinary وأدخل الرابط هنا</p>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t.zone}>
                <input value={profile.country} readOnly className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
              </Field>
              <Field label={t.price}>
                <input value={profile.currency} readOnly className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
              </Field>
            </div>

            <Field label={t.localIpLabel}>
              <input
                value={profile.localIp}
                onChange={e => setProfile(p => ({ ...p, localIp: e.target.value.trim() }))}
                placeholder="192.168.1.100"
                className="input font-mono"
                inputMode="url"
                spellCheck={false}
              />
              <p className="text-xs text-gray-400 mt-1">{t.localIpHint}</p>
            </Field>
          </div>

          {/* Review links */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800">⭐ {lang === 'ar' ? 'روابط التقييم' : lang === 'fr' ? 'Liens d\'avis clients' : 'Review links'}</p>
            <p className="text-xs text-gray-400 -mt-1">
              {lang === 'ar' ? 'تظهر في شاشة الشكر بعد الدفع — اتركها فارغة لإخفائها' : lang === 'fr' ? 'Affichés après paiement — laisser vide pour masquer' : 'Shown on the thank-you screen after payment — leave empty to hide'}
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Google Maps</label>
              <input
                value={profile.googleMapsUrl}
                onChange={e => setProfile(p => ({ ...p, googleMapsUrl: e.target.value.trim() }))}
                placeholder="https://g.page/r/xxxxx/review"
                className="input font-mono text-xs"
                inputMode="url"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Tripadvisor</label>
              <input
                value={profile.tripadvisorUrl}
                onChange={e => setProfile(p => ({ ...p, tripadvisorUrl: e.target.value.trim() }))}
                placeholder="https://www.tripadvisor.com/Restaurant_Review-..."
                className="input font-mono text-xs"
                inputMode="url"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Reservations toggle */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">📅 نظام الحجز</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {profile.reservationsEnabled ? 'الحجز مفعّل — يظهر زر الحجز في قائمة العملاء' : 'الحجز موقوف — زر الحجز مخفي من قائمة العملاء'}
              </p>
            </div>
            <button
              onClick={() => {
                const next = !profile.reservationsEnabled
                setProfile(p => ({ ...p, reservationsEnabled: next }))
                fetch('/api/admin/cafe/profile', {
                  method: 'PUT',
                  headers: authHeader(),
                  body: JSON.stringify({ reservationsEnabled: next }),
                }).then(r => {
                  if (r.ok) showToast(next ? 'تم تفعيل الحجز ✓' : 'تم إيقاف الحجز ✓', 'success')
                  else showToast('فشل التحديث', 'error')
                })
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${profile.reservationsEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.reservationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <SaveButton saving={saving} onClick={saveProfile} label={t.saveChanges} />
        </section>
      )}

      {/* ── Branding tab ── */}
      {activeTab === 'branding' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-6">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Palette className="w-5 h-5 text-violet-600" /> {t.branding}</h2>

          {/* Color */}
          <Field label={t.accentColor}>
            <div className="space-y-3">
              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setProfile(p => ({ ...p, accentColor: c }))}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${profile.accentColor === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''}`}
                    title={c}
                  />
                ))}
              </div>
              {/* Custom picker */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={profile.accentColor}
                  onChange={e => setProfile(p => ({ ...p, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <span className="text-sm font-mono text-gray-600">{profile.accentColor}</span>
              </div>
            </div>
          </Field>

          {/* Font */}
          <Field label={t.font}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONTS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setProfile(p => ({ ...p, primaryFont: f.value }))}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    profile.primaryFont === f.value
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Live preview */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t.preview}:</p>
            <div
              className="rounded-xl p-4 text-white text-center"
              style={{ backgroundColor: profile.accentColor, fontFamily: profile.primaryFont }}
            >
              <p className="text-lg font-bold">{profile.businessName || 'اسم المطعم'}</p>
              <p className="text-sm opacity-80 mt-1">قائمة الطلبات • Menu</p>
              <div
                className="mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                اطلب الآن
              </div>
            </div>
          </div>

          <SaveButton saving={saving} onClick={saveProfile} label={t.saveChanges} />
        </section>
      )}

      {/* ── Password tab ── */}
      {activeTab === 'password' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Lock className="w-5 h-5 text-red-500" /> {t.changePassword}</h2>

          <Field label={t.currentPw}>
            <PasswordInput
              value={pwForm.current}
              onChange={v => setPwForm(p => ({ ...p, current: v }))}
              show={showPw.current}
              onToggle={() => setShowPw(p => ({ ...p, current: !p.current }))}
              placeholder="••••••••"
            />
          </Field>

          <Field label={t.newPw}>
            <PasswordInput
              value={pwForm.newPw}
              onChange={v => setPwForm(p => ({ ...p, newPw: v }))}
              show={showPw.newPw}
              onToggle={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))}
              placeholder="8+"
            />
          </Field>

          <Field label={t.confirmPw}>
            <PasswordInput
              value={pwForm.confirm}
              onChange={v => setPwForm(p => ({ ...p, confirm: v }))}
              show={showPw.confirm}
              onToggle={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
              placeholder="••••••••"
            />
          </Field>

          {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
            <p className="text-red-500 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> كلمات المرور غير متطابقة
            </p>
          )}

          <button
            onClick={changePassword}
            disabled={saving || !pwForm.current || !pwForm.newPw || !pwForm.confirm}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {t.changePassword}
          </button>
        </section>
      )}

      {/* ── Staff PINs tab ── */}
      {activeTab === 'staff' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" /> {t.staffPins}
            </h2>
            <button
              onClick={() => {
                fetch('/api/admin/staff', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                  .then(r => r.ok ? r.json() : [])
                  .then(d => setStaff(Array.isArray(d) ? d : d.staff ?? []))
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {staff.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {staff.map(s => {
                const isEditing = editingPin[s.id] !== undefined
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm shrink-0">
                      {s.name.charAt(0)}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{s.name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[s.role] ?? s.role}
                      </span>
                    </div>

                    {/* PIN input */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={8}
                            value={editingPin[s.id]}
                            onChange={e => setEditingPin(prev => ({ ...prev, [s.id]: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                            className="w-20 text-center border-2 border-sky-400 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:outline-none"
                            placeholder="4-8 أرقام"
                            autoFocus
                          />
                          <button
                            onClick={() => updatePin(s.id)}
                            disabled={savingPin === s.id}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                          >
                            {savingPin === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingPin(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-gray-500 text-sm bg-gray-100 px-2.5 py-1 rounded-lg">
                            {s.pinDisplay ?? '••••'}
                          </span>
                          <button
                            onClick={() => setEditingPin(prev => ({ ...prev, [s.id]: s.pinDisplay ?? '' }))}
                            className="text-xs text-sky-600 hover:text-sky-800 font-semibold px-2 py-1 rounded-lg hover:bg-sky-50 transition-all"
                          >
                            {t.edit}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SaveButton({ saving, onClick, label }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all active:scale-95"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {label ?? 'Save'}
    </button>
  )
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: {
  value:      string
  onChange:   (v: string) => void
  show:       boolean
  onToggle:   () => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
