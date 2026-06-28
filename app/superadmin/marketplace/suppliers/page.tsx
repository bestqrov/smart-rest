'use client'

import { useEffect, useState, useCallback } from 'react'
import { Truck, Plus, Edit2, RefreshCw, Star, X, Check } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string; company: string; contact: string; email: string
  phone?: string; country: string; rating: number; notes?: string
  status: string; productCount: number; createdAt: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الموردون', subtitle: 'إدارة موردي المنتجات',
    add: 'إضافة مورد', refresh: 'تحديث', loading: 'جاري التحميل...',
    company: 'الشركة', contact: 'المسؤول', email: 'البريد', phone: 'الهاتف',
    country: 'الدولة', rating: 'التقييم', status: 'الحالة', products: 'المنتجات',
    actions: 'إجراءات', save: 'حفظ', cancel: 'إلغاء', edit: 'تعديل',
    notes: 'ملاحظات', optional: 'اختياري', noSuppliers: 'لا يوجد موردون',
    STATUS: { ACTIVE: 'نشط', INACTIVE: 'غير نشط', BLOCKED: 'محظور' } as Record<string, string>,
    allStatus: 'كل الحالات',
  },
  en: {
    title: 'Suppliers', subtitle: 'Manage product suppliers',
    add: 'Add Supplier', refresh: 'Refresh', loading: 'Loading...',
    company: 'Company', contact: 'Contact', email: 'Email', phone: 'Phone',
    country: 'Country', rating: 'Rating', status: 'Status', products: 'Products',
    actions: 'Actions', save: 'Save', cancel: 'Cancel', edit: 'Edit',
    notes: 'Notes', optional: 'optional', noSuppliers: 'No suppliers found',
    STATUS: { ACTIVE: 'Active', INACTIVE: 'Inactive', BLOCKED: 'Blocked' } as Record<string, string>,
    allStatus: 'All Status',
  },
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-900 text-green-300',
  INACTIVE: 'bg-zinc-700 text-zinc-400',
  BLOCKED: 'bg-red-900 text-red-400',
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-700'}`} />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [lang, setLang]           = useState<'ar' | 'en'>('ar')
  const { header } = useSAAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({ company: '', contact: '', email: '', phone: '', country: '', rating: 3, notes: '' })
  const t = T[lang]
  const isRTL = lang === 'ar'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res  = await fetch(`/api/superadmin/marketplace/suppliers${params}`, { headers: header() })
      const json = await res.json()
      setSuppliers(json.suppliers ?? [])
    } finally { setLoading(false) }
  }, [header, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const l = localStorage.getItem('lang') as 'ar' | 'en' | null
    if (l) setLang(l)
  }, [])

  function startEdit(s: Supplier) {
    setEditId(s.id)
    setForm({ company: s.company, contact: s.contact, email: s.email, phone: s.phone ?? '', country: s.country, rating: s.rating, notes: s.notes ?? '' })
  }

  async function save() {
    setSaving(true)
    try {
      if (editId) {
        await fetch(`/api/superadmin/marketplace/suppliers/${editId}`, {
          method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        setEditId(null)
      } else {
        await fetch('/api/superadmin/marketplace/suppliers', {
          method: 'POST', headers: { ...header(), 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        setShowForm(false)
      }
      setForm({ company: '', contact: '', email: '', phone: '', country: '', rating: 3, notes: '' })
      load()
    } finally { setSaving(false) }
  }

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/superadmin/marketplace/suppliers/${id}/status`, {
      method: 'PATCH', headers: { ...header(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const FormGrid = ({ isNew }: { isNew: boolean }) => (
    <div className={`${isNew ? 'bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6' : ''}`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { key: 'company', label: t.company, required: true },
          { key: 'contact', label: t.contact, required: true },
          { key: 'email',   label: t.email,   required: true },
          { key: 'phone',   label: t.phone,   required: false },
          { key: 'country', label: t.country, required: true },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs text-zinc-400 mb-1 block">{f.label}{f.required ? ' *' : ''}</label>
            <input value={(form as any)[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
          </div>
        ))}
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">{t.rating} (1–5)</label>
          <input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm(x => ({ ...x, rating: Number(e.target.value) }))}
            className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="text-xs text-zinc-400 mb-1 block">{t.notes} ({t.optional})</label>
          <textarea value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))} rows={2}
            className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm border border-zinc-700 text-zinc-100" />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={save} disabled={saving || !form.company || !form.contact || !form.email}
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-sm font-medium disabled:opacity-50">{t.save}</button>
        <button onClick={() => { setShowForm(false); setEditId(null) }} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">{t.cancel}</button>
      </div>
    </div>
  )

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Truck className="w-7 h-7 text-orange-400" />{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100">
            <option value="">{t.allStatus}</option>
            {['ACTIVE','INACTIVE','BLOCKED'].map(s => <option key={s} value={s}>{t.STATUS[s]}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => { setShowForm(s => !s); setEditId(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />{t.add}
          </button>
        </div>
      </div>

      {showForm && !editId && <FormGrid isNew />}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
              <th className="px-4 py-3 text-start">{t.company}</th>
              <th className="px-4 py-3 text-start hidden md:table-cell">{t.email}</th>
              <th className="px-4 py-3 text-start hidden lg:table-cell">{t.country}</th>
              <th className="px-4 py-3 text-start hidden md:table-cell">{t.rating}</th>
              <th className="px-4 py-3 text-start">{t.status}</th>
              <th className="px-4 py-3 text-start hidden xl:table-cell">{t.products}</th>
              <th className="px-4 py-3 text-end">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />{t.loading}
              </td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">{t.noSuppliers}</td></tr>
            ) : suppliers.map(s => (
              <>
                <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{s.company}</div>
                    <div className="text-xs text-zinc-500">{s.contact}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{s.email}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden lg:table-cell">{s.country}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><StarRating value={s.rating} /></td>
                  <td className="px-4 py-3">
                    <select value={s.status} onChange={e => changeStatus(s.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border-0 ${STATUS_COLOR[s.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                      {['ACTIVE','INACTIVE','BLOCKED'].map(st => <option key={st} value={st}>{t.STATUS[st]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden xl:table-cell">{s.productCount}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => editId === s.id ? setEditId(null) : startEdit(s)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded">
                      <Edit2 className="w-4 h-4" /></button>
                  </td>
                </tr>
                {editId === s.id && (
                  <tr key={`${s.id}-edit`}>
                    <td colSpan={7} className="px-4 py-3 bg-zinc-800/60">
                      <FormGrid isNew={false} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
