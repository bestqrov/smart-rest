'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Users, ChefHat, Wrench, Plus, Trash2, QrCode, Clock, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  role: 'WAITER' | 'CASHIER' | 'SUPERVISOR'
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  isActive: boolean
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}

interface NewStaffForm {
  name: string
  role: 'WAITER' | 'CASHIER' | 'SUPERVISOR'
  pinCode: string
}

type Tab = 'waiters' | 'chefs' | 'other'

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'إدارة الكادر البشري',
    tabs: { waiters: 'النوادل', chefs: 'الطباخون', other: 'العمال الآخرون' },
    addStaff: 'إضافة عضو جديد',
    name: 'الاسم الكامل',
    role: 'الدور',
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
    noStaff: 'لا يوجد أعضاء في هذا القسم',
    roles: { WAITER: 'نادل', CASHIER: 'كاشير', SUPERVISOR: 'مشرف' },
    qrTitle: 'رمز QR لتسجيل الدخول',
    qrSub: 'يصلح دقيقتين — مسح مرة واحدة فقط',
    qrRefresh: 'تجديد الرمز',
    expiresIn: 'ينتهي خلال',
    totalOnDuty: 'حاضرون الآن',
    totalStaff: 'إجمالي الكادر',
    hours: 'ساعة',
    mins: 'د',
  },
  fr: {
    title: 'Gestion du Personnel',
    tabs: { waiters: 'Serveurs', chefs: 'Cuisiniers', other: 'Autre personnel' },
    addStaff: 'Ajouter un membre',
    name: 'Nom complet',
    role: 'Rôle',
    pin: 'Code PIN (4 chiffres)',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    onDuty: 'En service',
    offDuty: 'Hors service',
    tables: 'Tables',
    since: 'depuis',
    showQR: 'Afficher QR',
    deactivate: 'Désactiver',
    noStaff: 'Aucun membre dans cette section',
    roles: { WAITER: 'Serveur', CASHIER: 'Caissier', SUPERVISOR: 'Superviseur' },
    qrTitle: 'QR Code de connexion',
    qrSub: 'Valable 2 min — usage unique',
    qrRefresh: 'Nouveau code',
    expiresIn: 'Expire dans',
    totalOnDuty: 'En service',
    totalStaff: 'Total',
    hours: 'h',
    mins: 'min',
  },
  en: {
    title: 'Staff Management',
    tabs: { waiters: 'Waiters', chefs: 'Chefs', other: 'Other Staff' },
    addStaff: 'Add Member',
    name: 'Full name',
    role: 'Role',
    pin: 'PIN Code (4 digits)',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    onDuty: 'On Duty',
    offDuty: 'Off Duty',
    tables: 'Tables',
    since: 'since',
    showQR: 'Show QR',
    deactivate: 'Deactivate',
    noStaff: 'No members in this section',
    roles: { WAITER: 'Waiter', CASHIER: 'Cashier', SUPERVISOR: 'Supervisor' },
    qrTitle: 'Login QR Code',
    qrSub: 'Valid 2 min — single use',
    qrRefresh: 'Refresh Code',
    expiresIn: 'Expires in',
    totalOnDuty: 'On Duty',
    totalStaff: 'Total Staff',
    hours: 'h',
    mins: 'min',
  },
  es: {
    title: 'Gestión del Personal',
    tabs: { waiters: 'Camareros', chefs: 'Cocineros', other: 'Otro personal' },
    addStaff: 'Añadir miembro',
    name: 'Nombre completo',
    role: 'Rol',
    pin: 'Código PIN (4 dígitos)',
    save: 'Guardar',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    onDuty: 'En turno',
    offDuty: 'Fuera de turno',
    tables: 'Mesas',
    since: 'desde',
    showQR: 'Ver QR',
    deactivate: 'Desactivar',
    noStaff: 'Sin miembros en esta sección',
    roles: { WAITER: 'Camarero', CASHIER: 'Cajero', SUPERVISOR: 'Supervisor' },
    qrTitle: 'Código QR de inicio de sesión',
    qrSub: 'Válido 2 min — uso único',
    qrRefresh: 'Nuevo código',
    expiresIn: 'Expira en',
    totalOnDuty: 'En turno',
    totalStaff: 'Total',
    hours: 'h',
    mins: 'min',
  },
}
type Lang = keyof typeof T

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

