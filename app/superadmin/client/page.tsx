'use client'

import { useCallback, useEffect, useState } from 'react'
import { Contact, Search, Loader2, Send, CheckCircle2, Trash2, Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import { useSAAuth } from '../context'

type ClientUser = { id: string; email: string; forcePasswordChange?: boolean }
type Client = {
  id: string; name: string; businessName: string; subdomain: string
  country: string; city: string; billingStatus: string; isDemo: boolean
  ownerPhone: string; ownerEmail: string
  users: ClientUser[]
}

// Mongo ObjectId embeds its creation timestamp in the first 8 hex chars.
function createdAtOf(id: string): Date {
  return new Date(parseInt(id.substring(0, 8), 16) * 1000)
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:        'bg-emerald-900/40 text-emerald-400',
  TRIAL:         'bg-blue-900/40 text-blue-400',
  GRACE_PERIOD:  'bg-amber-900/40 text-amber-400',
  PAST_DUE:      'bg-orange-900/40 text-orange-400',
  SUSPENDED:     'bg-red-900/40 text-red-400',
  COLLECTING_DEBT: 'bg-purple-900/40 text-purple-300',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:          'نشط',
  TRIAL:           'تجريبي',
  GRACE_PERIOD:    'فترة تجريبية',
  PAST_DUE:        'متأخر',
  SUSPENDED:       'موقوف',
  COLLECTING_DEBT: 'قيد التحصيل',
}

export default function ClientPage() {
  const { header } = useSAAuth()

  const [q,       setQ]       = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sent,    setSent]    = useState<Record<string, boolean>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100', ...(query ? { q: query } : {}) })
      const res = await fetch(`/api/superadmin/credentials-directory?${params}`, { headers: header() })
      if (res.ok) {
        const d = await res.json()
        setClients(d.cafes ?? [])
        setTotal(d.total ?? 0)
      }
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(q), 350)
    return () => clearTimeout(t)
  }, [q, load])

  async function resetPassword(userId: string) {
    if (!confirm('إرسال كلمة مرور مؤقتة (صالحة 10 دقائق) لهذا الإيميل؟')) return
    setSending(userId)
    try {
      const res = await fetch(`/api/superadmin/users/${userId}/reset-password`, {
        method: 'POST', headers: header(),
      })
      if (!res.ok) { alert('فشل الإرسال'); return }
      setSent(s => ({ ...s, [userId]: true }))
      setTimeout(() => setSent(s => ({ ...s, [userId]: false })), 5000)
    } finally { setSending(null) }
  }

  async function deleteClient(id: string) {
    setDeleting(true)
    try {
      const r = await fetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE', headers: header() })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        console.error('delete tenant failed', r.status, d)
        alert('تعذّر حذف المطعم — لم يتم أي تغيير. حاول مرة أخرى.')
        return
      }
      setDeleteConfirm(null)
      load(q)
    } catch {
      alert('تعذّر الاتصال بالخادم — لم يتم حذف المطعم.')
    } finally { setDeleting(false) }
  }

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
          <Contact className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-black text-xl">حسابات الدخول</h1>
          <p className="text-zinc-500 text-xs">قائمة حسابات دخول المطاعم · {total} مطعم</p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-amber-300 text-xs leading-relaxed">
          كلمات المرور مخزّنة بشكل مشفّر ولا يمكن عرضها. لمساعدة عميل نسي كلمة المرور، أرسل له
          كلمة مرور مؤقتة (صالحة 10 دقائق) عبر البريد الإلكتروني.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-zinc-600 absolute start-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="ابحث باسم المطعم أو النطاق الفرعي أو البريد الإلكتروني أو رقم الهاتف…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-10 pe-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
        ) : clients.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">لا توجد نتائج</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                  <th className="text-start font-semibold px-5 py-3">المطعم</th>
                  <th className="text-start font-semibold px-5 py-3">البريد الإلكتروني</th>
                  <th className="text-start font-semibold px-5 py-3">كلمة المرور</th>
                  <th className="text-start font-semibold px-5 py-3">حالة الدفع</th>
                  <th className="text-start font-semibold px-5 py-3">تاريخ الإنشاء</th>
                  <th className="text-start font-semibold px-5 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {clients.flatMap(client => {
                  const rows = client.users.length > 0 ? client.users : [null]
                  return rows.map((u, i) => (
                    <tr key={u ? u.id : `${client.id}-${i}`} className="hover:bg-zinc-800/30">
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top">
                          <p className="text-white font-bold truncate max-w-[220px]">
                            {client.businessName || client.name}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            {client.subdomain} · {client.city ? `${client.city}، ` : ''}{client.country}{client.isDemo ? ' · تجريبي' : ''}
                          </p>
                          {client.ownerPhone && (
                            <a href={`https://wa.me/${client.ownerPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs mt-1" dir="ltr">
                              <MessageCircle className="w-3.5 h-3.5" /> {client.ownerPhone}
                            </a>
                          )}
                          {client.ownerEmail && (
                            <span className="flex items-center gap-1.5 text-zinc-400 text-xs mt-1">
                              <Mail className="w-3.5 h-3.5" /> {client.ownerEmail}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3 text-zinc-300">{u ? u.email : <span className="text-zinc-700 italic">لا يوجد مستخدم</span>}</td>
                      <td className="px-5 py-3">
                        {u && (
                          <button
                            onClick={() => resetPassword(u.id)}
                            disabled={sending === u.id}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0 transition-all ${
                              sent[u.id] ? 'bg-emerald-700 text-white' : 'bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50'
                            }`}
                          >
                            {sending === u.id ? <Loader2 className="w-3 h-3 animate-spin" />
                              : sent[u.id] ? <CheckCircle2 className="w-3 h-3" />
                              : <Send className="w-3 h-3" />}
                            {sent[u.id] ? 'تم الإرسال' : 'كلمة مرور مؤقتة'}
                          </button>
                        )}
                      </td>
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[client.billingStatus] ?? 'bg-zinc-800 text-zinc-400'}`}>
                            {STATUS_LABEL[client.billingStatus] ?? client.billingStatus}
                          </span>
                        </td>
                      )}
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top text-zinc-400 text-xs whitespace-nowrap">
                          {createdAtOf(client.id).toLocaleDateString('ar')}
                        </td>
                      )}
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top">
                          <button
                            onClick={() => setDeleteConfirm(client)}
                            disabled={client.isDemo}
                            title={client.isDemo ? 'حساب تجريبي محمي' : ''}
                            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0 bg-red-900/40 hover:bg-red-800 text-red-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            <Trash2 className="w-3 h-3" /> حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div dir="rtl" className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-base">حذف نهائي</h3>
                <p className="text-gray-400 text-xs mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-red-300 font-bold text-sm">{deleteConfirm.businessName || deleteConfirm.name}</p>
              <p className="text-red-500 text-xs mt-1">
                سيتم حذف المطعم وحسابات المستخدمين والطلبات والقائمة والطاولات والموظفين وكل السجلات المرتبطة به.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold">
                إلغاء
              </button>
              <button onClick={() => deleteClient(deleteConfirm.id)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
