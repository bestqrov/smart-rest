'use client'

import { useEffect, useRef, useState } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Radio, RefreshCw, Wifi, WifiOff,
  Clock, Bell, BellOff, Users, AlertTriangle
} from 'lucide-react'
import { useLang } from '../lang-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffCard {
  id:             string
  name:           string
  role:           string
  roles:          string[]
  shiftStatus:    'ACTIVE' | 'OFF_DUTY'
  clockInTime:    string | null
  pendingAlerts:  number
  assignedTables: { id: string; tableNumber: number; zone: string | null }[]
}

type Lang = 'ar' | 'fr' | 'en' | 'es'

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:        'مراقبة الكوادر',
    subtitle:     'حالة الموظفين في الوقت الفعلي',
    onDuty:       'في الخدمة',
    offDuty:      'خارج الخدمة',
    alert:        'تنبيه معلق',
    alerts:       'تنبيهات معلقة',
    noStaff:      'لا يوجد موظفون نشطون',
    tables:       'الطاولات المخصصة',
    noTables:     'لا طاولات',
    since:        'منذ',
    totalOnDuty:  'حاضرون',
    totalAlerts:  'تنبيهات',
    allClear:     'كل شيء تمام ✓',
    unresponsive: 'لا يستجيب',
    refresh:      'تحديث',
    live:         'مباشر',
    roles: { WAITER: 'نادل', CASHIER: 'كاشير', SUPERVISOR: 'مشرف' } as Record<string, string>,
  },
  fr: {
    title:        'Surveillance du personnel',
    subtitle:     'Statut en temps réel',
    onDuty:       'En service',
    offDuty:      'Hors service',
    alert:        'alerte en attente',
    alerts:       'alertes en attente',
    noStaff:      'Aucun membre actif',
    tables:       'Tables assignées',
    noTables:     'Aucune table',
    since:        'depuis',
    totalOnDuty:  'En service',
    totalAlerts:  'Alertes',
    allClear:     'Tout est OK ✓',
    unresponsive: 'Ne répond pas',
    refresh:      'Actualiser',
    live:         'En direct',
    roles: { WAITER: 'Serveur', CASHIER: 'Caissier', SUPERVISOR: 'Superviseur' } as Record<string, string>,
  },
  en: {
    title:        'Staff Monitor',
    subtitle:     'Real-time staff status',
    onDuty:       'On Duty',
    offDuty:      'Off Duty',
    alert:        'pending alert',
    alerts:       'pending alerts',
    noStaff:      'No active staff members',
    tables:       'Assigned tables',
    noTables:     'No tables',
    since:        'since',
    totalOnDuty:  'On Duty',
    totalAlerts:  'Alerts',
    allClear:     'All clear ✓',
    unresponsive: 'Not responding',
    refresh:      'Refresh',
    live:         'Live',
    roles: { WAITER: 'Waiter', CASHIER: 'Cashier', SUPERVISOR: 'Supervisor' } as Record<string, string>,
  },
  es: {
    title:        'Monitor de personal',
    subtitle:     'Estado en tiempo real',
    onDuty:       'En turno',
    offDuty:      'Fuera de turno',
    alert:        'alerta pendiente',
    alerts:       'alertas pendientes',
    noStaff:      'Sin miembros activos',
    tables:       'Mesas asignadas',
    noTables:     'Sin mesas',
    since:        'desde',
    totalOnDuty:  'En turno',
    totalAlerts:  'Alertas',
    allClear:     'Todo bien ✓',
    unresponsive: 'Sin respuesta',
    refresh:      'Actualizar',
    live:         'En vivo',
    roles: { WAITER: 'Camarero', CASHIER: 'Cajero', SUPERVISOR: 'Supervisor' } as Record<string, string>,
  },
}

// ── Role icon & color ─────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, string> = {
  WAITER:     '🛎️',
  CASHIER:    '💳',
  SUPERVISOR: '👔',
}

function roleIcon(role: string) {
  return ROLE_ICON[role] ?? '👤'
}