// Tab → roles filter
const TAB_ROLES: Record<Tab, StaffMember['role'][]> = {
  waiters: ['WAITER', 'SUPERVISOR'],
  chefs:   ['CASHIER'],               // TODO: add CHEF role when schema supports it
  other:   [],                         // shows all remaining
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const [lang, setLang] = useState<Lang>('ar')
  const isRTL = lang === 'ar'
  const t = T[lang]

  const [tab, setTab]     = useState<Tab>('waiters')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]   = useState<NewStaffForm>({ name: '', role: 'WAITER', pinCode: '' })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  // QR modal state
  const [qrStaff, setQrStaff]       = useState<StaffMember | null>(null)
  const [qrDataUrl, setQrDataUrl]   = useState('')
  const [qrCountdown, setQrCountdown] = useState(0)
  const qrRefreshRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch staff ─────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/pos/waiters/status', { headers: authHeader() })
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

  // ── Tab filter ───────────────────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    if (tab === 'waiters') return s.role === 'WAITER' || s.role === 'SUPERVISOR'
    if (tab === 'chefs')   return s.role === 'CASHIER'
    return false  // "other" reserved for future non-POS roles
  })

  const activeCount = filtered.filter(s => s.shiftStatus === 'ACTIVE').length

  // ── Add staff ────────────────────────────────────────────────────────────────
  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!form.name.trim()) { setFormErr('Name required'); return }
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
      setForm({ name: '', role: 'WAITER', pinCode: '' })
      fetchStaff()
    } finally {
      setSaving(false)
    }
  }

  // ── Generate QR for staff ─────────────────────────────────────────────────
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
      const img  = await QRCode.toDataURL(url, { width: 260, margin: 2, color: { dark: '#0f172a', light: '#f8fafc' } })
      setQrDataUrl(img)
      setQrCountdown(data.ttlSeconds)

      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
      qrCountdownRef.current = setInterval(() => {
        setQrCountdown(p => { if (p <= 1) { clearInterval(qrCountdownRef.current!); return 0 } return p - 1 })
      }, 1000)

      if (qrRefreshRef.current) clearTimeout(qrRefreshRef.current)
      qrRefreshRef.current = setTimeout(refreshQR, (data.ttlSeconds - 8) * 1000)
    } catch { /* silently fail */ }
  }

  function closeQR() {
    setQrStaff(null)
    setQrDataUrl('')
    if (qrRefreshRef.current)   clearTimeout(qrRefreshRef.current)
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
  }

  const countdownPct = qrCountdown / 120 * 100

  // ── Tab icon ─────────────────────────────────────────────────────────────────
  const TAB_ICON: Record<Tab, React.ElementType> = { waiters: Users, chefs: ChefHat, other: Wrench }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t.totalOnDuty}: <strong className="text-green-600">{staff.filter(s => s.shiftStatus === 'ACTIVE').length}</strong>
            &nbsp;/&nbsp;
            {t.totalStaff}: <strong>{staff.length}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Lang switcher */}
          {(Object.keys(T) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {l.toUpperCase()}
            </button>
          ))}
          <button onClick={() => { setShowForm(true); setFormErr('') }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> {t.addStaff}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 w-fit">
        {(['waiters', 'chefs', 'other'] as Tab[]).map(tp => {
          const Icon = TAB_ICON[tp]
          return (
            <button key={tp} onClick={() => setTab(tp)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === tp ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="w-4 h-4" /> {t.tabs[tp]}
            </button>
          )
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">{t.addStaff}</h3>
          <form onSubmit={handleAddStaff} className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.name}</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder={t.name}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.role}</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as StaffMember['role']}))}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                <option value="WAITER">{t.roles.WAITER}</option>
                <option value="CASHIER">{t.roles.CASHIER}</option>
                <option value="SUPERVISOR">{t.roles.SUPERVISOR}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.pin}</label>
              <input value={form.pinCode} onChange={e => setForm(f => ({...f, pinCode: e.target.value.replace(/\D/g,'').slice(0,4)}))}
                placeholder="••••" type="password" inputMode="numeric" maxLength={4}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            {formErr && <p className="sm:col-span-3 text-red-500 text-sm">{formErr}</p>}
            <div className="sm:col-span-3 flex gap-2">
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

      {/* Staff list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <div className="text-4xl mb-2">👤</div>
            {t.noStaff}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(member => (
              <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    member.shiftStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
                  }`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white truncate">{member.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        member.role === 'SUPERVISOR' ? 'bg-purple-100 text-purple-700'
                        : member.role === 'CASHIER' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>{t.roles[member.role]}</span>
                      <span className={`text-xs font-medium ${
                        member.shiftStatus === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'
                      }`}>
                        {member.shiftStatus === 'ACTIVE' ? t.onDuty : t.offDuty}
                        {member.clockInTime && ` · ${t.since} ${elapsed(member.clockInTime, t)}`}
                      </span>
                      {member.assignedTables.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {t.tables}: {member.assignedTables.map(tb => `#${tb.tableNumber}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openQR(member)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-medium transition-colors">
                    <QrCode className="w-3.5 h-3.5" /> {t.showQR}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeQR}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 dark:text-white text-center mb-0.5">{qrStaff.name}</h3>
            <p className="text-xs text-slate-400 text-center mb-4">{t.qrSub}</p>

            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl overflow-hidden ring-4 ring-amber-400/30 shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR Login" width={220} height={220} />
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{t.expiresIn}</span>
                    <span className={qrCountdown < 30 ? 'text-red-500 font-bold' : 'font-medium text-slate-600 dark:text-slate-300'}>
                      {qrCountdown}s
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
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
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
