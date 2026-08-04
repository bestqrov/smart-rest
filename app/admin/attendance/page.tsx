'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  RefreshCw, CalendarClock, Clock,
  ChevronLeft, ChevronRight, Download, TableProperties, Users, Zap,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PointageStaff {
  id:        string
  name:      string
  role:      string
  days:      Record<number, { in: string; out: string | null }>
  totalDays: number
}
interface PointageData {
  year: number; month: number; daysInMonth: number; staff: PointageStaff[]
}
interface StaffMember {
  id:             string
  name:           string
  role:           'WAITER' | 'CASHIER' | 'SUPERVISOR'
  roles:          string[]
  shiftStatus:    'ACTIVE' | 'OFF_DUTY'
  clockInTime:    string | null
  isActive:       boolean
  pendingAlerts:  number
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}
type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الحضور اللحظي', subtitle: 'من في الخدمة الآن', pointageTitle: 'جدول الحضور الشهري',
    total: 'الإجمالي', active: 'في الخدمة', offline: 'خارج الخدمة',
    roles: { WAITER: 'نادل', CASHIER: 'كاشير', SUPERVISOR: 'مشرف' },
    showPin: 'عرض PIN', hidePin: 'إخفاء', pinLabel: 'PIN', pinNotSet: 'غير محدد',
    onDuty: 'في الخدمة', offDuty: 'خارج الخدمة', since: 'منذ', hours: 'س', mins: 'د',
    qrSub: 'امسح بالهاتف · ثم أدخل PIN',
    qrRefresh: 'تجديد', expiresIn: 'ينتهي خلال', scanToLogin: 'QR دخول الكادر',
    noActive: 'لا أحد في الخدمة حالياً', offDutySection: 'خارج الشيفت',
    tables: 'طاولات', noTables: 'لا طاولات',
  },
  fr: {
    title: 'Présence en direct', subtitle: 'Qui est en service maintenant', pointageTitle: 'Pointage mensuel',
    total: 'Total', active: 'En service', offline: 'Hors service',
    roles: { WAITER: 'Serveur', CASHIER: 'Caissier', SUPERVISOR: 'Superviseur' },
    showPin: 'Voir PIN', hidePin: 'Masquer', pinLabel: 'PIN', pinNotSet: 'Non défini',
    onDuty: 'En service', offDuty: 'Hors service', since: 'depuis', hours: 'h', mins: 'min',
    qrSub: 'Scanner avec le téléphone · puis saisir PIN',
    qrRefresh: 'Nouveau QR', expiresIn: 'Expire dans', scanToLogin: 'QR de connexion staff',
    noActive: 'Personne en service pour le moment', offDutySection: 'Hors service',
    tables: 'Tables', noTables: 'Aucune table',
  },
  en: {
    title: 'Live Attendance', subtitle: "Who's on duty right now", pointageTitle: 'Monthly Grid',
    total: 'Total', active: 'On Duty', offline: 'Off Duty',
    roles: { WAITER: 'Waiter', CASHIER: 'Cashier', SUPERVISOR: 'Supervisor' },
    showPin: 'Show PIN', hidePin: 'Hide', pinLabel: 'PIN', pinNotSet: 'Not set',
    onDuty: 'On Duty', offDuty: 'Off Duty', since: 'since', hours: 'h', mins: 'min',
    qrSub: 'Scan with phone · then enter PIN',
    qrRefresh: 'Refresh QR', expiresIn: 'Expires in', scanToLogin: 'Staff Login QR',
    noActive: 'No one on duty right now', offDutySection: 'Off duty',
    tables: 'Tables', noTables: 'No tables',
  },
  es: {
    title: 'Asistencia en vivo', subtitle: 'Quién está en turno ahora', pointageTitle: 'Cuadro mensual',
    total: 'Total', active: 'En turno', offline: 'Fuera de turno',
    roles: { WAITER: 'Camarero', CASHIER: 'Cajero', SUPERVISOR: 'Supervisor' },
    showPin: 'Ver PIN', hidePin: 'Ocultar', pinLabel: 'PIN', pinNotSet: 'No definido',
    onDuty: 'En turno', offDuty: 'Fuera de turno', since: 'desde', hours: 'h', mins: 'min',
    qrSub: 'Escanear con teléfono · luego PIN',
    qrRefresh: 'Nuevo QR', expiresIn: 'Expira en', scanToLogin: 'QR acceso staff',
    noActive: 'Nadie en turno ahora', offDutySection: 'Fuera de turno',
    tables: 'Mesas', noTables: 'Sin mesas',
  },
}

