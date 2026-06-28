'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ShieldCheck, Search, RefreshCw, Loader2, CheckCircle2,
  XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Zap, BarChart3, Award, TrendingUp, ArrowRight,
} from 'lucide-react'
import { useSAAuth } from '../context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

interface CertSummary {
  level: Level; percentage: number; score: number; maxScore: number
  status: string; evaluatedAt: string; expiresAt: string; version: string
}

interface Row {
  cafeId: string; cafeName: string; subdomain: string; billingStatus: string
  certification: CertSummary | null
}

interface Stats {
  total: number; completed: number; expired: number; byLevel: Record<string, number>
}

interface PageData { rows: Row[]; total: number; page: number; stats: Stats }

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<Level, { color: string; bg: string; border: string; emoji: string }> = {
  NONE:     { color: 'text-zinc-500',   bg: 'bg-zinc-800',    border: 'border-zinc-700',   emoji: '—'  },
  BRONZE:   { color: 'text-amber-400',  bg: 'bg-amber-950',   border: 'border-amber-800',  emoji: '🥉' },
  SILVER:   { color: 'text-slate-300',  bg: 'bg-slate-800',   border: 'border-slate-600',  emoji: '🥈' },
  GOLD:     { color: 'text-yellow-400', bg: 'bg-yellow-950',  border: 'border-yellow-800', emoji: '🥇' },
  PLATINUM: { color: 'text-violet-400', bg: 'bg-violet-950',  border: 'border-violet-800', emoji: '💜' },
  DIAMOND:  { color: 'text-sky-400',    bg: 'bg-sky-950',     border: 'border-sky-800',    emoji: '💎' },
}

const LEVELS: Level[] = ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}
function isExpired(iso: string) { return new Date(iso) < new Date() }

function LevelBadge({ level }: { level: Level | null }) {
  if (!level) return <span className="text-zinc-600 text-xs">—</span>
  const cfg = LEVEL_CONFIG[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.emoji} {level}
    </span>
  )
}