function formatDuration(clockIn: string | null, t: typeof T['ar']) {
  if (!clockIn) return ''
  const mins = Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000)
  if (mins < 60) return `${mins}د`
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}${t === T.ar ? 'س' : 'h'}${m ? ` ${m}${t === T.ar ? 'د' : 'm'}` : ''}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ControlPage() {
  const { lang } = useLang()
  const t = T[(lang as Lang) ?? 'ar'] ?? T.ar

  const [staff,     setStaff]     = useState<StaffCard[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [connected, setConnected] = useState(false)
  // track which staff IDs got a fresh notification this session (for pulse ring)
  const [freshAlerts, setFreshAlerts] = useState<Set<string>>(new Set())

  const socketRef = useRef<Socket | null>(null)
  const tokenRef  = useRef<string | null>(null)

  // ── Auth token ──────────────────────────────────────────────────────────────
  useEffect(() => {
    tokenRef.current = localStorage.getItem('adminToken')
  }, [])

  // ── Fetch staff ─────────────────────────────────────────────────────────────
  async function fetchStaff() {
    const token = tokenRef.current ?? localStorage.getItem('adminToken')
    if (!token) return
    try {
      const res = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      setStaff(data.staff ?? [])
      setLastFetch(new Date())
    } catch {}
    finally { setLoading(false) }
  }

  // ── Auto-refresh every 30s ──────────────────────────────────────────────────
  useEffect(() => {
    fetchStaff()
    const id = setInterval(fetchStaff, 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Socket.io — listen for waiter_notification ──────────────────────────────
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    if (!SOCKET_URL) return
    const token = localStorage.getItem('adminToken') ?? ''
    const cafeId = localStorage.getItem('cafeId') ?? ''
    if (!cafeId) return

    const s = socketIO(SOCKET_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = s

    s.on('connect',    () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.emit('join_room', { cafeId })

    s.on('waiter_notification', (payload: { orderId: string; tableId?: string; waiterId?: string }) => {
      // bump pendingAlerts for the staff who was notified (if we know their ID)
      if (payload.waiterId) {
        setFreshAlerts(prev => new Set(prev).add(payload.waiterId!))
        setStaff(prev => prev.map(m =>
          m.id === payload.waiterId
            ? { ...m, pendingAlerts: (m.pendingAlerts ?? 0) + 1 }
            : m
        ))
      } else {
        // unknown waiter — refresh all
        fetchStaff()
      }
    })

    s.on('order_updated', () => { fetchStaff() })

    return () => { s.disconnect() }
  }, [])

  // ── Derived stats ───────────────────────────────────────────────────────────
  const onDutyCount   = staff.filter(s => s.shiftStatus === 'ACTIVE').length
  const totalAlerts   = staff.reduce((n, s) => n + (s.pendingAlerts ?? 0), 0)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Radio className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-extrabold text-white">{t.title}</h1>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              connected ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {t.live}
            </span>
          </div>
          <p className="text-gray-500 text-sm">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-xs text-gray-600">
              {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchStaff}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Users className="w-3.5 h-3.5" /> {t.totalOnDuty}
          </div>
          <p className="text-2xl font-extrabold text-white">{onDutyCount}</p>
        </div>
        <div className={`rounded-2xl p-4 border transition-all ${
          totalAlerts > 0
            ? 'bg-red-950/40 border-red-800'
            : 'bg-gray-900 border-gray-800'
        }`}>
          <div className={`flex items-center gap-2 text-xs mb-1 ${totalAlerts > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            <Bell className="w-3.5 h-3.5" /> {t.totalAlerts}
          </div>
          <p className={`text-2xl font-extrabold ${totalAlerts > 0 ? 'text-red-400' : 'text-white'}`}>
            {totalAlerts}
          </p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" /> Status
          </div>
          <p className={`text-sm font-bold ${totalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {totalAlerts > 0
              ? `⚠ ${totalAlerts} ${totalAlerts === 1 ? t.alert : t.alerts}`
              : t.allClear}
          </p>
        </div>
      </div>

      {/* Staff cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-40 bg-gray-900 rounded-2xl animate-pulse border border-gray-800" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t.noStaff}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(member => {
            const isAlert   = (member.pendingAlerts ?? 0) > 0
            const isFresh   = freshAlerts.has(member.id)
            const isOnDuty  = member.shiftStatus === 'ACTIVE'

            return (
              <div key={member.id}
                className={`relative rounded-2xl border p-4 transition-all duration-500 ${
                  isAlert
                    ? 'bg-red-950/30 border-red-700 shadow-lg shadow-red-900/30'
                    : isOnDuty
                    ? 'bg-gray-900 border-gray-700'
                    : 'bg-gray-900/50 border-gray-800 opacity-70'
                }`}>

                {/* Pulse ring when there's a fresh unacknowledged notification */}
                {isFresh && (
                  <span className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-ping opacity-30 pointer-events-none" />
                )}

                {/* Alert banner */}
                {isAlert && (
                  <div className="flex items-center gap-1.5 bg-red-900/50 border border-red-700/50 rounded-xl px-3 py-1.5 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-red-300 text-xs font-bold">
                      {member.pendingAlerts} {member.pendingAlerts === 1 ? t.alert : t.alerts} — {t.unresponsive}
                    </span>
                  </div>
                )}

                {/* Staff info */}
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    isAlert   ? 'bg-red-900/50 border border-red-700' :
                    isOnDuty  ? 'bg-gray-800 border border-gray-700' :
                                'bg-gray-800/50 border border-gray-800'
                  }`}>
                    {roleIcon(member.role)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-none truncate">{member.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {t.roles[member.role] ?? member.role}
                      {member.roles.length > 0 && (
                        <span className="text-gray-600"> · {member.roles.slice(0, 2).join(', ')}</span>
                      )}
                    </p>

                    {/* Status badge */}
                    <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isOnDuty
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                      {isOnDuty ? t.onDuty : t.offDuty}
                      {isOnDuty && member.clockInTime && (
                        <span className="text-gray-500 font-normal ml-0.5">
                          · {formatDuration(member.clockInTime, t)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Alert count badge */}
                  {isAlert && (
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0 animate-bounce">
                      {member.pendingAlerts}
                    </div>
                  )}
                  {!isAlert && (
                    <BellOff className="w-4 h-4 text-gray-700 shrink-0 mt-1" />
                  )}
                </div>

                {/* Assigned tables */}
                {member.assignedTables.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-gray-600 mb-1.5">{t.tables}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.assignedTables.map(tbl => (
                        <span key={tbl.id}
                          className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-lg font-mono">
                          #{tbl.tableNumber}
                          {tbl.zone && <span className="text-gray-600 ml-1">{tbl.zone}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isOnDuty && member.assignedTables.length === 0 && (
                  <p className="mt-3 text-xs text-gray-700">{t.noTables}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
