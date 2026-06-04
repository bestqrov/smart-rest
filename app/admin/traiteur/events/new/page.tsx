'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, CalendarDays, MapPin, Users, Phone, Mail, Wallet } from 'lucide-react'

const EVENT_TYPES = [
  { value: 'WEDDING',   labelAr: '💍 زفاف'        },
  { value: 'CORPORATE', labelAr: '🏢 شركة / مؤتمر' },
  { value: 'BIRTHDAY',  labelAr: '🎂 عيد ميلاد'  },
  { value: 'REUNION',   labelAr: '☕ لقاء / اجتماع' },
  { value: 'GALA',      labelAr: '🎭 حفل رسمي'   },
  { value: 'OTHER',     labelAr: '📋 أخرى'         },
]

export default function NewEventPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [form, setForm] = useState({
    name:        '',
    type:        'WEDDING',
    date:        '',
    venue:       '',
    guestCount:  '',
    clientName:  '',
    clientPhone: '',
    clientEmail: '',
    quotedPrice: '',
    depositPaid: '',
    notes:       '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.date) {
      setError('اسم الحفلة والتاريخ إلزاميان')
      return
    }
    setSaving(true)
    setError('')

    const r = await fetch('/api/traiteur/events', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ...form,
        guestCount:  form.guestCount  ? Number(form.guestCount)  : 0,
        quotedPrice: form.quotedPrice ? Number(form.quotedPrice) : undefined,
        depositPaid: form.depositPaid ? Number(form.depositPaid) : undefined,
      })
    })

    if (r.ok) {
      const ev = await r.json()
      router.push(`/admin/traiteur/events/${ev.id}`)
    } else {
      const body = await r.json().catch(() => ({}))
      setError(body.error || 'فشل إنشاء الحفلة')
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/traiteur" className="text-gray-400 hover:text-violet-600 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">حفلة جديدة</h1>
          <p className="text-xs text-gray-400">أدخل تفاصيل المناسبة</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">

        {/* Event type */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <label className="block text-sm font-bold text-gray-700 mb-3">نوع المناسبة</label>
          <div className="grid grid-cols-3 gap-2">
            {EVENT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('type', t.value)}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                  form.type === t.value
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'border-gray-200 text-gray-700 hover:border-violet-300'
                }`}
              >
                {t.labelAr}
              </button>
            ))}
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-800 text-sm">معلومات الحفلة</h2>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">اسم الحفلة *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="مثال: زفاف إدريسي — البيضاء"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> التاريخ *
              </label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Users className="w-3 h-3" /> عدد الضيوف المتوقع
              </label>
              <input
                type="number"
                min="1"
                value={form.guestCount}
                onChange={e => set('guestCount', e.target.value)}
                placeholder="200"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
              <MapPin className="w-3 h-3" /> المكان / القاعة
            </label>
            <input
              value={form.venue}
              onChange={e => set('venue', e.target.value)}
              placeholder="مثال: قاعة الأطلس، الدار البيضاء"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="معلومات إضافية عن الحفلة..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>
        </div>

        {/* Client info */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-800 text-sm">معلومات العميل</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">اسم العميل</label>
            <input
              value={form.clientName}
              onChange={e => set('clientName', e.target.value)}
              placeholder="مثال: الأستاذ يوسف إدريسي"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Phone className="w-3 h-3" /> الهاتف
              </label>
              <input
                value={form.clientPhone}
                onChange={e => set('clientPhone', e.target.value)}
                placeholder="+212 6XX XXX XXX"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Mail className="w-3 h-3" /> البريد
              </label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={e => set('clientEmail', e.target.value)}
                placeholder="client@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" /> المالية
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">سعر العرض الإجمالي</label>
              <input
                type="number"
                min="0"
                value={form.quotedPrice}
                onChange={e => set('quotedPrice', e.target.value)}
                placeholder="50000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">العربون المستلم</label>
              <input
                type="number"
                min="0"
                value={form.depositPaid}
                onChange={e => set('depositPaid', e.target.value)}
                placeholder="10000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl transition-colors shadow-sm text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
          {saving ? 'جارٍ الإنشاء...' : 'إنشاء الحفلة'}
        </button>
      </form>
    </div>
  )
}
