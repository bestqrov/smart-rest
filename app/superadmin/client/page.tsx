'use client'

import { useCallback, useEffect, useState } from 'react'
import { Contact, Search, Loader2, Send, CheckCircle2 } from 'lucide-react'
import { useSAAuth } from '../context'

type ClientUser = { id: string; email: string }
type Client = {
  id: string; name: string; businessName: string; subdomain: string
  billingStatus: string; isActive: boolean; isDemo: boolean
  createdAt: string
  users: ClientUser[]
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:        'bg-emerald-900/40 text-emerald-400',
  TRIAL:         'bg-blue-900/40 text-blue-400',
  GRACE_PERIOD:  'bg-amber-900/40 text-amber-400',
  PAST_DUE:      'bg-orange-900/40 text-orange-400',
  SUSPENDED:     'bg-red-900/40 text-red-400',
}

export default function ClientPage() {
  const { header } = useSAAuth()

  const [q,       setQ]       = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sent,    setSent]    = useState<Record<string, boolean>>({})

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100', ...(query ? { q: query } : {}) })
      const res = await fetch(`/api/superadmin/clients?${params}`, { headers: header() })
      if (res.ok) {
        const d = await res.json()
        setClients(d.clients ?? [])
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
          <Contact className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-black text-xl">Clients</h1>
          <p className="text-zinc-500 text-xs">لائحة كل الكليان · {total} رستوران</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="قلب على رستوران، subdomain ولا إيميل…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
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
                  <th className="text-left font-semibold px-5 py-3">Restaurant</th>
                  <th className="text-left font-semibold px-5 py-3">Email</th>
                  <th className="text-left font-semibold px-5 py-3">Password</th>
                  <th className="text-left font-semibold px-5 py-3">Payment</th>
                  <th className="text-left font-semibold px-5 py-3">Created</th>
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
                            {client.subdomain}{client.isDemo ? ' · DEMO' : ''}
                          </p>
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
                            {sent[u.id] ? 'تصيفطات' : 'مدق مؤقت'}
                          </button>
                        )}
                      </td>
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[client.billingStatus] ?? 'bg-zinc-800 text-zinc-400'}`}>
                            {client.billingStatus}
                          </span>
                        </td>
                      )}
                      {i === 0 && (
                        <td rowSpan={rows.length} className="px-5 py-3 align-top text-zinc-400 text-xs whitespace-nowrap">
                          {new Date(client.createdAt).toLocaleDateString()}
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
    </div>
  )
}
