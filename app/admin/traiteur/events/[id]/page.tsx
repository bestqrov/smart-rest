'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  ArrowRight, Users, Plus, Trash2, Download, Printer,
  Loader2, CheckCircle2, QrCode, MapPin, CalendarDays,
  Phone, Upload, X, Lock, CheckCheck, TrendingUp, Wallet,
  AlertTriangle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Guest = {
  id: string; name: string; phone: string; email: string
  tableNumber: number | null; seatNumber: number | null
  dietaryReq: string; checkedIn: boolean; qrToken: string
}

type Event = {
  id: string; name: string; type: string; date: string
  venue: string; guestCount: number; status: string
  clientName: string; clientPhone: string; clientEmail: string
  quotedPrice: number | null; depositPaid: number | null
  actualAttendees: number | null; commissionAmount: number | null
  notes: string
  guests: Guest[]
}

type Card = {
  guestId: string; guestName: string; phone: string
  tableNumber: number | null; seatNumber: number | null
  dietaryReq: string; checkedIn: boolean; qrUrl: string; qrToken: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة', CONFIRMED: 'مؤكدة', ACTIVE: 'جارية',
  COMPLETED: 'منتهية', CANCELLED: 'ملغاة'
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-violet-50 text-violet-700',
  CANCELLED: 'bg-red-50 text-red-500'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [event,    setEvent]    = useState<Event | null>(null)
  const [cards,    setCards]    = useState<Card[]>([])
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'guests' | 'cards' | 'finance'>('guests')

  // add guest form
  const [showAddGuest,   setShowAddGuest]   = useState(false)
  const [addingGuest,    setAddingGuest]    = useState(false)
  const [guestName,      setGuestName]      = useState('')
  const [guestTable,     setGuestTable]     = useState('')
  const [guestSeat,      setGuestSeat]      = useState('')
  const [guestDietary,   setGuestDietary]   = useState('')
  const [guestPhone,     setGuestPhone]     = useState('')

  // bulk import
  const [bulkText,  setBulkText]  = useState('')
  const [showBulk,  setShowBulk]  = useState(false)
  const [importing, setImporting] = useState(false)

  // close event
  const [closing, setClosing] = useState(false)

  const currency = typeof window !== 'undefined' ? (localStorage.getItem('currency') ?? 'MAD') : 'MAD'

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/traiteur/events/${id}`, { headers: auth() })
    if (r.ok) {
      const data: Event = await r.json()
      setEvent(data)
    }
    setLoading(false)
  }

  async function loadCards() {
    const r = await fetch(`/api/traiteur/events/${id}/cards`, { headers: auth() })
    if (r.ok) {
      const data = await r.json()
      setCards(data.cards)
      // Generate QR images
      const imgs: Record<string, string> = {}
      for (const card of data.cards) {
        try {
          imgs[card.qrToken] = await QRCode.toDataURL(card.qrUrl, {
            width: 200, margin: 1,
            color: { dark: '#4c1d95', light: '#ffffff' }
          })
        } catch {}
      }
      setQrImages(imgs)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (tab === 'cards' && cards.length === 0) loadCards()
  }, [tab])

  async function addGuest() {
    if (!guestName.trim()) return
    setAddingGuest(true)
    const r = await fetch(`/api/traiteur/events/${id}/guests`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        guestName.trim(),
        phone:       guestPhone,
        tableNumber: guestTable ? Number(guestTable) : undefined,
        seatNumber:  guestSeat  ? Number(guestSeat)  : undefined,
        dietaryReq:  guestDietary,
      })
    })
    if (r.ok) {
      await load()
      setGuestName(''); setGuestPhone(''); setGuestTable(''); setGuestSeat(''); setGuestDietary('')
      setShowAddGuest(false)
    }
    setAddingGuest(false)
  }

  async function deleteGuest(guestId: string) {
    if (!confirm('حذف هذا الضيف؟')) return
    await fetch(`/api/traiteur/events/${id}/guests/${guestId}`, {
      method: 'DELETE', headers: auth()
    })
    await load()
  }

  async function bulkImport() {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return
    setImporting(true)

    // Format: "Name, tableNumber, seatNumber, dietaryReq" per line
    const guests = lines.map((line, i) => {
      const parts = line.split(',').map(p => p.trim())
      return {
        name:        parts[0] || `ضيف ${i + 1}`,
        tableNumber: parts[1] ? Number(parts[1]) : undefined,
        seatNumber:  parts[2] ? Number(parts[2]) : undefined,
        dietaryReq:  parts[3] ?? '',
      }
    })

    const r = await fetch(`/api/traiteur/events/${id}/guests/bulk`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests })
    })
    if (r.ok) {
      await load()
      setBulkText('')
      setShowBulk(false)
    }
    setImporting(false)
  }

  async function closeEvent() {
    if (!confirm('إغلاق الحفلة وحساب العمولة؟')) return
    setClosing(true)
    const r = await fetch(`/api/traiteur/events/${id}/close`, {
      method: 'POST', headers: auth()
    })
    if (r.ok) await load()
    setClosing(false)
  }

  function printCards() {
    if (cards.length === 0) { alert('حمّل البطاقات أولاً'); return }
    const w = window.open('', '_blank')!
    w.document.write(`
      <html><head><title>بطاقات الضيوف — ${event?.name}</title>
      <style>
        body { margin:0; font-family: 'Cairo', sans-serif; background:#fff; direction:rtl; }
        .grid { display:flex; flex-wrap:wrap; gap:12px; padding:16px; }
        .card {
          border: 1px solid #7c3aed; border-radius:16px; padding:16px;
          width:180px; text-align:center; break-inside:avoid;
          background: linear-gradient(135deg,#f5f3ff,#fff);
        }
        .card img { width:140px; height:140px; border-radius:8px; }
        .name { font-weight:900; font-size:15px; color:#4c1d95; margin-top:8px; }
        .event { font-size:11px; color:#7c3aed; margin-top:2px; }
        .seat { font-size:11px; color:#6b7280; margin-top:4px; }
        .diet { font-size:10px; color:#d97706; margin-top:3px; background:#fef3c7; padding:2px 6px; border-radius:20px; display:inline-block; }
        @media print { @page { margin:6mm; } }
      </style></head><body>
      <div class="grid">
    `)
    cards.forEach(card => {
      const img = qrImages[card.qrToken] || ''
      w.document.write(`
        <div class="card">
          <img src="${img}" alt="${card.guestName}" />
          <div class="name">${card.guestName}</div>
          <div class="event">${event?.name}</div>
          <div class="seat">
            ${card.tableNumber ? `طاولة ${card.tableNumber}` : ''}
            ${card.seatNumber ? ` · مقعد ${card.seatNumber}` : ''}
          </div>
          ${card.dietaryReq ? `<div class="diet">${card.dietaryReq}</div>` : ''}
        </div>
      `)
    })
    w.document.write('</div></body></html>')
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  )

  if (!event) return (
    <div className="p-6 text-center text-gray-400">الحفلة غير موجودة</div>
  )

  const checkedIn = event.guests.filter(g => g.checkedIn).length

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/traiteur" className="text-gray-400 hover:text-violet-600 mt-1 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status] ?? ''}`}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900">{event.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {fmtDate(event.date)}</span>
              {event.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.venue}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.guests.length} ضيف</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {checkedIn} حضر</span>
            </div>
          </div>
        </div>

        {event.status !== 'COMPLETED' && event.status !== 'CANCELLED' && (
          <button
            onClick={closeEvent}
            disabled={closing}
            className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors shrink-0"
          >
            {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            إغلاق الحفلة
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['guests',  `الضيوف (${event.guests.length})`],
          ['cards',   'بطاقات QR'],
          ['finance', 'المالية'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: GUESTS */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'guests' && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddGuest(!showAddGuest)}
              className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة ضيف
            </button>
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 hover:border-violet-400 px-3 py-2 rounded-xl font-semibold transition-colors"
            >
              <Upload className="w-4 h-4" /> استيراد جماعي
            </button>
          </div>

          {/* Add guest form */}
          {showAddGuest && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-violet-800 text-sm">ضيف جديد</h3>
                <button onClick={() => setShowAddGuest(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={guestName}  onChange={e => setGuestName(e.target.value)}  placeholder="الاسم *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="الهاتف"  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input type="number" value={guestTable} onChange={e => setGuestTable(e.target.value)} placeholder="رقم الطاولة" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input type="number" value={guestSeat}  onChange={e => setGuestSeat(e.target.value)}  placeholder="رقم المقعد"  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={guestDietary} onChange={e => setGuestDietary(e.target.value)} placeholder="حمية خاصة (نباتي...)" className="col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <button
                onClick={addGuest}
                disabled={addingGuest || !guestName.trim()}
                className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors"
              >
                {addingGuest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                إضافة
              </button>
            </div>
          )}

          {/* Bulk import */}
          {showBulk && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-800 text-sm">استيراد جماعي</h3>
                <button onClick={() => setShowBulk(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <p className="text-xs text-amber-700">سطر لكل ضيف: <code className="bg-amber-100 px-1 rounded">الاسم, رقم الطاولة, رقم المقعد, حمية</code></p>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                rows={6}
                placeholder={`يوسف إدريسي, 1, 1\nفاطمة بوزيدي, 1, 2, نباتي\nخالد العمري, 2, 1`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-400 resize-none"
              />
              <button
                onClick={bulkImport}
                disabled={importing || !bulkText.trim()}
                className="flex items-center gap-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                استيراد
              </button>
            </div>
          )}

          {/* Guest list */}
          {event.guests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>لا يوجد ضيوف بعد</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500">الاسم</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">الطاولة</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">المقعد</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">الحضور</th>
                    <th className="px-3 py-2.5 text-xs font-bold text-gray-500">الحمية</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {event.guests.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{g.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{g.tableNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{g.seatNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {g.checkedIn
                          ? <CheckCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                        }
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-700">
                        {g.dietaryReq || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => deleteGuest(g.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: QR CARDS */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {cards.length} بطاقة · اطبعها وضعها على كل مقعد
            </p>
            <div className="flex gap-2">
              <button
                onClick={loadCards}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:border-violet-400 px-3 py-1.5 rounded-xl font-semibold transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" /> تحديث
              </button>
              <button
                onClick={printCards}
                className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-xl font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> طباعة الكل
              </button>
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>أضف ضيوفاً أولاً ثم حمّل البطاقات</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {cards.map(card => (
                <div key={card.guestId} className={`rounded-2xl border p-4 text-center transition-all ${
                  card.checkedIn ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 hover:border-violet-200'
                }`}>
                  {qrImages[card.qrToken] ? (
                    <img src={qrImages[card.qrToken]} alt={card.guestName} className="w-full rounded-xl mb-3" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  <p className="font-bold text-gray-900 text-xs leading-tight truncate">{card.guestName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {card.tableNumber ? `ط${card.tableNumber}` : ''}
                    {card.seatNumber  ? ` · م${card.seatNumber}` : ''}
                  </p>
                  {card.dietaryReq && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      {card.dietaryReq}
                    </span>
                  )}
                  {card.checkedIn && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full mt-1 inline-flex items-center gap-0.5 mx-auto">
                      <CheckCheck className="w-2.5 h-2.5" /> حضر
                    </span>
                  )}
                  {qrImages[card.qrToken] && (
                    <a
                      href={qrImages[card.qrToken]}
                      download={`${card.guestName}.png`}
                      className="mt-2 text-[10px] text-violet-600 hover:text-violet-800 flex items-center gap-0.5 justify-center"
                    >
                      <Download className="w-2.5 h-2.5" /> تحميل
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: FINANCE */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-500" /> المبالغ
              </h3>
              {[
                ['سعر العرض الإجمالي', event.quotedPrice],
                ['العربون المستلم',    event.depositPaid],
                ['الرصيد المتبقي',
                  event.quotedPrice && event.depositPaid
                    ? event.quotedPrice - event.depositPaid
                    : null
                ],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold text-gray-800">
                    {val !== null ? `${Number(val).toLocaleString()} ${currency}` : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 space-y-3">
              <h3 className="font-bold text-violet-800 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" /> عمولة SmartTraiteur
              </h3>
              {event.status === 'COMPLETED' ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-violet-600">الحضور الفعلي</span>
                    <span className="font-bold text-violet-800">{event.actualAttendees ?? 0} ضيف</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-violet-600">العمولة المحسوبة</span>
                    <span className="font-bold text-violet-800 text-base">
                      {event.commissionAmount?.toLocaleString() ?? 0} {currency}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تُحسب العمولة عند إغلاق الحفلة</span>
                </div>
              )}
            </div>

          </div>

          {event.clientName && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
              <h3 className="font-bold text-gray-800 text-sm">العميل</h3>
              <p className="text-sm text-gray-700 font-semibold">{event.clientName}</p>
              {event.clientPhone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {event.clientPhone}
                </p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
