'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Users, Plus, QrCode, RefreshCw, Trash2,
  Edit2, Check, X, ChevronDown, ChevronUp, Search,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id:             string
  name:           string
  role:           PrimaryRole
  roles:          string[]
  pinDisplay:     string | null
  shiftStatus:    'ACTIVE' | 'OFF_DUTY'
  clockInTime:    string | null
  isActive:       boolean
  pendingAlerts:  number
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}

type PrimaryRole = 'WAITER' | 'CASHIER' | 'SUPERVISOR'

interface NewStaffForm {
  name:    string
  role:    PrimaryRole
  roles:   string[]
  pinCode: string
}

type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── Extra roles — only the common restaurant ones ─────────────────────────────

const EXTRA_ROLES = [
  { value: 'COOK',       icon: '🥘', ar: 'طباخ',        fr: 'Cuisinier',   en: 'Cook'       },
  { value: 'BAKER',      icon: '🥖', ar: 'خباز',         fr: 'Boulanger',   en: 'Baker'      },
  { value: 'BARISTA',    icon: '☕', ar: 'باريستا',      fr: 'Barista',     en: 'Barista'    },
  { value: 'BARTENDER',  icon: '🍹', ar: 'نادل بار',    fr: 'Barman',      en: 'Bartender'  },
  { value: 'RUNNER',     icon: '🏃', ar: 'رانر',         fr: 'Runner',      en: 'Runner'     },
  { value: 'DISHWASHER', icon: '🍽️', ar: 'غسيل أواني', fr: 'Plongeur',    en: 'Dishwasher' },
  { value: 'CLEANER',    icon: '🧹', ar: 'نظافة',        fr: 'Entretien',   en: 'Cleaner'    },
  { value: 'TECHNICIAN', icon: '🔧', ar: 'تقني',         fr: 'Technicien',  en: 'Technician' },
  { value: 'DELIVERY',   icon: '🛵', ar: 'توصيل',        fr: 'Livreur',     en: 'Delivery'   },
  { value: 'SECURITY',   icon: '🛡️', ar: 'أمن',          fr: 'Sécurité',    en: 'Security'   },
]

// ── Role styles ───────────────────────────────────────────────────────────────

