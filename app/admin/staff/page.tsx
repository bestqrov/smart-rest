'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Users, ChefHat, Plus, QrCode, Clock,
  RefreshCw, Bell, Trash2, Coffee, Utensils, Brush, Waves, PersonStanding,
  CheckCircle, AlertCircle
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

type Tab = 'all' | 'waiters' | 'kitchen' | 'other'
type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── Extra role definitions ────────────────────────────────────────────────────

const EXTRA_ROLES: { value: string; ar: string; fr: string; en: string; es: string; icon: string }[] = [
  // ── Cuisine / Kitchen ─────────────────────────────────────────────────────
  { value: 'HEAD_CHEF',    ar: 'رئيس الطهاة',     fr: 'Chef cuisinier',    en: 'Head Chef',      es: 'Chef principal',  icon: '👨‍🍳' },
  { value: 'SOUS_CHEF',    ar: 'نائب الطاهي',     fr: 'Sous-chef',         en: 'Sous Chef',      es: 'Subcochero',      icon: '🍳' },
  { value: 'COOK',         ar: 'طباخ',             fr: 'Cuisinier',         en: 'Cook',           es: 'Cocinero',        icon: '🥘' },
  { value: 'COMMIS',       ar: 'مساعد طباخ',      fr: 'Commis de cuisine', en: 'Commis Cook',    es: 'Commis',          icon: '🫕' },
  { value: 'PASTRY',       ar: 'حلواني',           fr: 'Pâtissier',         en: 'Pastry Chef',    es: 'Pastelero',       icon: '🧁' },
  { value: 'DISHWASHER',   ar: 'غسيل أواني',      fr: 'Plongeur',          en: 'Dishwasher',     es: 'Fregador',        icon: '🍽️' },
  // ── Salle / Floor ─────────────────────────────────────────────────────────
  { value: 'BARISTA',      ar: 'باريستا',          fr: 'Barista',           en: 'Barista',        es: 'Barista',         icon: '☕' },
  { value: 'BARTENDER',    ar: 'نادل بار',         fr: 'Barman',            en: 'Bartender',      es: 'Bartender',       icon: '🍹' },
  { value: 'RUNNER',       ar: 'رانر',             fr: 'Runner',            en: 'Runner',         es: 'Runner',          icon: '🏃' },
  { value: 'HOST',         ar: 'موظف استقبال',     fr: 'Hôte / Hôtesse',    en: 'Host / Hostess', es: 'Anfitrión',       icon: '🤝' },
  { value: 'SOMMELIER',    ar: 'سومولييه',         fr: 'Sommelier',         en: 'Sommelier',      es: 'Sumiller',        icon: '🍷' },
  // ── Livraison & Sécurité ──────────────────────────────────────────────────
  { value: 'DELIVERY',     ar: 'عامل توصيل',      fr: 'Livreur',           en: 'Delivery',       es: 'Repartidor',      icon: '🛵' },
  { value: 'SECURITY',     ar: 'حارس أمن',         fr: 'Agent de sécurité', en: 'Security',       es: 'Seguridad',       icon: '🛡️' },
  // ── Entretien ─────────────────────────────────────────────────────────────
  { value: 'CLEANER',      ar: 'نظافة',            fr: "Agent d'entretien", en: 'Cleaner',        es: 'Limpieza',        icon: '🧹' },
  // ── Hôtel ─────────────────────────────────────────────────────────────────
  { value: 'RECEPTIONIST', ar: 'موظف استقبال فندق', fr: 'Réceptionniste',   en: 'Receptionist',   es: 'Recepcionista',   icon: '🏨' },
  { value: 'HOUSEKEEPING', ar: 'تنظيف غرف',        fr: 'Femme de chambre',  en: 'Housekeeping',   es: 'Mucama',          icon: '🛏️' },
  { value: 'PORTER',       ar: 'حمّال أمتعة',      fr: 'Bagagiste',         en: 'Porter',         es: 'Maletero',        icon: '🧳' },
  { value: 'ROOM_SERVICE', ar: 'خدمة الغرف',       fr: 'Room service',      en: 'Room Service',   es: 'Servicio cuarto', icon: '🍱' },
  { value: 'CONCIERGE',    ar: 'كونسيرج',          fr: 'Concierge',         en: 'Concierge',      es: 'Conserje',        icon: '🗝️' },
]

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'إدارة الكادر البشري',
    subtitle: 'مراقبة الحضور والمهام في الوقت الفعلي',
    tabs: { all: 'الكل', waiters: 'النوادل', kitchen: 'المطبخ / البار', other: 'آخرون' },
    addStaff: 'إضافة موظف',
    name: 'الاسم الكامل',
    primaryRole: 'الدور الأساسي',
    extraRoles: 'المهام الإضافية (اختياري)',
    pin: 'الرمز السري (4 أرقام)',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    onDuty: 'في الخدمة',
    offDuty: 'خارج الخدمة',
    tables: 'الطاولات',
    since: 'منذ',
    showQR: 'عرض QR',
    deactivate: 'تعطيل',
    noStaff: 'لا يوجد موظفون في هذا القسم',
    roles: { WAITER: 'نادل', CASHIER: 'كاشير', SUPERVISOR: 'مشرف' },
    qrSub: 'يصلح دقيقتين — مسح مرة واحدة فقط',
    qrRefresh: 'تجديد',
    expiresIn: 'ينتهي خلال',
    totalOnDuty: 'حاضرون',
    totalStaff: 'إجمالي',
    hours: 'ساعة', mins: 'د',
    pendingAlert: 'طلب معلق',
    confirmDeactivate: 'تأكيد تعطيل هذا الموظف؟',
    zoneTables: 'الطاولات المخصصة',
    noTablesAssigned: 'لا طاولات مخصصة',
  },
  fr: {
    title: 'Gestion du Personnel',
    subtitle: 'Surveillance en temps réel des présences et rôles',
    tabs: { all: 'Tous', waiters: 'Serveurs', kitchen: 'Cuisine / Bar', other: 'Autres' },
    addStaff: 'Ajouter un membre',
    name: 'Nom complet',
    primaryRole: 'Rôle principal',
    extraRoles: 'Tâches supplémentaires (optionnel)',
    pin: 'Code PIN (4 chiffres)',
    save: 'Enregistrer', saving: 'Enregistrement…',
    cancel: 'Annuler',
    onDuty: 'En service', offDuty: 'Hors service',
    tables: 'Tables', since: 'depuis',
    showQR: 'Voir QR', deactivate: 'Désactiver',
    noStaff: 'Aucun membre dans cette section',
    roles: { WAITER: 'Serveur', CASHIER: 'Caissier', SUPERVISOR: 'Superviseur' },
    qrSub: 'Valable 2 min — usage unique', qrRefresh: 'Nouveau code',
    expiresIn: 'Expire dans',
    totalOnDuty: 'En service', totalStaff: 'Total',
    hours: 'h', mins: 'min',
    pendingAlert: 'alerte en attente',
    confirmDeactivate: 'Confirmer la désactivation ?',
    zoneTables: 'Tables assignées',
    noTablesAssigned: 'Aucune table assignée',
  },
  en: {
    title: 'Staff Management',
    subtitle: 'Real-time attendance & task monitoring',
    tabs: { all: 'All', waiters: 'Waiters', kitchen: 'Kitchen / Bar', other: 'Others' },
    addStaff: 'Add Member',
    name: 'Full name',
    primaryRole: 'Primary Role',
    extraRoles: 'Extra Roles (optional)',
    pin: 'PIN Code (4 digits)',
    save: 'Save', saving: 'Saving…',
    cancel: 'Cancel',
    onDuty: 'On Duty', offDuty: 'Off Duty',
    tables: 'Tables', since: 'since',
    showQR: 'Show QR', deactivate: 'Deactivate',
    noStaff: 'No members in this section',
    roles: { WAITER: 'Waiter', CASHIER: 'Cashier', SUPERVISOR: 'Supervisor' },
    qrSub: 'Valid 2 min — single use', qrRefresh: 'Refresh',
    expiresIn: 'Expires in',
    totalOnDuty: 'On Duty', totalStaff: 'Total Staff',
    hours: 'h', mins: 'min',
    pendingAlert: 'pending alert',
    confirmDeactivate: 'Confirm deactivation?',
    zoneTables: 'Assigned tables',
    noTablesAssigned: 'No tables assigned',
  },
  es: {
    title: 'Gestión del Personal',
    subtitle: 'Monitoreo en tiempo real de asistencia y tareas',
    tabs: { all: 'Todos', waiters: 'Camareros', kitchen: 'Cocina / Bar', other: 'Otros' },
    addStaff: 'Añadir miembro',
    name: 'Nombre completo',
    primaryRole: 'Rol principal',
    extraRoles: 'Tareas adicionales (opcional)',
    pin: 'Código PIN (4 dígitos)',
    save: 'Guardar', saving: 'Guardando…',
    cancel: 'Cancelar',
    onDuty: 'En turno', offDuty: 'Fuera de turno',
    tables: 'Mesas', since: 'desde',
    showQR: 'Ver QR', deactivate: 'Desactivar',
    noStaff: 'Sin miembros en esta sección',
    roles: { WAITER: 'Camarero', CASHIER: 'Cajero', SUPERVISOR: 'Supervisor' },
    qrSub: 'Válido 2 min — uso único', qrRefresh: 'Renovar',
    expiresIn: 'Expira en',
    totalOnDuty: 'En turno', totalStaff: 'Total',
    hours: 'h', mins: 'min',
    pendingAlert: 'alerta pendiente',
    confirmDeactivate: '¿Confirmar desactivación?',
    zoneTables: 'Mesas asignadas',
    noTablesAssigned: 'Sin mesas asignadas',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return tk ? { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

function elapsed(iso: string, t: typeof T['en']) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} ${t.mins}`
  return `${Math.floor(mins / 60)}${t.hours} ${mins % 60}${t.mins}`
}

function roleLabel(r: string, lang: Lang): string {
  const extra = EXTRA_ROLES.find(e => e.value === r)
  if (extra) return `${extra.icon} ${extra[lang] ?? extra.en}`
  if (r === 'WAITER')     return T[lang].roles.WAITER
  if (r === 'CASHIER')    return T[lang].roles.CASHIER
  if (r === 'SUPERVISOR') return T[lang].roles.SUPERVISOR
  return r
}

// ── Tab filter ────────────────────────────────────────────────────────────────

function tabFilter(members: StaffMember[], tab: Tab) {
  if (tab === 'all')     return members
  if (tab === 'waiters') return members.filter(s => s.role === 'WAITER' || s.role === 'SUPERVISOR')
  if (tab === 'kitchen') return members.filter(s =>
    s.role === 'CASHIER' ||
    s.roles.some(r => ['COOK','BARISTA','DISHWASHER'].includes(r))
  )
  // 'other' = cleaners / runners
  return members.filter(s =>
    s.roles.some(r => ['CLEANER','RUNNER'].includes(r)) ||
    (s.role !== 'WAITER' && s.role !== 'SUPERVISOR' && s.role !== 'CASHIER')
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [tab,    setTab]    = useState<Tab>('all')
  const [staff,  setStaff]  = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,   setForm]   = useState<NewStaffForm>({ name: '', role: 'WAITER', roles: [], pinCode: '' })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

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
    if (!form.name.trim())            { setFormErr('Name required'); return }
    if (!/^\d{4}$/.test(form.pinCode)) { setFormErr('PIN must be exactly 4 digits'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Failed'); return }
      setShowForm(false)
      setForm({ name: '', role: 'WAITER', roles: [], pinCode: '' })
      fetchStaff()
    } finally { setSaving(false) }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────
  async function deactivate(id: string) {
    if (!confirm(t.confirmDeactivate)) return
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE', headers: authHeader() })
    fetchStaff()
  }

  // ── QR helpers ─────────────────────────────────────────────────────────────
  async function openQR(member: StaffMember) {
    setQrStaff(member)
    setQrDataUrl('')
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
      const img  = await QRCode.toDataURL(url, {
        width: 260, margin: 2,
        color: { dark: '#0f172a', light: '#f0fdf4' }
      })
      setQrDataUrl(img)
      setQrCountdown(data.ttlSeconds)
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
      qrCountdownRef.current = setInterval(() => {
        setQrCountdown(p => { if (p <= 1) { clearInterval(qrCountdownRef.current!); return 0 } return p - 1 })
      }, 1000)
      if (qrRefreshRef.current) clearTimeout(qrRefreshRef.current)
      qrRefreshRef.current = setTimeout(refreshQR, (data.ttlSeconds - 8) * 1000)
    } catch { /* silent */ }
  }

  function closeQR() {
    setQrStaff(null); setQrDataUrl('')
    if (qrRefreshRef.current)   clearTimeout(qrRefreshRef.current)
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
  }

  const countdownPct = (qrCountdown / 120) * 100
  const filtered     = tabFilter(staff, tab)
  const activeCount  = staff.filter(s => s.shiftStatus === 'ACTIVE').length

  // ── Extra role toggle ──────────────────────────────────────────────────────
  function toggleExtraRole(val: string) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(val) ? f.roles.filter(r => r !== val) : [...f.roles, val]
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t.subtitle} ·&nbsp;
            <span className="text-green-600 font-semibold">{activeCount} {t.totalOnDuty}</span>
            &nbsp;/&nbsp;
            <span className="font-semibold">{staff.length} {t.totalStaff}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(true); setFormErr('') }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> {t.addStaff}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-fit flex-wrap">
        {(['all','waiters','kitchen','other'] as Tab[]).map(tp => (
          <button key={tp} onClick={() => setTab(tp)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === tp ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.tabs[tp]}
          </button>
        ))}
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow">
          <h3 className="font-semibold text-slate-700 mb-4">{t.addStaff}</h3>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.name}</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder={t.name}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.primaryRole}</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as PrimaryRole}))}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  <option value="WAITER">{t.roles.WAITER}</option>
                  <option value="CASHIER">{t.roles.CASHIER}</option>
                  <option value="SUPERVISOR">{t.roles.SUPERVISOR}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.pin}</label>
                <input value={form.pinCode}
                  onChange={e => setForm(f => ({...f, pinCode: e.target.value.replace(/\D/g,'').slice(0,4)}))}
                  placeholder="••••" type="password" inputMode="numeric" maxLength={4}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>

            {/* Multi-role chips */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">{t.extraRoles}</label>
              <div className="flex flex-wrap gap-2">
                {EXTRA_ROLES.map(r => {
                  const active = form.roles.includes(r.value)
                  return (
                    <button key={r.value} type="button" onClick={() => toggleExtraRole(r.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                        active
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      }`}>
                      <span>{r.icon}</span>
                      <span>{r[lang] ?? r.en}</span>
                      {active && <span className="text-emerald-500">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {formErr && <p className="text-red-500 text-sm">{formErr}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors">
                {saving ? t.saving : t.save}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormErr('') }}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Staff cards grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-sm">{t.noStaff}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => (
            <WaiterCard
              key={member.id}
              member={member}
              lang={lang}
              t={t}
              onQR={() => openQR(member)}
              onDeactivate={() => deactivate(member.id)}
              elapsed={elapsed}
              roleLabel={roleLabel}
            />
          ))}
        </div>
      )}

      {/* ── QR Modal ── */}
      {qrStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeQR}>
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full shrink-0 ${qrStaff.shiftStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <h3 className="font-bold text-slate-800">{qrStaff.name}</h3>
            </div>
            <p className="text-xs text-slate-400 text-center mb-4">{t.qrSub}</p>

            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl overflow-hidden ring-4 ring-amber-400/30 shadow">
                  <img src={qrDataUrl} alt="QR Login" width={220} height={220} />
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{t.expiresIn}</span>
                    <span className={qrCountdown < 30 ? 'text-red-500 font-bold' : 'font-medium text-slate-600'}>
                      {qrCountdown}s
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${
                      countdownPct > 50 ? 'bg-green-500' : countdownPct > 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ width: `${countdownPct}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={refreshQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
                <RefreshCw className="w-4 h-4" /> {t.qrRefresh}
              </button>
              <button onClick={closeQR}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-colors">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WaiterCard — visual monitoring card
// ─────────────────────────────────────────────────────────────────────────────

function WaiterCard({
  member, lang, t, onQR, onDeactivate, elapsed, roleLabel,
}: {
  member:      StaffMember
  lang:        Lang
  t:           typeof T['en']
  onQR:        () => void
  onDeactivate: () => void
  elapsed:     (iso: string, t: typeof T['en']) => string
  roleLabel:   (r: string, lang: Lang) => string
}) {
  const isActive = member.shiftStatus === 'ACTIVE'
  const hasPending = member.pendingAlerts > 0

  return (
    <div className={`relative rounded-2xl p-4 border-2 transition-all shadow-sm ${
      isActive
        ? 'bg-white border-emerald-400 shadow-emerald-100'
        : 'bg-slate-50 border-slate-200 opacity-80'
    }`}>

      {/* ── Pending alert bell (flashing red) ── */}
      {hasPending && (
        <div className="absolute top-3 end-3 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow">
          <Bell className="w-3 h-3" />
          {member.pendingAlerts}
        </div>
      )}

      {/* ── Status header ── */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar circle */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${
          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
        }`}>
          {member.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-800 truncate">{member.name}</p>
            {/* Active dot */}
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
            }`} />
          </div>
          {/* Status text */}
          <p className={`text-xs font-semibold mt-0.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
            {isActive ? (
              <>🟢 {t.onDuty} · {t.since} {elapsed(member.clockInTime!, t)}</>
            ) : (
              <>🔴 {t.offDuty}</>
            )}
          </p>
        </div>
      </div>

      {/* ── Roles ── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {/* Primary role */}
        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
          member.role === 'SUPERVISOR' ? 'bg-purple-50 text-purple-700 border-purple-200'
          : member.role === 'CASHIER'  ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {t.roles[member.role]}
        </span>

        {/* Extra role chips */}
        {member.roles.map(r => (
          <span key={r} className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {roleLabel(r, lang)}
          </span>
        ))}
      </div>

      {/* ── Assigned tables ── */}
      <div className="text-xs text-slate-500 mb-3">
        {member.assignedTables.length > 0 ? (
          <span>🪑 {t.zoneTables}: {member.assignedTables.map(tb => `#${tb.tableNumber}`).join(', ')}</span>
        ) : (
          <span className="text-slate-300">{t.noTablesAssigned}</span>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button onClick={onQR}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-xl text-xs font-semibold text-slate-600 transition-colors">
          <QrCode className="w-3.5 h-3.5" /> {t.showQR}
        </button>
        <button onClick={onDeactivate}
          className="flex items-center justify-center gap-1 p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-400 transition-colors"
          title={t.deactivate}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
