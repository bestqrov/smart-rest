'use client'

import { useEffect, useState } from 'react'
import { Cake, Plus, X, Loader2, Phone, CalendarDays, Trash2, Pencil } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED'

interface CakeOrderRow {
  id: string
  clientName: string
  clientPhone: string
  description: string
  writingText: string
  referenceImageUrl: string | null
  pickupDate: string
  status: Status
  price: number | null
  depositPaid: number | null
  notes: string
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد', IN_PROGRESS: 'قيد التحضير',
  READY: 'جاهز', COMPLETED: 'تم التسليم', CANCELLED: 'ملغى',
}
const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700', READY: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-violet-50 text-violet-700', CANCELLED: 'bg-red-50 text-red-500',
}
const STATUS_ORDER: Status[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
}
function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM = {
  clientName: '', clientPhone: '', description: '', writingText: '',
  referenceImageUrl: '', pickupDate: '', price: '', depositPaid: '', notes: '',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CakeOrdersPage() {
  const [orders,  setOrders]  = useState<CakeOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<Status | 'ALL'>('ALL')

  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [saving,    setSaving]    = useState(false)

  const currency = typeof window !== 'undefined' ? (localStorage.getItem('currency') ?? 'MAD') : 'MAD'
  function auth() { return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' } }

  async function load() {
    setLoading(true)
    const r = await fetch('/api/cake-orders', { headers: auth() })
    if (r.ok) setOrders(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }
  function openEdit(o: CakeOrderRow) {
    setEditId(o.id)
    setForm({
      clientName: o.clientName, clientPhone: o.clientPhone, description: o.description,
      writingText: o.writingText, referenceImageUrl: o.referenceImageUrl ?? '',
      pickupDate: toDatetimeLocal(o.pickupDate),
      price: o.price != null ? String(o.price) : '', depositPaid: o.depositPaid != null ? String(o.depositPaid) : '',
      notes: o.notes,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.clientName.trim() || !form.description.trim() || !form.pickupDate) return
    setSaving(true)
    const url    = editId ? `/api/cake-orders/${editId}` : '/api/cake-orders'
    const method = editId ? 'PATCH' : 'POST'
    const body = {
      clientName:  form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      description: form.description.trim(),
      writingText: form.writingText.trim(),
      referenceImageUrl: form.referenceImageUrl.trim() || null,
      pickupDate:  new Date(form.pickupDate).toISOString(),
      price:       form.price.trim() ? Number(form.price) : null,
      depositPaid: form.depositPaid.trim() ? Number(form.depositPaid) : null,
      notes:       form.notes,
    }
    const r = await fetch(url, { method, headers: auth(), body: JSON.stringify(body) })
    if (r.ok) { await load(); setShowModal(false) }
    setSaving(false)
  }

  async function updateStatus(id: string, status: Status) {
    await fetch(`/api/cake-orders/${id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status }) })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('حذف هاد الطلبية؟')) return
    await fetch(`/api/cake-orders/${id}`, { method: 'DELETE', headers: auth() })
    await load()
  }

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" dir="rtl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">🎂 طلبيات الكاطو المسبقة</h1>
          <p className="text-sm text-gray-400 mt-0.5">أعياد ميلاد، أعراس، مناسبات — طلبيات مخصصة بتاريخ استلام</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> طلبية جديدة
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['ALL', ...STATUS_ORDER] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'ALL' ? 'الكل' : STATUS_LABELS[s]}
            {s !== 'ALL' && <span className="ml-1 opacity-70">({orders.filter(o => o.status === s).length})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Cake className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد طلبيات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <select value={o.status} onChange={e => updateStatus(o.id, e.target.value as Status)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 ${STATUS_COLORS[o.status]}`}>
                      {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{o.clientName}</h3>
                  <p className="text-sm text-gray-600 mt-1">{o.description}</p>
                  {o.writingText && <p className="text-xs text-violet-600 mt-1">✏️ "{o.writingText}"</p>}
                  <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {fmtDate(o.pickupDate)}</span>
                    {o.clientPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {o.clientPhone}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {o.price != null && <span className="text-sm font-bold text-gray-700">{o.price.toLocaleString()} {currency}</span>}
                  {o.depositPaid != null && o.depositPaid > 0 && (
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">عربون: {o.depositPaid.toLocaleString()} {currency}</span>
                  )}
                  <div className="flex items-center gap-1 mt-auto">
                    <button onClick={() => openEdit(o)} className="text-gray-400 hover:text-violet-600 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(o.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-lg">{editId ? 'تعديل الطلبية' : 'طلبية كاطو جديدة'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="اسم الزبون" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="text" value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                placeholder="الهاتف" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="الوصف (النكهة، الحجم، عدد الأشخاص...)" rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="text" value={form.writingText} onChange={e => setForm(f => ({ ...f, writingText: e.target.value }))}
                placeholder="الكتابة فوق الكاطو (اختياري)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="url" value={form.referenceImageUrl} onChange={e => setForm(f => ({ ...f, referenceImageUrl: e.target.value }))}
                placeholder="رابط صورة مرجعية (اختياري)" dir="ltr" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">تاريخ ووقت الاستلام</label>
                <input type="datetime-local" value={form.pickupDate} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder={`السومة (${currency})`} min="0" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <input type="number" value={form.depositPaid} onChange={e => setForm(f => ({ ...f, depositPaid: e.target.value }))}
                  placeholder={`العربون (${currency})`} min="0" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={save} disabled={saving || !form.clientName.trim() || !form.description.trim() || !form.pickupDate}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? 'حفظ التعديلات' : 'إنشاء الطلبية')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