function ScoreBar({ pct, level }: { pct: number; level: Level }) {
  const color =
    level === 'DIAMOND'  ? 'bg-sky-400' :
    level === 'PLATINUM' ? 'bg-violet-400' :
    level === 'GOLD'     ? 'bg-yellow-400' :
    level === 'SILVER'   ? 'bg-slate-400' :
    level === 'BRONZE'   ? 'bg-amber-500' : 'bg-zinc-600'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 tabular-nums">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total Evaluated', value: stats.total,     icon: BarChart3,    color: 'text-zinc-400' },
        { label: 'Completed',       value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: 'Expired',         value: stats.expired,   icon: AlertTriangle, color: 'text-amber-400' },
        { label: 'Gold+',
          value: (stats.byLevel['GOLD'] ?? 0) + (stats.byLevel['PLATINUM'] ?? 0) + (stats.byLevel['DIAMOND'] ?? 0),
          icon: Award, color: 'text-yellow-400' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <p className="text-2xl font-black text-white tabular-nums">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Level distribution ───────────────────────────────────────────────────────

function LevelDistribution({ stats }: { stats: Stats | null }) {
  if (!stats || !stats.byLevel || Object.keys(stats.byLevel).length === 0) return null
  const total = Object.values(stats.byLevel).reduce((s, v) => s + v, 0) || 1
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
      <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">Level Distribution</p>
      <div className="flex gap-2 h-2 rounded-full overflow-hidden">
        {LEVELS.filter(l => l !== 'NONE').map(lvl => {
          const count = stats.byLevel[lvl] ?? 0
          const pct = (count / total) * 100
          if (pct === 0) return null
          const cfg = LEVEL_CONFIG[lvl]
          const fill = lvl === 'DIAMOND' ? 'bg-sky-400' : lvl === 'PLATINUM' ? 'bg-violet-400' : lvl === 'GOLD' ? 'bg-yellow-400' : lvl === 'SILVER' ? 'bg-slate-400' : 'bg-amber-500'
          return <div key={lvl} className={`${fill} rounded-full`} style={{ width: `${pct}%` }} title={`${lvl}: ${count}`} />
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {LEVELS.filter(l => l !== 'NONE' && (stats.byLevel[l] ?? 0) > 0).map(lvl => {
          const cfg = LEVEL_CONFIG[lvl]
          return (
            <span key={lvl} className={`text-xs ${cfg.color}`}>
              {cfg.emoji} {lvl} <span className="text-zinc-600">({stats.byLevel[lvl]})</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminCertificationPage() {
  const { header } = useSAAuth()

  const [data, setData]             = useState<PageData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [levelFilter, setLevel]     = useState<Level | ''>('')
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [evaluating, setEvaluating] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulk]      = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const searchTimeout               = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (p = 1, q = search, lvl = levelFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25', search: q })
      if (lvl) params.set('level', lvl)
      const res = await fetch(`/api/superadmin/certification?${params}`, { headers: header() })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [header, search, levelFilter])

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(1); load(1, search, levelFilter) }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search, levelFilter])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const evaluateSingle = async (tenantId: string, cafeName: string) => {
    setEvaluating(prev => new Set(prev).add(tenantId))
    try {
      const res = await fetch(`/api/superadmin/certification/${tenantId}/evaluate`, {
        method: 'POST', headers: header(),
      })
      const body = await res.json()
      if (res.ok) {
        setToast({ msg: `${cafeName} → ${body.result?.level ?? 'done'}`, ok: true })
        await load(page)
      } else {
        setToast({ msg: body.error ?? 'Evaluation failed', ok: false })
      }
    } catch {
      setToast({ msg: 'Network error', ok: false })
    } finally {
      setEvaluating(prev => { const s = new Set(prev); s.delete(tenantId); return s })
    }
  }

  const bulkEvaluate = async () => {
    if (selected.size === 0) return
    setBulk(true)
    try {
      const res = await fetch('/api/superadmin/certification/bulk-evaluate', {
        method: 'POST',
        headers: { ...header(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIds: Array.from(selected) }),
      })
      const body = await res.json()
      if (res.ok) {
        setToast({ msg: `${body.succeeded}/${body.total} evaluated`, ok: true })
        setSelected(new Set())
        await load(page)
      } else {
        setToast({ msg: body.error ?? 'Bulk evaluation failed', ok: false })
      }
    } catch {
      setToast({ msg: 'Network error', ok: false })
    } finally {
      setBulk(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleAll = () => {
    if (!data) return
    const allIds = data.rows.map(r => r.cafeId)
    const allSelected = allIds.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  const rows   = data?.rows ?? []
  const stats  = data?.stats ?? null
  const total  = data?.total ?? 0
  const pages  = Math.ceil(total / 25)

  return (
    <div className="p-6 min-h-screen bg-zinc-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Certification Management</h1>
            <p className="text-xs text-zinc-500">Monitor and evaluate all restaurant certifications</p>
          </div>
        </div>
        <button
          onClick={() => load(page)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <StatsBar stats={stats} />
      <LevelDistribution stats={stats} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search restaurants…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <select
          value={levelFilter}
          onChange={e => setLevel(e.target.value as Level | '')}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
        >
          <option value="">All levels</option>
          {LEVELS.map(l => (
            <option key={l} value={l}>{LEVEL_CONFIG[l].emoji} {l}</option>
          ))}
        </select>
        {selected.size > 0 && (
          <button
            onClick={bulkEvaluate}
            disabled={bulkRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50"
          >
            {bulkRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Evaluate {selected.size} selected
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-start">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every(r => selected.has(r.cafeId))}
                  onChange={toggleAll}
                  className="rounded accent-violet-500"
                />
              </th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide">Restaurant</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide">Level</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide">Score</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Evaluated</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Expires</th>
              <th className="px-4 py-3 text-end text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-600 mx-auto" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-600 text-sm">
                  No restaurants found
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const cert    = row.certification
              const expired = cert ? isExpired(cert.expiresAt) : false
              const isEval  = evaluating.has(row.cafeId)
              return (
                <tr
                  key={row.cafeId}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${selected.has(row.cafeId) ? 'bg-violet-950/20' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.cafeId)}
                      onChange={() => toggleSelect(row.cafeId)}
                      className="rounded accent-violet-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{row.cafeName}</p>
                    <p className="text-xs text-zinc-500">{row.subdomain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadge level={cert?.level ?? null} />
                    {expired && cert && (
                      <span className="block text-[10px] text-amber-500 mt-0.5">expired</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cert ? <ScoreBar pct={cert.percentage} level={cert.level} /> : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-500">
                    {cert ? fmtDate(cert.evaluatedAt) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-500">
                    {cert
                      ? <span className={expired ? 'text-amber-500' : ''}>{fmtDate(cert.expiresAt)}</span>
                      : '—'
                    }
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => evaluateSingle(row.cafeId, row.cafeName)}
                      disabled={isEval}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium hover:border-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isEval ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      Evaluate
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <span>{total} restaurants</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p) }}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-30 hover:border-zinc-600 transition-colors"
            >
              ← Prev
            </button>
            <span className="tabular-nums">{page} / {pages}</span>
            <button
              onClick={() => { const p = Math.min(pages, page + 1); setPage(p); load(p) }}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-30 hover:border-zinc-600 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