const ROLE_META: Record<PrimaryRole, { badge: string; dot: string; label: Record<Lang, string> }> = {
  SUPERVISOR: { badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500', label: { ar: 'مشرف', fr: 'Superviseur', en: 'Supervisor', es: 'Supervisor' } },
  CASHIER:    { badge: 'bg-sky-100 text-sky-700 border-sky-200',          dot: 'bg-sky-500',    label: { ar: 'كاشير', fr: 'Caissier', en: 'Cashier', es: 'Cajero' } },
  WAITER:     { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: { ar: 'نادل', fr: 'Serveur', en: 'Waiter', es: 'Camarero' } },
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  fr: {
    title: 'Personnel', subtitle: 'Gérer les membres et leurs accès',
    addStaff: 'Ajouter', name: 'Nom complet', role: 'Rôle', pin: 'Code PIN (4–8 chiffres)',
    save: 'Enregistrer', saving: 'Enregistrement…', cancel: 'Annuler',
    onDuty: 'En service', offDuty: 'Hors service', since: 'depuis',
    hours: 'h', mins: 'min', tables: 'Tables', noTables: '—',
    deactivate: 'Désactiver', confirmDeactivate: 'Désactiver ce membre ?',
    showQR: 'QR', qrSub: 'Valable 2 min', qrRefresh: 'Nouveau', expiresIn: 'Expire dans',
    noStaff: 'Aucun membre', search: 'Rechercher…',
    extraRoles: 'Tâches supplémentaires', showExtra: 'Afficher', hideExtra: 'Masquer',
    editPin: 'Modifier PIN', pinUpdated: 'PIN mis à jour',
    total: 'Total', active: 'En service',
  },
  en: {
    title: 'Staff', subtitle: 'Manage members and their access',
    addStaff: 'Add Member', name: 'Full name', role: 'Role', pin: 'PIN Code (4–8 digits)',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel',
    onDuty: 'On Duty', offDuty: 'Off Duty', since: 'since',
    hours: 'h', mins: 'min', tables: 'Tables', noTables: '—',
    deactivate: 'Deactivate', confirmDeactivate: 'Deactivate this member?',
    showQR: 'QR', qrSub: 'Valid 2 min', qrRefresh: 'Refresh', expiresIn: 'Expires in',
    noStaff: 'No staff members', search: 'Search…',
    extraRoles: 'Extra roles', showExtra: 'Show', hideExtra: 'Hide',
    editPin: 'Edit PIN', pinUpdated: 'PIN updated',
    total: 'Total', active: 'On Duty',
  },
  ar: {
    title: 'الكادر البشري', subtitle: 'إدارة الموظفين والأدوار',
    addStaff: 'إضافة موظف', name: 'الاسم الكامل', role: 'الدور', pin: 'الرمز السري (4–8 أرقام)',
    save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء',
    onDuty: 'في الخدمة', offDuty: 'خارج الخدمة', since: 'منذ',
    hours: 'س', mins: 'د', tables: 'الطاولات', noTables: '—',
    deactivate: 'تعطيل', confirmDeactivate: 'تأكيد تعطيل هذا الموظف؟',
    showQR: 'QR', qrSub: 'يصلح دقيقتين', qrRefresh: 'تجديد', expiresIn: 'ينتهي خلال',
    noStaff: 'لا يوجد موظفون', search: 'بحث…',
    extraRoles: 'مهام إضافية', showExtra: 'عرض', hideExtra: 'إخفاء',
    editPin: 'تعديل PIN', pinUpdated: 'تم تحديث الـ PIN',
    total: 'الإجمالي', active: 'حاضرون',
  },
  es: {
    title: 'Personal', subtitle: 'Gestionar miembros y sus accesos',
    addStaff: 'Añadir', name: 'Nombre completo', role: 'Rol', pin: 'PIN (4–8 dígitos)',
    save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar',
    onDuty: 'En turno', offDuty: 'Fuera de turno', since: 'desde',
    hours: 'h', mins: 'min', tables: 'Mesas', noTables: '—',
    deactivate: 'Desactivar', confirmDeactivate: '¿Desactivar este miembro?',
    showQR: 'QR', qrSub: 'Válido 2 min', qrRefresh: 'Renovar', expiresIn: 'Expira en',
    noStaff: 'Sin miembros', search: 'Buscar…',
    extraRoles: 'Tareas extra', showExtra: 'Mostrar', hideExtra: 'Ocultar',
    editPin: 'Editar PIN', pinUpdated: 'PIN actualizado',
    total: 'Total', active: 'En turno',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return tk ? { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

function elapsed(iso: string, t: typeof T['fr']) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}${t.mins}`
  return `${Math.floor(mins / 60)}${t.hours}${mins % 60}${t.mins}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [staff,    setStaff]   = useState<StaffMember[]>([])
  const [loading,  setLoading] = useState(true)
  const [search,   setSearch]  = useState('')
  const [roleFilter, setRoleFilter] = useState<PrimaryRole | 'ALL'>('ALL')

  // Add form
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<NewStaffForm>({ name: '', role: 'WAITER', roles: [], pinCode: '' })
  const [saving,    setSaving]    = useState(false)
  const [formErr,   setFormErr]   = useState('')
  const [showExtra, setShowExtra] = useState(false)

  // Inline PIN edit
  const [editingPin,  setEditingPin]  = useState<Record<string, string>>({})
  const [savingPin,   setSavingPin]   = useState<string | null>(null)
  const [pinSuccess,  setPinSuccess]  = useState<string | null>(null)

  // QR modal
  const [qrStaff,     setQrStaff]     = useState<StaffMember | null>(null)
  const [qrDataUrl,   setQrDataUrl]   = useState('')
  const [qrCountdown, setQrCountdown] = useState(0)
  const qrRefreshRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/admin/staff', { headers: authHeader() })
    if (!res.ok) return
    const data = await res.json()
    setStaff(data.waiters ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStaff()
    const p = setInterval(fetchStaff, 20_000)
    return () => clearInterval(p)
  }, [fetchStaff])

  // ── Add staff ──────────────────────────────────────────────────────────────
  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!form.name.trim())                  { setFormErr('Nom requis'); return }
    if (!/^\d{4,8}$/.test(form.pinCode))    { setFormErr('PIN: 4–8 chiffres'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST', headers: authHeader(), body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Erreur'); return }
      setShowForm(false)
      setForm({ name: '', role: 'WAITER', roles: [], pinCode: '' })
      setShowExtra(false)
      fetchStaff()
    } finally { setSaving(false) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deactivate(id: string) {
    if (!confirm(t.confirmDeactivate)) return
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE', headers: authHeader() })
    fetchStaff()
  }

  // ── PIN edit ───────────────────────────────────────────────────────────────
  async function savePin(id: string) {
    const pin = editingPin[id] ?? ''
    if (!/^\d{4,8}$/.test(pin)) return
    setSavingPin(id)
    try {
      const res = await fetch(`/api/admin/staff/${id}/pin`, {
        method: 'PATCH', headers: authHeader(), body: JSON.stringify({ pinCode: pin }),
      })
      if (res.ok) {
        setPinSuccess(id)
        setTimeout(() => setPinSuccess(null), 2000)
        setStaff(prev => prev.map(s => s.id === id ? { ...s, pinDisplay: pin } : s))
        setEditingPin(prev => { const n = { ...prev }; delete n[id]; return n })
        fetchStaff()
      }
    } finally { setSavingPin(null) }
  }

  // ── QR ────────────────────────────────────────────────────────────────────
  async function openQR(member: StaffMember) {
    setQrStaff(member); setQrDataUrl('')
    if (qrRefreshRef.current)   clearTimeout(qrRefreshRef.current)
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
    await refreshQR()
  }
  async function refreshQR() {
    try {
      const res  = await fetch('/api/admin/waiter-qr-token', { headers: authHeader() })
      if (!res.ok) return
      const data = await res.json() as { token: string; ttlSeconds: number }
      const url  = `${window.location.origin}/w/login?token=${data.token}`
      const img  = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      setQrDataUrl(img); setQrCountdown(data.ttlSeconds)
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
      qrCountdownRef.current = setInterval(() => setQrCountdown(p => p <= 1 ? 0 : p - 1), 1000)
      if (qrRefreshRef.current) clearTimeout(qrRefreshRef.current)
      qrRefreshRef.current = setTimeout(refreshQR, (data.ttlSeconds - 8) * 1000)
    } catch { /* silent */ }
  }
  function closeQR() {
    setQrStaff(null); setQrDataUrl('')
    if (qrRefreshRef.current)   clearTimeout(qrRefreshRef.current)
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
  }

  function toggleExtra(val: string) {
    setForm(f => ({ ...f, roles: f.roles.includes(val) ? f.roles.filter(r => r !== val) : [...f.roles, val] }))
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = staff
    .filter(s => roleFilter === 'ALL' || s.role === roleFilter)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    // Active first
    .sort((a, b) => (a.shiftStatus === 'ACTIVE' ? -1 : 1) - (b.shiftStatus === 'ACTIVE' ? -1 : 1))

  const activeCount = staff.filter(s => s.shiftStatus === 'ACTIVE').length
  const countdownPct = (qrCountdown / 120) * 100

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeCount} {t.active}
          </span>
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500">
            {staff.length} {t.total}
          </span>
          <button onClick={() => { setShowForm(v => !v); setFormErr('') }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> {t.addStaff}
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t.name}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t.name}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t.role}</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as PrimaryRole }))}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="WAITER">{ROLE_META.WAITER.label[lang]}</option>
                  <option value="CASHIER">{ROLE_META.CASHIER.label[lang]}</option>
                  <option value="SUPERVISOR">{ROLE_META.SUPERVISOR.label[lang]}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t.pin}</label>
                <input value={form.pinCode}
                  onChange={e => setForm(f => ({ ...f, pinCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="••••" type="password" inputMode="numeric" maxLength={8}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>

            {/* Extra roles — collapsed by default */}
            <div>
              <button type="button" onClick={() => setShowExtra(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                {showExtra ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {t.extraRoles} {form.roles.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{form.roles.length}</span>}
              </button>
              {showExtra && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {EXTRA_ROLES.map(r => {
                    const on = form.roles.includes(r.value)
                    return (
                      <button key={r.value} type="button" onClick={() => toggleExtra(r.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${on ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        {r.icon} {r[lang as 'fr' | 'en' | 'ar'] ?? r.en} {on && <span className="text-emerald-500">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {formErr && <p className="text-red-500 text-sm">{formErr}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors">
                {saving ? t.saving : t.save}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormErr(''); setShowExtra(false) }}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-8 pe-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        {/* Role filter pills */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['ALL', 'WAITER', 'CASHIER', 'SUPERVISOR'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleFilter === r ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {r === 'ALL' ? (lang === 'ar' ? 'الكل' : lang === 'fr' ? 'Tous' : 'All') : ROLE_META[r].label[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Staff table ── */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">{t.noStaff}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <div />
            <div>{t.name}</div>
            <div className="text-center">{t.tables}</div>
            <div className="text-center">PIN</div>
            <div />
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {filtered.map(member => {
              const rm      = ROLE_META[member.role] ?? ROLE_META.WAITER
              const isActive = member.shiftStatus === 'ACTIVE'
              const editPin  = editingPin[member.id]
              const isPinOk  = pinSuccess === member.id

              return (
                <div key={member.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 transition-colors ${isActive ? 'hover:bg-emerald-50/30' : 'hover:bg-slate-50'}`}>

                  {/* Avatar + status */}
                  <div className="relative">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>

                  {/* Name + role + status */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-800 truncate">{member.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rm.badge}`}>
                        {rm.label[lang]}
                      </span>
                      {member.roles.length > 0 && member.roles.map(r => {
                        const ex = EXTRA_ROLES.find(e => e.value === r)
                        return ex ? (
                          <span key={r} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {ex.icon} {ex[lang as 'fr'|'en'|'ar'] ?? ex.en}
                          </span>
                        ) : null
                      })}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isActive ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {isActive
                        ? `● ${t.onDuty}${member.clockInTime ? ` · ${t.since} ${elapsed(member.clockInTime, t)}` : ''}`
                        : `○ ${t.offDuty}`
                      }
                    </p>
                  </div>

                  {/* Tables */}
                  <div className="text-xs text-slate-400 text-center min-w-[60px]">
                    {member.assignedTables.length > 0
                      ? member.assignedTables.map(tb => `#${tb.tableNumber}`).join(' ')
                      : <span className="text-slate-200">—</span>
                    }
                  </div>

                  {/* PIN inline edit */}
                  <div className="flex items-center gap-1.5 min-w-[110px] justify-center">
                    {editPin !== undefined ? (
                      <>
                        <input
                          type="password" inputMode="numeric" maxLength={8}
                          value={editPin}
                          onChange={e => setEditingPin(p => ({ ...p, [member.id]: e.target.value.replace(/\D/g,'').slice(0,8) }))}
                          className="w-20 px-2 py-1 text-center text-sm font-mono border border-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          placeholder="••••"
                          autoFocus
                        />
                        <button onClick={() => savePin(member.id)} disabled={savingPin === member.id}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingPin(p => { const n={...p}; delete n[member.id]; return n })}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : isPinOk ? (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {t.pinUpdated}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm text-slate-300 tracking-widest">
                          {member.pinDisplay ? '•'.repeat(member.pinDisplay.length) : '—'}
                        </span>
                        <button onClick={() => setEditingPin(p => ({ ...p, [member.id]: '' }))}
                          className="p-1 text-slate-300 hover:text-slate-600 transition-colors" title={t.editPin}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => openQR(member)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors" title={t.showQR}>
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => deactivate(member.id)}
                      className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors" title={t.deactivate}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {qrStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeQR}>
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${qrStaff.shiftStatus === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <h3 className="font-bold text-slate-800">{qrStaff.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${ROLE_META[qrStaff.role]?.badge}`}>
                {ROLE_META[qrStaff.role]?.label[lang]}
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center mb-4">{t.qrSub}</p>

            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl overflow-hidden bg-white p-2 shadow-inner border border-slate-100">
                  <img src={qrDataUrl} alt="QR" width={200} height={200} />
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{t.expiresIn}</span>
                    <span className={`font-bold ${qrCountdown < 30 ? 'text-red-500' : 'text-slate-600'}`}>{qrCountdown}s</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${countdownPct > 50 ? 'bg-emerald-500' : countdownPct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${countdownPct}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={refreshQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
                <RefreshCw className="w-4 h-4" /> {t.qrRefresh}
              </button>
              <button onClick={closeQR}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
