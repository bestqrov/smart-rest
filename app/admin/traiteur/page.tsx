'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Users, TrendingUp, Plus, ChevronRight,
  Loader2, RefreshCw, Clock, MapPin, CheckCircle2,
  AlertCircle, Star, Briefcase, Cake, Coffee, Utensils
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function TraiteurDashboard() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats,  setStats]  = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<EventStatus | 'ALL'>('ALL')

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

      {/* ── Events list ── */}
      {filtered.length === 0 ? (
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
      )}
    </div>
  )
}
