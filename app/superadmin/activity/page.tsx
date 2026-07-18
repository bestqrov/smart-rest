'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSAAuth } from '../context'

type AuditRow = {
  id: string
  module: string
  entity: string
  entityId: string
  action: string
  performedBy: string
  timestamp: string
  metadata?: Record<string, unknown>
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '—'
  try {
    return Object.entries(meta)
      .filter(([k]) => k !== 'tenantId')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ')
  } catch { return '—' }
}

export default function ActivityLogPage() {
  const { header } = useSAAuth()

  const [rows,    setRows]    = useState<AuditRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [page,    setPage]    = useState(1)
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [moduleF,      setModuleF]      = useState('')
  const [actionF,       setActionF]      = useState('')
  const [performedByF,  setPerformedByF] = useState('')

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' })
      if (moduleF)      params.set('module', moduleF)
      if (actionF)      params.set('action', actionF)
      if (performedByF) params.set('performedBy', performedByF)
      const res = await fetch(`/api/superadmin/audit-logs?${params}`, { headers: header() })
      if (res.ok) {
        const d = await res.json()
        setRows(d.items ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
      }
    } finally { setLoading(false) }
  }, [header, moduleF, actionF, performedByF])

  useEffect(() => {
    fetch('/api/superadmin/audit-logs/modules', { headers: header() })
      .then(r => r.ok ? r.json() : { modules: [] })
      .then(d => setModules(d.modules ?? []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setPage(1); load(1) }, [moduleF, actionF, performedByF]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-black text-xl">Activity Log</h1>
          <p className="text-zinc-500 text-xs">سجل كل التغييرات عبر المنصة (Billing، Marketplace، Certification، AI Copilot…) · {total} حدث</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <Filter className="w-4 h-4 text-zinc-600 shrink-0" />
        <select
          value={moduleF} onChange={e => setModuleF(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">كل الموديلات</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          value={actionF} onChange={e => setActionF(e.target.value)}
          placeholder="Action (e.g. CREATE, SUSPEND)"
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <input
          value={performedByF} onChange={e => setPerformedByF(e.target.value)}
          placeholder="Performed by (user id / email)"
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">ماكاينش أحداث</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="px-4 py-2.5 font-semibold">Time</th>
                  <th className="px-4 py-2.5 font-semibold">Module</th>
                  <th className="px-4 py-2.5 font-semibold">Entity</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">By</th>
                  <th className="px-4 py-2.5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-zinc-800/60 text-zinc-300 hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2.5"><span className="bg-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">{r.module}</span></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.entity} <span className="text-zinc-600">#{r.entityId.slice(-6)}</span></td>
                    <td className="px-4 py-2.5 font-bold">{r.action}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{r.performedBy}</td>
                    <td className="px-4 py-2.5 text-zinc-500 max-w-xs truncate" title={formatMeta(r.metadata)}>{formatMeta(r.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 disabled:opacity-30"
          ><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-zinc-500">{page} / {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 disabled:opacity-30"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}
