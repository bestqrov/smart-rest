'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Link2, Unlink, Loader2 } from 'lucide-react'
import { useSAAuth } from '../context'

interface Cafe {
  id: string; name: string; businessName: string | null; subdomain: string
  planId: string | null; parentCafeId: string | null; isDemo: boolean
}

const label = (c: Cafe) => `${c.businessName || c.name} (${c.subdomain})`

export default function SABranchesPage() {
  const { header, secret } = useSAAuth()
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [loading, setLoading] = useState(true)
  const [parentId, setParentId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/superadmin/branches', { headers: header() })
      if (r.ok) setCafes((await r.json()).cafes ?? [])
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]) // header() is rebuilt every render; key on the secret instead
  useEffect(() => { load() }, [load])

  const enterprise = useMemo(() => cafes.filter(c => c.planId === 'ENTERPRISE' && !c.parentCafeId), [cafes])
  const linkable   = useMemo(() => cafes.filter(c => !c.parentCafeId && c.id !== parentId && !cafes.some(x => x.parentCafeId === c.id)), [cafes, parentId])
  const groups = useMemo(() => {
    const byParent = new Map<string, Cafe[]>()
    for (const c of cafes) if (c.parentCafeId) byParent.set(c.parentCafeId, [...(byParent.get(c.parentCafeId) ?? []), c])
    return [...byParent.entries()].map(([pid, kids]) => ({ parent: cafes.find(c => c.id === pid), kids }))
  }, [cafes])

  async function call(path: string, body: object, okText: string) {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(path, { method: 'POST', headers: header(), body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? `خطأ ${r.status}` }); return }
      setMsg({ ok: true, text: okText }); setBranchId(''); await load()
    } finally { setBusy(false) }
  }

  return (
    <div dir="rtl" className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-blue-500" />الفروع</h1>
        <p className="text-sm text-gray-400 mt-1">اربط مطعماً كفرع تابع لمطعم رئيسي. المطعم الرئيسي يجب أن يكون على باقة الأعمال (ENTERPRISE).</p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-400">المطعم الرئيسي</span>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
              <option value="">— اختر —</option>
              {enterprise.map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}
            </select>
            {!loading && enterprise.length === 0 && <span className="text-xs text-amber-400">لا يوجد مطعم على باقة الأعمال بعد.</span>}
          </label>
          <label className="block text-sm">
            <span className="text-gray-400">الفرع</span>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} disabled={!parentId} className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 disabled:opacity-50">
              <option value="">— اختر —</option>
              {linkable.map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}
            </select>
          </label>
        </div>
        <button disabled={!parentId || !branchId || busy}
          onClick={() => call('/api/superadmin/branches/link', { parentCafeId: parentId, branchCafeId: branchId }, 'تم ربط الفرع')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} ربط
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">المجموعات الحالية</h2>
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> :
         groups.length === 0 ? <p className="text-sm text-gray-500">لا توجد فروع مربوطة.</p> :
         groups.map(g => (
          <div key={g.parent?.id ?? 'x'} className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <p className="font-medium">{g.parent ? label(g.parent) : '—'}</p>
            <ul className="mt-2 space-y-1">
              {g.kids.map(k => (
                <li key={k.id} className="flex items-center justify-between text-sm text-gray-300">
                  <span>↳ {label(k)}</span>
                  <button disabled={busy} onClick={() => confirm(`فك ربط ${label(k)}؟`) && call('/api/superadmin/branches/unlink', { branchCafeId: k.id }, 'تم فك الربط')}
                    className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50">
                    <Unlink className="w-3.5 h-3.5" /> فك الربط
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
