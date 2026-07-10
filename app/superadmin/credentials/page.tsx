'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Search, Loader2, Mail, ShieldAlert, Send, CheckCircle2 } from 'lucide-react'
import { useSAAuth } from '../context'

type DirUser = { id: string; email: string; forcePasswordChange: boolean }
type DirCafe = {
  id: string; name: string; businessName: string; subdomain: string
  country: string; billingStatus: string; isDemo: boolean
  users: DirUser[]
}

export default function CredentialsPage() {
  const { header } = useSAAuth()

  const [q,        setQ]        = useState('')
  const [cafes,    setCafes]    = useState<DirCafe[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState<string | null>(null)
  const [sent,     setSent]     = useState<Record<string, boolean>>({})

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100', ...(query ? { q: query } : {}) })
      const res = await fetch(`/api/superadmin/credentials-directory?${params}`, { headers: header() })
      if (res.ok) {
        const d = await res.json()
        setCafes(d.cafes ?? [])
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-black text-xl">Credentials</h1>
          <p className="text-zinc-500 text-xs">إيميلات الدخول ديال كل الرستورانات/الكليان · {total} حساب</p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-amber-300 text-xs leading-relaxed">
          كلمات السر مخزنة مشفرة (hashed) وما ممكنش تتعرض كيفما هي. باش تعاون كليان نسا كلمة السر، صيفط ليه
          كلمة مرور مؤقتة (صالحة 10 دقائق) بالإيميل.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="قلب على رستوران، subdomain، ولا إيميل…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
        ) : cafes.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">لا توجد نتائج</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {cafes.map(cafe => (
              <div key={cafe.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{cafe.businessName || cafe.name}</p>
                    <p className="text-zinc-500 text-xs">{cafe.subdomain} · {cafe.country}{cafe.isDemo ? ' · DEMO' : ''}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 shrink-0">
                    {cafe.billingStatus}
                  </span>
                </div>
                {cafe.users.length === 0 ? (
                  <p className="text-zinc-700 text-xs italic">لا يوجد مستخدم مرتبط</p>
                ) : (
                  <div className="space-y-1.5">
                    {cafe.users.map(u => (
                      <div key={u.id} className="flex items-center justify-between gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-zinc-300 text-xs truncate">{u.email}</span>
                        </div>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