const ROLE_STYLE: Record<string, { bg: string; badge: string; label: Record<Lang, string> }> = {
  SUPERVISOR: { bg: 'from-violet-500 to-violet-700', badge: 'bg-violet-100 text-violet-700', label: { ar: 'مشرف', fr: 'Superviseur', en: 'Supervisor', es: 'Supervisor' } },
  CASHIER:    { bg: 'from-sky-500 to-sky-700',    badge: 'bg-sky-100 text-sky-700',    label: { ar: 'كاشير',  fr: 'Caissier',    en: 'Cashier',    es: 'Cajero'      } },
  WAITER:     { bg: 'from-emerald-500 to-emerald-700', badge: 'bg-emerald-100 text-emerald-700', label: { ar: 'نادل', fr: 'Serveur', en: 'Waiter', es: 'Camarero' } },
}

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return tk ? { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

function elapsed(iso: string, t: typeof T['en']) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} ${t.mins}`
  return `${Math.floor(mins / 60)}${t.hours} ${mins % 60}${t.mins}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [staff,   setStaff]   = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'cards' | 'pointage'>('cards')

  // ── Pointage ───────────────────────────────────────────────────────────────
  const [pointage,      setPointage]      = useState<PointageData | null>(null)
  const [pointageMonth, setPointageMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [pointageLoading, setPointageLoading] = useState(false)

  const fetchPointage = useCallback(async (month: string) => {
    setPointageLoading(true)
    try {
      const res = await fetch(`/api/admin/attendance/pointage?month=${month}`, { headers: authHeader() })
      if (res.ok) setPointage(await res.json())
    } finally { setPointageLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === 'pointage') fetchPointage(pointageMonth)
  }, [activeTab, pointageMonth, fetchPointage])

  function shiftMonth(dir: -1 | 1) {
    const [y, m] = pointageMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    setPointageMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── QR ────────────────────────────────────────────────────────────────────
  const [qrDataUrl,   setQrDataUrl]   = useState('')
  const [qrCountdown, setQrCountdown] = useState(0)
  const [qrLoading,   setQrLoading]   = useState(false)
  const qrRefreshRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)


  // ── Fetch staff ────────────────────────────────────────────────────────────
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

  const refreshQR = useCallback(async () => {
    setQrLoading(true)
    try {
      const res  = await fetch('/api/admin/waiter-qr-token', { headers: authHeader() })
      if (!res.ok) return
      const data = await res.json() as { token: string; ttlSeconds: number }
      const url  = `${window.location.origin}/w/login?token=${data.token}`
      const img  = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      setQrDataUrl(img)
      setQrCountdown(data.ttlSeconds)
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
      qrCountdownRef.current = setInterval(() => {
        setQrCountdown(p => { if (p <= 1) { clearInterval(qrCountdownRef.current!); return 0 } return p - 1 })
      }, 1000)
      if (qrRefreshRef.current) clearTimeout(qrRefreshRef.current)
      qrRefreshRef.current = setTimeout(refreshQR, (data.ttlSeconds - 8) * 1000)
    } catch { /* silent */ }
    finally { setQrLoading(false) }
  }, [])

  useEffect(() => {
    refreshQR()
    return () => {
      if (qrRefreshRef.current)   clearTimeout(qrRefreshRef.current)
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
    }
  }, [refreshQR])

  const activeStaff  = staff.filter(s => s.shiftStatus === 'ACTIVE')
  const offDutyStaff = staff.filter(s => s.shiftStatus !== 'ACTIVE')
  const countdownPct = (qrCountdown / 120) * 100

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-600" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{t.subtitle}</p>
        </div>
        {/* Summary pills */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeStaff.length} {t.active}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {staff.length} {t.total}
          </span>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['cards', Clock, lang === 'ar' ? 'الحضور اللحظي' : lang === 'fr' ? 'Présence live' : 'Live Status'],
           ['pointage', TableProperties, lang === 'ar' ? 'جدول شهري' : lang === 'fr' ? 'Pointage mensuel' : 'Monthly Grid']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════ POINTAGE TAB ══════════════════ */}
      {activeTab === 'pointage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-base font-bold text-slate-800 min-w-[130px] text-center">
                {new Date(`${pointageMonth}-01`).toLocaleDateString(
                  lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB',
                  { month: 'long', year: 'numeric' }
                )}
              </span>
              <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors print:hidden">
              <Download className="w-4 h-4" />
              {lang === 'ar' ? 'طباعة' : lang === 'fr' ? 'Imprimer' : 'Print'}
            </button>
          </div>
          {pointageLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !pointage || pointage.staff.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <TableProperties className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{lang === 'fr' ? 'Aucun employé' : lang === 'ar' ? 'لا يوجد موظفون' : 'No staff'}</p>
            </div>
          ) : (
            <PointageGrid data={pointage} lang={lang} />
          )}
        </div>
      )}

      {/* ══════════════════ LIVE STATUS TAB ══════════════════ */}
      {activeTab === 'cards' && (
        <div className="space-y-6">

          {/* QR Banner — compact and clean */}
          <div className="bg-slate-900 rounded-2xl p-4 flex items-center gap-5">
            <div className="shrink-0">
              {qrLoading || !qrDataUrl ? (
                <div className="w-28 h-28 bg-slate-800 rounded-xl flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-white p-1.5">
                  <img src={qrDataUrl} alt="Staff QR" width={112} height={112} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-white font-bold text-sm">{t.scanToLogin}</p>
              </div>
              <p className="text-slate-500 text-xs mb-3">{t.qrSub}</p>
              {/* Countdown bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${countdownPct > 50 ? 'bg-emerald-500' : countdownPct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${countdownPct}%` }}
                  />
                </div>
                <span className={`text-xs font-mono font-bold shrink-0 ${qrCountdown < 30 ? 'text-red-400' : 'text-slate-400'}`}>
                  {qrCountdown}s
                </span>
                <button onClick={refreshQR}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition-colors">
                  <RefreshCw className="w-3 h-3" /> {t.qrRefresh}
                </button>
              </div>
            </div>
          </div>

          {/* ── Active staff cards ── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : activeStaff.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CalendarClock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">{t.noActive}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeStaff.map(member => (
                <ActiveCard
                  key={member.id}
                  member={member}
                  lang={lang}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* ── Off-duty staff — compact list ── */}
          {!loading && offDutyStaff.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {t.offDutySection} ({offDutyStaff.length})
              </p>
              <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
                {offDutyStaff.map(member => {
                  const rs = ROLE_STYLE[member.role] ?? ROLE_STYLE.WAITER
                  return (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${rs.bg} flex items-center justify-center text-white text-sm font-bold shrink-0 opacity-50`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-600 truncate">{member.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rs.badge} opacity-70`}>
                          {rs.label[lang]}
                        </span>
                      </div>
                      {/* PIN inline — masked only; reset from Staff settings if forgotten */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-300">••••</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ActiveCard — clean card only for on-duty staff
// ─────────────────────────────────────────────────────────────────────────────

function ActiveCard({ member, lang, t }: {
  member:      StaffMember
  lang:        Lang
  t:           typeof T['en']
}) {
  const rs = ROLE_STYLE[member.role] ?? ROLE_STYLE.WAITER

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm shadow-emerald-50 overflow-hidden">
      {/* Top gradient strip */}
      <div className={`bg-gradient-to-r ${rs.bg} px-4 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{member.name}</p>
              <span className="text-white/70 text-[11px]">{rs.label[lang]}</span>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            {t.onDuty}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Duration */}
        {member.clockInTime && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            {t.since} {elapsed(member.clockInTime, t)}
          </div>
        )}

        {/* Tables */}
        {member.assignedTables.length > 0 && (
          <p className="text-xs text-slate-400">
            🪑 {t.tables} : {member.assignedTables.map(tb => `#${tb.tableNumber}`).join(', ')}
          </p>
        )}

        {/* PIN — masked only; reset from Staff settings if forgotten */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500">{t.pinLabel}</span>
          <span className="text-sm font-mono font-bold tracking-widest text-slate-300">••••</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PointageGrid
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  SUPERVISOR: 'bg-violet-100 text-violet-700',
  CASHIER:    'bg-sky-100 text-sky-700',
  WAITER:     'bg-emerald-100 text-emerald-700',
}

function PointageGrid({ data, lang }: { data: PointageData; lang: Lang }) {
  const days = Array.from({ length: data.daysInMonth }, (_, i) => i + 1)

  function isWeekend(day: number) {
    const d = new Date(data.year, data.month - 1, day).getDay()
    return d === 5 || d === 6
  }

  const labelTotal = lang === 'ar' ? 'المجموع' : 'Total'
  const labelObs   = lang === 'ar' ? 'ملاحظة' : lang === 'fr' ? 'Observation' : 'Note'
  const labelName  = lang === 'ar' ? 'الاسم / الأيام' : lang === 'fr' ? 'Noms / Jours' : 'Name / Days'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
      <div className="hidden print:block text-center py-3 font-bold text-lg border-b border-slate-200">
        Pointage — {String(data.month).padStart(2,'0')}/{data.year}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${60 + data.daysInMonth * 28 + 60 + 80}px` }}>
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="sticky left-0 z-10 bg-slate-800 text-left px-3 py-2.5 font-bold text-[11px] min-w-[140px] border-r border-slate-700">
                {labelName}
              </th>
              {days.map(d => (
                <th key={d} className={`text-center py-2.5 w-7 font-bold border-r border-slate-700 ${isWeekend(d) ? 'bg-slate-600' : ''}`}>
                  {d}
                </th>
              ))}
              <th className="text-center px-2 py-2.5 font-bold border-r border-slate-700 min-w-[44px]">{labelTotal}</th>
              <th className="text-left px-3 py-2.5 font-bold min-w-[80px]">{labelObs}</th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map((member, idx) => (
              <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className={`sticky left-0 z-10 px-3 py-2 border-r border-slate-200 font-semibold text-slate-800 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5">
                    <span>{member.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[member.role] ?? 'bg-slate-100 text-slate-600'}`}>
                      {member.role === 'SUPERVISOR' ? (lang === 'ar' ? 'مشرف' : 'Sup.') :
                       member.role === 'CASHIER'    ? (lang === 'ar' ? 'كاشير' : 'Cais.') :
                                                       (lang === 'ar' ? 'نادل' : 'Serv.')}
                    </span>
                  </div>
                </td>
                {days.map(d => {
                  const entry = member.days[d]
                  return (
                    <td key={d} className={`text-center border-r border-slate-100 py-1.5 ${isWeekend(d) ? 'bg-slate-100' : ''}`}>
                      {entry ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-emerald-600 font-black text-sm leading-none">✓</span>
                          <span className="text-[8px] text-slate-400 leading-none">{entry.in}</span>
                        </div>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="text-center border-r border-slate-100 font-black text-emerald-600 py-2">{member.totalDays}</td>
                <td className="px-3 py-2 text-slate-300 text-[10px] border-b border-slate-100" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-500 print:hidden">
        <span className="flex items-center gap-1"><span className="text-emerald-600 font-black">✓</span> {lang === 'fr' ? 'Présent' : lang === 'ar' ? 'حاضر' : 'Present'}</span>
        <span className="flex items-center gap-1"><span className="text-slate-300">—</span> {lang === 'fr' ? 'Absent' : lang === 'ar' ? 'غائب' : 'Absent'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" /> {lang === 'fr' ? 'Week-end' : lang === 'ar' ? 'عطلة' : 'Weekend'}</span>
      </div>
    </div>
  )
}
