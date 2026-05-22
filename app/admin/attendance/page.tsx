'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Eye, EyeOff, RefreshCw, QrCode, CalendarClock, Clock, CheckCircle, XCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id:          string
  name:        string
  role:        'WAITER' | 'CASHIER' | 'SUPERVISOR'
  roles:       string[]
  pinDisplay:  string | null
  shiftStatus: 'ACTIVE' | 'OFF_DUTY'
  clockInTime: string | null
  isActive:    boolean
  pendingAlerts: number
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}

type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── Extra role labels ─────────────────────────────────────────────────────────

const EXTRA_LABELS: Record<string, Record<Lang, string>> = {
  BARISTA:    { ar: '☕ صانع قهوة', fr: '☕ Barista',           en: '☕ Barista',    es: '☕ Barista'    },
  COOK:       { ar: '👨‍🍳 طباخ',      fr: '👨‍🍳 Cuisinier',        en: '👨‍🍳 Cook',      es: '👨‍🍳 Cocinero'   },
  CLEANER:    { ar: '🧹 نظافة',      fr: "🧹 Nettoyage",         en: '🧹 Cleaner',    es: '🧹 Limpieza'   },
  DISHWASHER: { ar: '🍽️ غسيل أواني', fr: '🍽️ Plonge',           en: '🍽️ Dishwasher', es: '🍽️ Fregador'  },
  RUNNER:     { ar: '🏃 رانر',        fr: '🏃 Runner',            en: '🏃 Runner',     es: '🏃 Runner'     },
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الحضور والتسجيل السريع',
    subtitle: 'بطاقة كل موظف تحتوي على رمز QR وPIN للدخول السريع إلى الشيفت',
    total: 'الإجمالي', active: 'حاضر', offline: 'خارج الشيفت',
    roles: { WAITER: 'نادل', CASHIER: 'كاشير', SUPERVISOR: 'مشرف' },
    showPin: 'إظهار PIN', hidePin: 'إخفاء PIN',
    pinLabel: 'الرمز السري',
    pinNotSet: 'غير محدد',
    onDuty: 'في الخدمة', offDuty: 'خارج الخدمة',
    since: 'منذ', hours: 'ساعة', mins: 'د',
    qrSub: 'يصلح دقيقتين · امسح ثم أدخل PIN',
    qrRefresh: 'تجديد QR',
    expiresIn: 'ينتهي خلال',
    scanToLogin: 'امسح الـ QR للدخول',
    lastSeen: 'آخر ظهور',
    tables: 'الطاولات',
    noTables: 'لا طاولات مخصصة',
  },
  fr: {
    title: 'Présence & Connexion Rapide',
    subtitle: 'Chaque carte contient un QR et un PIN pour le pointage rapide',
    total: 'Total', active: 'En service', offline: 'Hors service',
    roles: { WAITER: 'Serveur', CASHIER: 'Caissier', SUPERVISOR: 'Superviseur' },
    showPin: 'Voir PIN', hidePin: 'Masquer PIN',
    pinLabel: 'Code PIN',
    pinNotSet: 'Non défini',
    onDuty: 'En service', offDuty: 'Hors service',
    since: 'depuis', hours: 'h', mins: 'min',
    qrSub: 'Valable 2 min · Scanner + saisir PIN',
    qrRefresh: 'Nouveau QR',
    expiresIn: 'Expire dans',
    scanToLogin: 'Scanner le QR pour se connecter',
    lastSeen: 'Vu la dernière fois',
    tables: 'Tables',
    noTables: 'Aucune table assignée',
  },
  en: {
    title: 'Attendance & Quick Login',
    subtitle: 'Each card has a QR code + PIN for fast shift check-in',
    total: 'Total', active: 'On Duty', offline: 'Off Duty',
    roles: { WAITER: 'Waiter', CASHIER: 'Cashier', SUPERVISOR: 'Supervisor' },
    showPin: 'Show PIN', hidePin: 'Hide PIN',
    pinLabel: 'PIN Code',
    pinNotSet: 'Not set',
    onDuty: 'On Duty', offDuty: 'Off Duty',
    since: 'since', hours: 'h', mins: 'min',
    qrSub: 'Valid 2 min · Scan + enter PIN',
    qrRefresh: 'Refresh QR',
    expiresIn: 'Expires in',
    scanToLogin: 'Scan QR to log in',
    tables: 'Tables',
    noTables: 'No tables assigned',
    lastSeen: 'Last seen',
  },
  es: {
    title: 'Asistencia y Acceso Rápido',
    subtitle: 'Cada tarjeta contiene QR y PIN para el registro rápido de turno',
    total: 'Total', active: 'En turno', offline: 'Fuera de turno',
    roles: { WAITER: 'Camarero', CASHIER: 'Cajero', SUPERVISOR: 'Supervisor' },
    showPin: 'Ver PIN', hidePin: 'Ocultar PIN',
    pinLabel: 'Código PIN',
    pinNotSet: 'No definido',
    onDuty: 'En turno', offDuty: 'Fuera de turno',
    since: 'desde', hours: 'h', mins: 'min',
    qrSub: 'Válido 2 min · Escanear + PIN',
    qrRefresh: 'Nuevo QR',
    expiresIn: 'Expira en',
    scanToLogin: 'Escanear QR para entrar',
    tables: 'Mesas',
    noTables: 'Sin mesas asignadas',
    lastSeen: 'Visto por última vez',
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

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [lang,  setLang]  = useState<Lang>('ar')
  const isRTL = lang === 'ar'
  const t     = T[lang]

  const [staff,   setStaff]   = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // Shared rotating QR state (single QR for all staff — each uses their PIN to identify)
  const [qrDataUrl,   setQrDataUrl]   = useState('')
  const [qrCountdown, setQrCountdown] = useState(0)
  const [qrLoading,   setQrLoading]   = useState(false)
  const qrRefreshRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Per-card PIN reveal state
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set())

  // ── Fetch staff ─────────────────────────────────────────────────────────────
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

  // ── Rotating QR (single shared token) ─────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setQrLoading(true)
    try {
      const res  = await fetch('/api/admin/waiter-qr-token', { headers: authHeader() })
      if (!res.ok) return
      const data = await res.json() as { token: string; ttlSeconds: number }
      const url  = `${window.location.origin}/w/login?token=${data.token}`
      const img  = await QRCode.toDataURL(url, {
        width: 200, margin: 1,
        color: { dark: '#0f172a', light: '#f0fdf4' }
      })
      setQrDataUrl(img)
      setQrCountdown(data.ttlSeconds)

      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current)
      qrCountdownRef.current = setInterval(() => {
        setQrCountdown(p => {
          if (p <= 1) { clearInterval(qrCountdownRef.current!); return 0 }
          return p - 1
        })
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

  // ── PIN reveal toggle ──────────────────────────────────────────────────────
  function togglePin(id: string) {
    setRevealedPins(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const countdownPct = (qrCountdown / 120) * 100
  const activeCount  = staff.filter(s => s.shiftStatus === 'ACTIVE').length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-emerald-600" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.subtitle}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-semibold text-slate-600">
              {t.total}: <strong>{staff.length}</strong>
            </span>
            <span className="text-sm font-semibold text-emerald-600">
              🟢 {t.active}: <strong>{activeCount}</strong>
            </span>
            <span className="text-sm font-semibold text-slate-400">
              🔴 {t.offline}: <strong>{staff.length - activeCount}</strong>
            </span>
          </div>
        </div>

        {/* Lang switcher */}
        <div className="flex items-center gap-1.5">
          {(['ar','fr','en','es'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold ${lang === l ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Shared rotating QR banner ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 shadow-lg">
        {/* QR code */}
        <div className="shrink-0">
          {qrLoading || !qrDataUrl ? (
            <div className="w-40 h-40 bg-slate-700 rounded-xl flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden ring-4 ring-amber-400/30 shadow">
              <img src={qrDataUrl} alt="Staff Login QR" width={160} height={160} />
            </div>
          )}
        </div>

        <div className="flex-1 text-center sm:text-start">
          <p className="text-white font-bold text-lg mb-1">{t.scanToLogin}</p>
          <p className="text-slate-400 text-sm mb-3">{t.qrSub}</p>

          {/* Countdown bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{t.expiresIn}</span>
              <span className={`font-bold ${qrCountdown < 30 ? 'text-red-400' : 'text-slate-300'}`}>
                {qrCountdown}s
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  countdownPct > 50 ? 'bg-emerald-500' : countdownPct > 20 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>

          <button onClick={refreshQR}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors">
            <RefreshCw className="w-4 h-4" /> {t.qrRefresh}
          </button>
        </div>
      </div>

      {/* ── Staff pass cards grid ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun employé enregistré / لا يوجد موظفون</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {staff.map(member => (
            <PassCard
              key={member.id}
              member={member}
              lang={lang}
              t={t}
              pinRevealed={revealedPins.has(member.id)}
              onTogglePin={() => togglePin(member.id)}
              elapsed={elapsed}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PassCard — phone-shaped employee pass
// ─────────────────────────────────────────────────────────────────────────────

function PassCard({
  member, lang, t, pinRevealed, onTogglePin, elapsed,
}: {
  member:       StaffMember
  lang:         Lang
  t:            typeof T['en']
  pinRevealed:  boolean
  onTogglePin:  () => void
  elapsed:      (iso: string, t: typeof T['en']) => string
}) {
  const isActive = member.shiftStatus === 'ACTIVE'

  // Primary role color
  const roleBg =
    member.role === 'SUPERVISOR' ? 'from-purple-500 to-purple-700' :
    member.role === 'CASHIER'    ? 'from-blue-500 to-blue-700' :
    'from-emerald-500 to-emerald-700'

  const roleLabel =
    member.role === 'SUPERVISOR' ? t.roles.SUPERVISOR :
    member.role === 'CASHIER'    ? t.roles.CASHIER :
    t.roles.WAITER

  return (
    <div className={`relative rounded-2xl overflow-hidden border-2 shadow-sm transition-all ${
      isActive
        ? 'border-emerald-400 shadow-emerald-100'
        : 'border-slate-200 opacity-80 grayscale-[30%]'
    }`}>

      {/* Card header gradient */}
      <div className={`bg-gradient-to-br ${roleBg} px-4 py-4 text-white`}>
        {/* Status badge */}
        <div className="flex justify-between items-start mb-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isActive ? 'bg-white/30 text-white' : 'bg-black/20 text-white/70'
          }`}>
            {isActive ? `🟢 ${t.onDuty}` : `⚫ ${t.offDuty}`}
          </span>
        </div>

        {/* Avatar initial */}
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold mx-auto mb-1">
          {member.name.charAt(0).toUpperCase()}
        </div>

        <p className="text-center font-bold text-sm truncate">{member.name}</p>
        <p className="text-center text-white/70 text-[11px]">{roleLabel}</p>
      </div>

      {/* Card body */}
      <div className="bg-white px-3 py-3 space-y-2">

        {/* Extra roles */}
        {member.roles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.roles.map(r => (
              <span key={r} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {EXTRA_LABELS[r]?.[lang] ?? r}
              </span>
            ))}
          </div>
        )}

        {/* Shift duration */}
        {isActive && member.clockInTime && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
            <Clock className="w-3 h-3" />
            {t.since} {elapsed(member.clockInTime, t)}
          </div>
        )}

        {/* Assigned tables */}
        {member.assignedTables.length > 0 && (
          <p className="text-[11px] text-slate-400">
            🪑 {member.assignedTables.map(tb => `#${tb.tableNumber}`).join(', ')}
          </p>
        )}

        {/* PIN reveal */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold">{t.pinLabel}</span>
            <button
              onClick={onTogglePin}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              {pinRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {pinRevealed ? t.hidePin : t.showPin}
            </button>
          </div>
          <div className={`mt-1 text-center py-1.5 rounded-lg text-sm font-mono font-bold tracking-widest ${
            pinRevealed ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-300'
          }`}>
            {pinRevealed
              ? (member.pinDisplay ?? t.pinNotSet)
              : '••••'
            }
          </div>
        </div>
      </div>
    </div>
  )
}
