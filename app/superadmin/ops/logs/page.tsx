'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ScrollText, Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  id: string; module: string; severity: Severity; message: string
  entity?: string; entityId?: string; performedBy?: string
  timestamp: string; source: string
}

interface LogPage { entries: LogEntry[]; total: number; page: number; pages: number }

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'السجلات الموحدة', subtitle: 'تصفية وتتبع أحداث المنصة',
    search: 'ابحث في السجلات...', refresh: 'تحديث',
    allModules: 'كل الوحدات', allSeverities: 'كل المستويات',
    module: 'الوحدة', severity: 'المستوى', message: 'الرسالة',
    performedBy: 'المنفِّذ', timestamp: 'الوقت', empty: 'لا توجد سجلات',
    prev: 'السابق', next: 'التالي', of: 'من',
  },
  en: {
    title: 'Unified Logs', subtitle: 'Filter and trace platform events',
    search: 'Search logs...', refresh: 'Refresh',
    allModules: 'All Modules', allSeverities: 'All Severities',
    module: 'Module', severity: 'Severity', message: 'Message',
    performedBy: 'Performed By', timestamp: 'Timestamp', empty: 'No log entries found',
    prev: 'Prev', next: 'Next', of: 'of',
  },
}
type Lang = keyof typeof T

const SEV_COLOR: Record<Severity, string> = {
  debug: 'text-zinc-500',
  info:  'text-blue-400',
  warn:  'text-amber-400',
  error: 'text-red-400',
}

export default function LogsPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [data,     setData]     = useState<LogPage | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [module,   setModule]   = useState('')
  const [severity, setSeverity] = useState('')
  const [page,     setPage]     = useState(1)
  const [modules,  setModules]  = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)   params.set('search',   search)
      if (module)   params.set('module',   module)
      if (severity) params.set('severity', severity)
      params.set('page', String(p))
      params.set('limit', '50')

      const res  = await fetch(`/api/superadmin/ops/logs?${params}`, { headers: header() })
      const json = await res.json()
      if (res.ok) setData(json)
    } finally {
      setLoading(false)
    }
  }, [header, search, module, severity, page])

  useEffect(() => {
    fetch('/api/superadmin/ops/logs/modules', { headers: header() })
      .then(r => r.json()).then(d => setModules(d.modules ?? [])).catch(() => null)
  }, [header])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); load(1) }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [search, module, severity])

  useEffect(() => { load(page) }, [page])

  const severities: Severity[] = ['debug', 'info', 'warn', 'error']

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={() => load(page)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600" />
        </div>

        <select value={module} onChange={e => setModule(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600">
          <option value="">{t.allModules}</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600">
          <option value="">{t.allSeverities}</option>
          {severities.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
              <th className="text-start px-4 py-3 font-medium">{t.severity}</th>
              <th className="text-start px-4 py-3 font-medium">{t.module}</th>
              <th className="text-start px-4 py-3 font-medium">{t.message}</th>
              <th className="text-start px-4 py-3 font-medium hidden sm:table-cell">{t.performedBy}</th>
              <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t.timestamp}</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map(entry => (
              <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium uppercase ${SEV_COLOR[entry.severity]}`}>{entry.severity}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">{entry.module}</span>
                </td>
                <td className="px-4 py-2.5 text-zinc-300 max-w-xs truncate">{entry.message}</td>
                <td className="px-4 py-2.5 text-zinc-500 text-xs hidden sm:table-cell">{entry.performedBy ?? '—'}</td>
                <td className="px-4 py-2.5 text-zinc-500 text-xs hidden md:table-cell">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
            {(!loading && (!data || data.entries.length === 0)) && (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-12">{t.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-400">
          <span>{data.total} entries — page {data.page} {t.of} {data.pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />{t.prev}
            </button>
            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-40 transition-colors">
              {t.next}<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
