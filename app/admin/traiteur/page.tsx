'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Users, TrendingUp, Plus, ChevronRight, ChevronLeft,
  Loader2, RefreshCw, Clock, MapPin, CheckCircle2,
  AlertCircle, Star, Briefcase, Cake, Coffee, Utensils, List, LayoutGrid
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventStatus = 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
type EventType   = 'WEDDING' | 'CORPORATE' | 'BIRTHDAY' | 'REUNION' | 'GALA' | 'OTHER'

type EventRow = {
  id:               string
  name:             string
  type:             EventType
  date:             string
  venue:            string
  guestCount:       number
  status:           EventStatus
  clientName:       string
  quotedPrice:      number | null
  actualAttendees:  number | null
  commissionAmount: number | null
  _count:           { guests: number }
}

type Stats = {
  totalEvents:     number
  upcomingEvents:  number
  totalGuests:     number
  totalCommission: number
  recentEvents:    EventRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; labelAr: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  DRAFT:     { label: 'Draft',     labelAr: 'مسودة',    color: 'text-gray-500',  bg: 'bg-gray-100',   icon: Clock       },
  CONFIRMED: { label: 'Confirmed', labelAr: 'مؤكدة',    color: 'text-blue-600',  bg: 'bg-blue-50',    icon: CheckCircle2 },
  ACTIVE:    { label: 'En cours',  labelAr: 'جارية',    color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Star       },
  COMPLETED: { label: 'Terminée', labelAr: 'منتهية',   color: 'text-violet-600', bg: 'bg-violet-50',  icon: CheckCircle2 },
  CANCELLED: { label: 'Annulée',  labelAr: 'ملغاة',    color: 'text-red-500',   bg: 'bg-red-50',     icon: AlertCircle },
}

const TYPE_CONFIG: Record<EventType, { labelAr: string; icon: typeof Star }> = {
  WEDDING:   { labelAr: 'زفاف',         icon: Star      },
  CORPORATE: { labelAr: 'شركة',         icon: Briefcase },
  BIRTHDAY:  { labelAr: 'عيد ميلاد',   icon: Cake      },
  REUNION:   { labelAr: 'لقاء',         icon: Coffee    },
  GALA:      { labelAr: 'حفل رسمي',    icon: Star      },
  OTHER:     { labelAr: 'أخرى',         icon: Utensils  },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtMoney(n: number | null, currency = 'MAD') {
  if (n === null) return '—'
  return n.toLocaleString('fr-MA') + ' ' + currency
}

const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TraiteurDashboard() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats,  setStats]  = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<EventStatus | 'ALL'>('ALL')
  const [view,   setView]     = useState<'list' | 'calendar'>('list')
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load() {
    setLoading(true)
    const [evRes, stRes] = await Promise.all([
      fetch('/api/traiteur/events',  { headers: auth() }),
      fetch('/api/traiteur/stats',   { headers: auth() }),
    ])
    if (evRes.ok) setEvents(await evRes.json())
    if (stRes.ok) setStats(await stRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'ALL' ? events : events.filter(e => e.status === filter)

  const currency = typeof window !== 'undefined'
    ? (localStorage.getItem('currency') ?? 'MAD')
    : 'MAD'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            🎪 SmartTraiteur
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">إدارة الحفلات والمناسبات</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setView('list')}
              className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('calendar')}
              className={`p-1.5 rounded-lg transition-colors ${view === 'calendar' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={load} className="text-gray-400 hover:text-violet-600 transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
          <Link
            href="/admin/traiteur/events/new"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> حفلة جديدة
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'مجموع الحفلات',   value: stats.totalEvents,     icon: CalendarDays, color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'حفلات قادمة',     value: stats.upcomingEvents,  icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'مجموع الضيوف',    value: stats.totalGuests.toLocaleString(), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'عمولات متراكمة',  value: fmtMoney(stats.totalCommission, currency), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'الكل' : STATUS_CONFIG[s].labelAr}
            {s !== 'ALL' && (
              <span className="ml-1 opacity-70">
                ({events.filter(e => e.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Calendar view ── */}
      {view === 'calendar' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-gray-800">{MONTHS_AR[calMonth.getMonth()]} {calMonth.getFullYear()}</h2>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_AR.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildMonthGrid(calMonth.getFullYear(), calMonth.getMonth()).map((day, i) => {
              const dayEvents = day ? filtered.filter(e => sameDay(new Date(e.date), day)) : []
              const isDoubleBooked = dayEvents.length > 1
              const isToday = day ? sameDay(day, new Date()) : false
              return (
                <div key={i} className={`min-h-[76px] rounded-xl border p-1.5 ${
                  !day ? 'border-transparent' : isDoubleBooked ? 'border-red-300 bg-red-50/60' : 'border-gray-100'
                }`}>
                  {day && (
                    <>
                      <span className={`text-[11px] font-bold ${isToday ? 'text-white bg-violet-600 rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                        {day.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 2).map(ev => {
                          const st = STATUS_CONFIG[ev.status]
                          return (
                            <Link key={ev.id} href={`/admin/traiteur/events/${ev.id}`}
                              title={ev.name}
                              className={`block truncate text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${st.bg} ${st.color}`}>
                              {ev.name}
                            </Link>
                          )
                        })}
                        {dayEvents.length > 2 && (
                          <span className="block text-[9px] text-gray-400 px-1.5">+{dayEvents.length - 2} أخرى</span>
                        )}
                        {isDoubleBooked && (
                          <span className="flex items-center gap-0.5 text-[8px] font-bold text-red-500 px-1.5">
                            <AlertCircle className="w-2.5 h-2.5" /> تعارض تواريخ
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Events list ── */}
      {view === 'list' && (filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد حفلات</p>
          <Link href="/admin/traiteur/events/new" className="mt-4 inline-flex items-center gap-1 text-violet-600 text-sm font-semibold hover:underline">
            <Plus className="w-4 h-4" /> أنشئ أول حفلة
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => {
            const st   = STATUS_CONFIG[ev.status]
            const tp   = TYPE_CONFIG[ev.type]
            const StIcon = st.icon
            const TpIcon = tp.icon
            return (
              <Link
                key={ev.id}
                href={`/admin/traiteur/events/${ev.id}`}
                className="block bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all p-5 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                        <StIcon className="w-3 h-3" /> {st.labelAr}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                        <TpIcon className="w-3 h-3" /> {tp.labelAr}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base truncate">{ev.name}</h3>

                    <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {fmtDate(ev.date)}
                      </span>
                      {ev.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.venue}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {ev._count.guests} / {ev.guestCount} ضيف
                      </span>
                      {ev.clientName && (
                        <span className="text-gray-400">{ev.clientName}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {ev.quotedPrice && (
                      <span className="text-sm font-bold text-gray-700">
                        {fmtMoney(ev.quotedPrice, currency)}
                      </span>
                    )}
                    {ev.commissionAmount && (
                      <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-2 py-0.5 rounded-full">
                        عمولة: {fmtMoney(ev.commissionAmount, currency)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors mt-auto" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
