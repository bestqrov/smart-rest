'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Store, TrendingUp, Brain, Megaphone, Clock, DollarSign,
  ShieldCheck, AlertTriangle, Zap, Activity, ArrowRight,
  CheckCircle2, XCircle, Loader2, RefreshCw, Wifi, WifiOff,
} from 'lucide-react'
import { useSAAuth } from './context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashData {
  overview:  { totalCafes: number; activeCafes: number; suspendedCafes: number; trialCafes: number; totalRevenue: number; mrr: number } | null
  aiStats:   { running: number; queued: number; completedToday: number; failedToday: number; avgCost: number; avgTokens: number } | null
  recentJobs: any[]
}

// ─── Utility components ───────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, href,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; href?: string
}) {
  const inner = (
    <div className={`bg-zinc-900 border rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-zinc-600 group ${
      href ? 'cursor-pointer' : ''
    } ${color === 'purple' ? 'border-purple-800/40' :
       color === 'emerald' ? 'border-emerald-800/40' :
       color === 'blue'    ? 'border-blue-800/40' :
       color === 'amber'   ? 'border-amber-800/40' :
       color === 'red'     ? 'border-red-800/40' : 'border-zinc-800'}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          color === 'purple' ? 'bg-purple-950 text-purple-400' :
          color === 'emerald'? 'bg-emerald-950 text-emerald-400' :
          color === 'blue'   ? 'bg-blue-950 text-blue-400' :
          color === 'amber'  ? 'bg-amber-950 text-amber-400' :
          color === 'red'    ? 'bg-red-950 text-red-400' : 'bg-zinc-800 text-zinc-400'
        }`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {href && <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />}
      </div>
      <div>
        <p className="text-2xl font-black text-white tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-zinc-800 rounded-xl animate-pulse ${className ?? 'h-24'}`} />
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const JOB_BADGE: Record<string, string> = {
  QUEUED:    'bg-amber-900/60 text-amber-300',
  RUNNING:   'bg-blue-900/60 text-blue-300',
  COMPLETED: 'bg-emerald-900/60 text-emerald-300',
  FAILED:    'bg-red-900/60 text-red-300',
  CANCELLED: 'bg-zinc-800 text-zinc-500',
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { header } = useSAAuth()
  const [data,    setData]    = useState<DashData>({ overview: null, aiStats: null, recentJobs: [] })
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = header()
      const [ovRes, aiRes, jobsRes] = await Promise.all([
        fetch('/api/superadmin/billing/overview',   { headers: h }),
        fetch('/api/superadmin/ai-jobs/stats',      { headers: h }),
        fetch('/api/superadmin/ai-jobs?limit=8',    { headers: h }),
      ])
      setData({
        overview:   ovRes.ok   ? await ovRes.json()                    : null,
        aiStats:    aiRes.ok   ? await aiRes.json()                    : null,
        recentJobs: jobsRes.ok ? (await jobsRes.json()).jobs ?? []     : [],
      })
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load, refresh])

  const ov  = data.overview
  const ai  = data.aiStats

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Platform Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">SmartRestau Enterprise OS · Real-time</p>
        </div>
        <button
          onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Business KPIs ── */}
      <Section title="Business">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading && !ov ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <KpiCard
              label="Total Restaurants" icon={Store} color="purple" href="/superadmin/restaurants"
              value={ov?.totalCafes ?? '—'}
              sub={ov ? `${ov.activeCafes} active · ${ov.trialCafes} trial` : undefined}
            />
            <KpiCard
              label="Monthly Revenue" icon={TrendingUp} color="emerald" href="/superadmin/billing"
              value={ov ? `$${ov.mrr.toLocaleString()}` : '—'}
              sub="MRR (all countries)"
            />
            <KpiCard
              label="Suspended" icon={AlertTriangle} color="red" href="/superadmin/restaurants"
              value={ov?.suspendedCafes ?? '—'}
              sub="Require attention"
            />
            <KpiCard
              label="Marketing Campaigns" icon={Megaphone} color="amber" href="/superadmin/marketing"
              value="—"
              sub="AI-generated content"
            />
          </>)}
        </div>
      </Section>

      {/* ── AI Center KPIs ── */}
      <Section title="Artificial Intelligence">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading && !ai ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <KpiCard
              label="AI Jobs Running" icon={Brain} color="blue" href="/superadmin/ai-center"
              value={ai?.running ?? '—'}
              sub={`${ai?.queued ?? 0} queued`}
            />
            <KpiCard
              label="Completed Today" icon={CheckCircle2} color="emerald" href="/superadmin/ai-center"
              value={ai?.completedToday ?? '—'}
              sub="Successful generations"
            />
            <KpiCard
              label="Failed Today" icon={XCircle} color="red" href="/superadmin/ai-center"
              value={ai?.failedToday ?? '—'}
              sub="Require investigation"
            />
            <KpiCard
              label="Today's AI Cost" icon={DollarSign} color="purple" href="/superadmin/ai-center"
              value={ai?.avgCost ? `$${(ai.avgCost).toFixed(4)}` : '—'}
              sub={ai?.avgTokens ? `${ai.avgTokens.toLocaleString()} avg tokens` : 'Per generation avg'}
            />
          </>)}
        </div>
      </Section>

      {/* ── Placeholder sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Billing snapshot */}
        <Section title="Billing Snapshot">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            {ov ? (<>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Total Revenue</span>
                <span className="font-bold text-white">${ov.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">MRR</span>
                <span className="font-bold text-emerald-400">${ov.mrr.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">ARR (est.)</span>
                <span className="font-bold text-zinc-300">${(ov.mrr * 12).toLocaleString()}</span>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Active clients</span>
                <span className="font-bold text-white">{ov.activeCafes}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Trial</span>
                <span className="font-bold text-amber-400">{ov.trialCafes}</span>
              </div>
            </>) : (
              <p className="text-zinc-600 text-sm text-center py-4">No data</p>
            )}
            <Link href="/superadmin/billing"
              className="flex items-center justify-between text-xs text-zinc-500 hover:text-purple-400 transition-colors pt-1">
              View Billing <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Section>

        {/* AI Provider Status */}
        <Section title="Provider Health">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            {[
              { name: 'Google Gemini', status: 'operational', latency: '–' },
              { name: 'OpenAI GPT-4', status: 'standby',     latency: '–' },
              { name: 'Anthropic',    status: 'standby',     latency: '–' },
            ].map(p => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {p.status === 'operational'
                    ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    : <WifiOff className="w-3.5 h-3.5 text-zinc-600" />
                  }
                  <span className={p.status === 'operational' ? 'text-zinc-300' : 'text-zinc-600'}>{p.name}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.status === 'operational' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-zinc-800 text-zinc-600'
                }`}>{p.status}</span>
              </div>
            ))}
            <div className="h-px bg-zinc-800" />
            <Link href="/superadmin/ai-center"
              className="flex items-center justify-between text-xs text-zinc-500 hover:text-purple-400 transition-colors pt-1">
              AI Center <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Section>

        {/* Coming soon placeholders */}
        <Section title="Trust & Certification">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            {[
              { label: 'Certificates Issued',  value: '—', icon: ShieldCheck, color: 'text-emerald-400' },
              { label: 'Expiring This Month',  value: '—', icon: Clock,       color: 'text-amber-400' },
              { label: 'Automation Workflows', value: '—', icon: Zap,         color: 'text-blue-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                  <span className="text-zinc-500">{row.label}</span>
                </div>
                <span className="font-bold text-zinc-600">{row.value}</span>
              </div>
            ))}
            <div className="h-px bg-zinc-800" />
            <Link href="/superadmin/certification"
              className="flex items-center justify-between text-xs text-zinc-500 hover:text-purple-400 transition-colors pt-1">
              Certification <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Section>
      </div>

      {/* ── Recent AI Jobs ── */}
      <Section title="Recent AI Jobs" action={
        <Link href="/superadmin/ai-center" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      }>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {loading && data.recentJobs.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-16 h-5" />
                  <Skeleton className="flex-1 h-5" />
                  <Skeleton className="w-12 h-5" />
                </div>
              ))}
            </div>
          ) : data.recentJobs.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 text-sm">No AI jobs yet</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {data.recentJobs.map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${JOB_BADGE[job.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                    {job.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{job.module} / {job.jobType}</p>
                    {job.inputReference && <p className="text-[10px] text-zinc-600 truncate">{job.inputReference}</p>}
                  </div>
                  {job.provider && (
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">{job.provider}</span>
                  )}
                  <div className="text-right shrink-0">
                    {job.estimatedCost ? (
                      <p className="text-xs text-zinc-400">${job.estimatedCost.toFixed(4)}</p>
                    ) : null}
                    <p className="text-[10px] text-zinc-700">{new Date(job.queuedAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Activity timeline placeholder ── */}
      <Section title="Recent Activity">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="space-y-3">
            {[
              { icon: Store,    color: 'text-purple-400', label: 'Unified activity timeline', sub: 'Coming soon — will show restaurant events, AI generations, billing, certifications' },
              { icon: Activity, color: 'text-blue-400',   label: 'Real-time event feed',       sub: 'Across all SmartRestau OS modules' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm text-zinc-400 font-medium">{item.label}</p>
                  <p className="text-xs text-zinc-600">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

    </div>
  )
}
