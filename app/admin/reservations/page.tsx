'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarDays, List, RefreshCw, Loader2, Search, X,
  ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle,
  CalendarCheck, Users, Phone, FileText, Hash, AlertCircle,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'

interface Reservation {
  id:          string
  name:        string
  phone:       string
  guests:      number
  date:        string
  notes:       string
  status:      ResStatus
  tableNumber: number | null
  createdAt:   string
}

interface Counts { PENDING: number; ACCEPTED: number; COMPLETED: number; CANCELLED: number }

type ViewMode = 'list' | 'calendar'
type FilterStatus = 'ALL' | ResStatus

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:        'الحجوزات',
    subtitle:     'إدارة حجوزات الزبائن',
    guestName:    'اسم الضيف',
    listView:     'قائمة',
    calView:      'تقويم',
    search:       'بحث باسم أو رقم هاتف...',
    dateFrom:     'من تاريخ',
    dateTo:       'إلى تاريخ',
    all:          'الكل',
    pending:      'انتظار',
    accepted:     'مقبول',
    completed:    'مكتمل',
    cancelled:    'ملغي',
    guests:       'ضيوف',
    table:        'طاولة',
    notes:        'ملاحظات',
    phone:        'الهاتف',
    createdAt:    'تاريخ الطلب',
    noReservations: 'لا توجد حجوزات',
    noResSubtitle:  'جرب تغيير الفلاتر',
    accept:       'قبول',
    cancel:       'إلغاء',
    complete:     'إتمام',
    assignTable:  'تعيين طاولة رقم',
    confirmAccept:   'تأكيد قبول الحجز؟',
    confirmCancel:   'تأكيد إلغاء الحجز؟',
    confirmComplete: 'تأكيد إتمام الحجز؟',
    details:      'تفاصيل الحجز',
    close:        'إغلاق',
    tableOptional:'رقم الطاولة (اختياري)',
    saving:       'جارٍ الحفظ...',
    today:        'اليوم',
    reservation:  'حجز',
    reservations: 'حجوزات',
  },
  fr: {
    title:        'Réservations',
    subtitle:     'Gérez vos réservations clients',
    guestName:    'Nom du client',
    listView:     'Liste',
    calView:      'Calendrier',
    search:       'Rechercher par nom ou téléphone...',
    dateFrom:     'Du',
    dateTo:       'Au',
    all:          'Tout',
    pending:      'En attente',
    accepted:     'Acceptée',
    completed:    'Terminée',
    cancelled:    'Annulée',
    guests:       'Couverts',
    table:        'Table',
    notes:        'Notes',
    phone:        'Téléphone',
    createdAt:    'Date de création',
    noReservations: 'Aucune réservation',
    noResSubtitle:  'Modifiez les filtres pour afficher d\'autres résultats',
    accept:       'Accepter',
    cancel:       'Annuler',
    complete:     'Terminer',
    assignTable:  'Assigner table n°',
    confirmAccept:   'Confirmer l\'acceptation ?',
    confirmCancel:   'Confirmer l\'annulation ?',
    confirmComplete: 'Marquer comme terminée ?',
    details:      'Détails réservation',
    close:        'Fermer',
    tableOptional:'N° de table (optionnel)',
    saving:       'Enregistrement...',
    today:        "Aujourd'hui",
    reservation:  'réservation',
    reservations: 'réservations',
  },
  en: {
    title:        'Reservations',
    subtitle:     'Manage customer reservations',
    guestName:    'Guest Name',
    listView:     'List',
    calView:      'Calendar',
    search:       'Search by name or phone...',
    dateFrom:     'From',
    dateTo:       'To',
    all:          'All',
    pending:      'Pending',
    accepted:     'Accepted',
    completed:    'Completed',
    cancelled:    'Cancelled',
    guests:       'Guests',
    table:        'Table',
    notes:        'Notes',
    phone:        'Phone',
    createdAt:    'Created',
    noReservations: 'No reservations found',
    noResSubtitle:  'Try adjusting the filters',
    accept:       'Accept',
    cancel:       'Cancel',
    complete:     'Complete',
    assignTable:  'Assign table #',
    confirmAccept:   'Confirm acceptance?',
    confirmCancel:   'Confirm cancellation?',
    confirmComplete: 'Mark as completed?',
    details:      'Reservation Details',
    close:        'Close',
    tableOptional:'Table number (optional)',
    saving:       'Saving...',
    today:        'Today',
    reservation:  'reservation',
    reservations: 'reservations',
  },
  es: {
    title:        'Reservaciones',
    subtitle:     'Gestionar reservaciones de clientes',
    guestName:    'Nombre del cliente',
    listView:     'Lista',
    calView:      'Calendario',
    search:       'Buscar por nombre o teléfono...',
    dateFrom:     'Desde',
    dateTo:       'Hasta',
    all:          'Todo',
    pending:      'Pendiente',
    accepted:     'Aceptada',
    completed:    'Completada',
    cancelled:    'Cancelada',
    guests:       'Huéspedes',
    table:        'Mesa',
    notes:        'Notas',
    phone:        'Teléfono',
    createdAt:    'Creada',
    noReservations: 'No se encontraron reservaciones',
    noResSubtitle:  'Intenta ajustar los filtros',
    accept:       'Aceptar',
    cancel:       'Cancelar',
    complete:     'Completar',
    assignTable:  'Asignar mesa #',
    confirmAccept:   '¿Confirmar aceptación?',
    confirmCancel:   '¿Confirmar cancelación?',
    confirmComplete: '¿Marcar como completada?',
    details:      'Detalles de reservación',
    close:        'Cerrar',
    tableOptional:'Número de mesa (opcional)',
    saving:       'Guardando...',
    today:        'Hoy',
    reservation:  'reservación',
    reservations: 'reservaciones',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function fmt(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type TLabel = { pending: string; accepted: string; completed: string; cancelled: string }

const STATUS_META: Record<ResStatus, { label: (t: TLabel) => string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  PENDING:   { label: t => t.pending,   color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   Icon: Clock         },
  ACCEPTED:  { label: t => t.accepted,  color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', Icon: CheckCircle2  },
  COMPLETED: { label: t => t.completed, color: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    Icon: CalendarCheck },
  CANCELLED: { label: t => t.cancelled, color: 'text-slate-500',   bg: 'bg-slate-500/15',   border: 'border-slate-500/30',   Icon: XCircle       },
}

const FILTER_TABS: FilterStatus[] = ['ALL', 'PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const { lang, isRTL } = useLang()
  const t     = T[lang as keyof typeof T] ?? T.fr
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB'

  const [items,    setItems]    = useState<Reservation[]>([])
  const [counts,   setCounts]   = useState<Counts>({ PENDING: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 })
  const [loading,  setLoading]  = useState(true)
  const [total,    setTotal]    = useState(0)
  const [pages,    setPages]    = useState(1)
  const [page,     setPage]     = useState(1)

  const [view,       setView]       = useState<ViewMode>('list')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [search,     setSearch]     = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [calMonth,   setCalMonth]   = useState(() => new Date())

  const [selected,  setSelected]  = useState<Reservation | null>(null)
  const [tableNum,  setTableNum]  = useState('')
  const [acting,    setActing]    = useState<string | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (filterStatus !== 'ALL') params.set('status', filterStatus)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo)   params.set('dateTo', dateTo)
      if (search.trim()) params.set('search', search.trim())

      const [listRes, countRes] = await Promise.all([
        fetch(`/api/admin/reservations?${params}`,         { headers: authHeader() }),
        fetch('/api/admin/reservations/counts',            { headers: authHeader() }),
      ])

      if (listRes.ok) {
        const data = await listRes.json()
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
        setPages(data.pages ?? 1)
        setPage(p)
      }
      if (countRes.ok) setCounts(await countRes.json())
    } finally {
      setLoading(false)
    }
  }, [filterStatus, dateFrom, dateTo, search, page])

  useEffect(() => { load(1) }, [filterStatus, dateFrom, dateTo])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(1), 400)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search])

  async function doAction(id: string, action: 'accept' | 'cancel' | 'complete', tableNumber?: number) {
    setActing(id + action)
    try {
      const body: Record<string, unknown> = { action }
      if (tableNumber != null) body['tableNumber'] = tableNumber
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method:  'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) {
        setSelected(null)
        setTableNum('')
        await load(page)
      }
    } finally {
      setActing(null)
    }
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────

  const calDays = (() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const firstDay = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    return { firstDay, daysInMonth, y, m }
  })()

  const resByDate: Record<string, Reservation[]> = {}
  items.forEach(r => {
    const key = new Date(r.date).toISOString().slice(0, 10)
    if (!resByDate[key]) resByDate[key] = []
    resByDate[key]!.push(r)
  })

  // ── Derived ─────────────────────────────────────────────────────────────────

  const statsCards = [
    { key: 'PENDING'   as ResStatus, value: counts.PENDING   },
    { key: 'ACCEPTED'  as ResStatus, value: counts.ACCEPTED  },
    { key: 'COMPLETED' as ResStatus, value: counts.COMPLETED },
    { key: 'CANCELLED' as ResStatus, value: counts.CANCELLED },
  ]

  const inputCls = 'bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors'

  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <CalendarDays className="text-emerald-400" size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t.title}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={15} /> {t.listView}
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'calendar' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <CalendarDays size={15} /> {t.calView}
            </button>
          </div>
          <button
            onClick={() => load(page)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsCards.map(({ key, value }) => {
          const meta = STATUS_META[key]
          const Icon = meta.Icon
          return (
            <button
              key={key}
              onClick={() => { setFilterStatus(key); setPage(1) }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                filterStatus === key
                  ? `${meta.bg} ${meta.border}`
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={meta.color} />
                <p className="text-xs text-slate-400">{meta.label(t)}</p>
              </div>
              <p className={`text-2xl font-bold ${meta.color}`}>{value}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(s => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s === 'ALL' ? t.all : STATUS_META[s].label(t)}
              {s !== 'ALL' && (
                <span className="ml-1.5 text-xs opacity-60">{counts[s]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search + date range */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search}
              className={`${inputCls} w-full ${isRTL ? 'pr-9' : 'pl-9'}`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 hover:text-white ${isRTL ? 'left-3' : 'right-3'}`}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">{t.dateFrom}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputCls} w-36`} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">{t.dateTo}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputCls} w-36`} />
          </div>
          {(dateFrom || dateTo || search) && (
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
              <CalendarDays className="mx-auto text-slate-600 mb-3" size={40} />
              <p className="text-slate-300 font-semibold">{t.noReservations}</p>
              <p className="text-slate-500 text-sm mt-1">{t.noResSubtitle}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(res => {
                const meta   = STATUS_META[res.status]
                const Icon   = meta.Icon
                const isToday = new Date(res.date).toDateString() === new Date().toDateString()
                return (
                  <div
                    key={res.id}
                    onClick={() => { setSelected(res); setTableNum(res.tableNumber ? String(res.tableNumber) : '') }}
                    className="rounded-2xl border border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/80 p-4 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* Status icon */}
                      <div className={`p-2 rounded-xl ${meta.bg} shrink-0`}>
                        <Icon size={18} className={meta.color} />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{res.name}</span>
                          {isToday && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {t.today}
                            </span>
                          )}
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color} ${meta.bg} border ${meta.border}`}>
                            <Icon size={10} /> {meta.label(t)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={13} />
                            {fmt(res.date, locale)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={13} />
                            {res.guests} {t.guests}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone size={13} />
                            {res.phone}
                          </span>
                          {res.tableNumber != null && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Hash size={13} />
                              {t.table} {res.tableNumber}
                            </span>
                          )}
                        </div>
                        {res.notes && (
                          <p className="text-xs text-slate-500 truncate">{res.notes}</p>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        {res.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => { if (confirm(t.confirmAccept)) doAction(res.id, 'accept') }}
                              disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {acting === res.id + 'accept' ? <Loader2 size={12} className="animate-spin" /> : t.accept}
                            </button>
                            <button
                              onClick={() => { if (confirm(t.confirmCancel)) doAction(res.id, 'cancel') }}
                              disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {acting === res.id + 'cancel' ? <Loader2 size={12} className="animate-spin" /> : t.cancel}
                            </button>
                          </>
                        )}
                        {res.status === 'ACCEPTED' && (
                          <>
                            <button
                              onClick={() => { if (confirm(t.confirmComplete)) doAction(res.id, 'complete') }}
                              disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {acting === res.id + 'complete' ? <Loader2 size={12} className="animate-spin" /> : t.complete}
                            </button>
                            <button
                              onClick={() => { if (confirm(t.confirmCancel)) doAction(res.id, 'cancel') }}
                              disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {acting === res.id + 'cancel' ? <Loader2 size={12} className="animate-spin" /> : t.cancel}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-400">
                {total} {total === 1 ? t.reservation : t.reservations}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => load(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-300 px-2">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={page >= pages || loading}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CALENDAR VIEW ─────────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-white font-semibold">
              {calMonth.toLocaleString(locale, { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {(lang === 'ar'
              ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
              : lang === 'fr'
              ? ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']
              : lang === 'es'
              ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
              : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
            ).map(d => (
              <div key={d} className="text-[11px] font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calDays.firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: calDays.daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateKey = `${calDays.y}-${String(calDays.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayRes  = resByDate[dateKey] ?? []
              const isToday = new Date().toISOString().slice(0, 10) === dateKey

              const hasPending   = dayRes.some(r => r.status === 'PENDING')
              const hasAccepted  = dayRes.some(r => r.status === 'ACCEPTED')

              return (
                <div
                  key={day}
                  className={`relative min-h-[60px] rounded-xl p-1.5 cursor-pointer transition-all ${
                    isToday
                      ? 'bg-emerald-600/20 border border-emerald-500/40'
                      : dayRes.length > 0
                      ? 'bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60'
                      : 'bg-slate-800/30 hover:bg-slate-700/30 border border-transparent'
                  }`}
                  onClick={() => {
                    if (dayRes.length > 0) {
                      setDateFrom(dateKey)
                      setDateTo(dateKey)
                      setView('list')
                    }
                  }}
                >
                  <span className={`text-xs font-semibold block ${isToday ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {day}
                  </span>
                  {dayRes.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayRes.slice(0, 3).map(r => (
                        <div
                          key={r.id}
                          className={`text-[10px] rounded px-1 truncate font-medium ${
                            r.status === 'PENDING'   ? 'bg-amber-500/30 text-amber-300' :
                            r.status === 'ACCEPTED'  ? 'bg-emerald-500/30 text-emerald-300' :
                            r.status === 'COMPLETED' ? 'bg-blue-500/30 text-blue-300' :
                            'bg-slate-500/30 text-slate-400'
                          }`}
                        >
                          {fmtTime(r.date)} {r.name}
                        </div>
                      ))}
                      {dayRes.length > 3 && (
                        <div className="text-[10px] text-slate-500 px-1">+{dayRes.length - 3}</div>
                      )}
                    </div>
                  )}
                  {/* Dot indicators */}
                  {(hasPending || hasAccepted) && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      {hasPending  && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {hasAccepted && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-emerald-500" size={20} />
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL DRAWER ──────────────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelected(null); setTableNum('') }}
        >
          <div
            className="w-full max-w-lg bg-[#1a2744] rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{t.details}</h3>
              <button onClick={() => { setSelected(null); setTableNum('') }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Status badge */}
            {(() => {
              const meta = STATUS_META[selected.status]
              const Icon = meta.Icon
              return (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${meta.bg} border ${meta.border}`}>
                  <Icon size={15} className={meta.color} />
                  <span className={`text-sm font-semibold ${meta.color}`}>{meta.label(t)}</span>
                </div>
              )
            })()}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={<AlertCircle size={14} />} label={t.guestName} value={selected.name} />
              <InfoRow icon={<Phone size={14} />} label={t.phone} value={selected.phone} />
              <InfoRow icon={<CalendarDays size={14} />} label="Date" value={fmt(selected.date, locale)} />
              <InfoRow icon={<Users size={14} />} label={t.guests} value={String(selected.guests)} />
              <InfoRow icon={<Hash size={14} />} label={t.table} value={selected.tableNumber ? String(selected.tableNumber) : '—'} />
              <InfoRow icon={<Clock size={14} />} label={t.createdAt} value={fmtDate(selected.createdAt, locale)} />
            </div>

            {selected.notes && (
              <div className="rounded-xl bg-slate-700/40 border border-slate-600 p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <FileText size={12} /> {t.notes}
                </div>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}

            {/* Table number input (for accept/complete) */}
            {(selected.status === 'PENDING' || selected.status === 'ACCEPTED') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t.tableOptional}</label>
                <input
                  type="number"
                  min={1}
                  value={tableNum}
                  onChange={e => setTableNum(e.target.value)}
                  placeholder="1, 2, 3..."
                  className={`${inputCls} w-full`}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              {selected.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => doAction(selected.id, 'accept', tableNum ? parseInt(tableNum) : undefined)}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {acting === selected.id + 'accept' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {t.accept}
                  </button>
                  <button
                    onClick={() => doAction(selected.id, 'cancel')}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {acting === selected.id + 'cancel' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                    {t.cancel}
                  </button>
                </>
              )}
              {selected.status === 'ACCEPTED' && (
                <>
                  <button
                    onClick={() => doAction(selected.id, 'complete', tableNum ? parseInt(tableNum) : undefined)}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {acting === selected.id + 'complete' ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck size={15} />}
                    {t.complete}
                  </button>
                  <button
                    onClick={() => doAction(selected.id, 'cancel')}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {acting === selected.id + 'cancel' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                    {t.cancel}
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelected(null); setTableNum('') }}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-medium transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper component ─────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
        {icon} {label}
      </div>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  )
}
