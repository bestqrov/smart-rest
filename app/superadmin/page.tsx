'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Store, TrendingUp, Brain, DollarSign, Wallet,
  AlertTriangle, ArrowLeft, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react'
import { useSAAuth } from './context'

// ─── Types ────────────────────────────────────────────────────────────────────

type CurAmount = { currency: string; amount: number; invoices?: number }

// Per-currency list, never summed across currencies, never "$".
function fmtByCurrency(rows?: CurAmount[]): string {
  const nz = (rows ?? []).filter(r => r.amount)
  if (nz.length === 0) return '0'
  return nz.map(r => `${Math.round(r.amount).toLocaleString('en-US')} ${r.currency}`).join(' · ')
}

interface DashData {
  overview:  {
    totalCafes: number; activeCafes: number; suspendedCafes: number; trialCafes: number
    platformRevenue?: { allTime: CurAmount[]; thisMonth: CurAmount[] }
    restaurantSales?: CurAmount[]
  } | null
  mrr:       { totalMRR_USD: number; computedAt: string } | null
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
        {href && <ArrowLeft className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />}
      </div>
      <div>
        <p className="text-2xl font-black text-white tabular-nums" dir="ltr" style={{ textAlign: 'right' }}>{value}</p>
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
        <h2 className="text-xs font-bold text-zinc-500 tracking-wide">{title}</h2>
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

const JOB_LABEL: Record<string, string> = {
  QUEUED: 'في الانتظار', RUNNING: 'قيد التنفيذ', COMPLETED: 'مكتمل', FAILED: 'فشل', CANCELLED: 'ملغى',
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { header } = useSAAuth()
  const [data,    setData]    = useState<DashData>({ overview: null, mrr: null, aiStats: null, recentJobs: [] })
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = header()
      const [ovRes, mrrRes, aiRes, jobsRes] = await Promise.all([
        fetch('/api/superadmin/billing/overview',   { headers: h }),
        fetch('/api/superadmin/mrr-breakdown',      { headers: h }),
        fetch('/api/superadmin/ai-jobs/stats',      { headers: h }),
        fetch('/api/superadmin/ai-jobs?limit=8',    { headers: h }),
      ])
      setData({
        overview:   ovRes.ok   ? await ovRes.json()                    : null,
        mrr:        mrrRes.ok  ? await mrrRes.json()                   : null,
        aiStats:    aiRes.ok   ? await aiRes.json()                    : null,
        recentJobs: jobsRes.ok ? (await jobsRes.json()).jobs ?? []     : [],
      })
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load, refresh])

  const ov  = data.overview
  const ai  = data.aiStats
  const mrr = data.mrr

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">نظرة عامة على المنصة</h1>
          <p className="text-xs text-zinc-500 mt-0.5">SmartRestau · بيانات مباشرة</p>
        </div>
        <button
          onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* ── Business KPIs ── */}
      <Section title="الأعمال">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {loading && !ov ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <KpiCard
              label="إجمالي المطاعم" icon={Store} color="purple" href="/superadmin/restaurants"
              value={ov?.totalCafes ?? '—'}
              sub={ov ? `${ov.activeCafes} نشط · ${ov.trialCafes} في فترة تجريبية` : undefined}
            />
            <KpiCard
              label="الإيراد الشهري المتكرر (تقديري)" icon={TrendingUp} color="emerald" href="/superadmin/restaurants"
              value={mrr ? `${Math.round(mrr.totalMRR_USD).toLocaleString('en-US')} USD` : '—'}
              sub="USD تقديري — حسب حجم الطلبات والعمولات"
            />
            <KpiCard
              label="مطاعم موقوفة" icon={AlertTriangle} color="red" href="/superadmin/restaurants"
              value={ov?.suspendedCafes ?? '—'}
              sub="تتطلب المتابعة"
            />
          </>)}
        </div>
      </Section>

      {/* ── Money ── */}
      <Section title="المال" action={
        <Link href="/superadmin/billing" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
          الفوترة <ArrowLeft className="w-3 h-3" />
        </Link>
      }>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {loading && !ov ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <KpiCard
              label="مداخيل المنصة هذا الشهر" icon={Wallet} color="emerald"
              value={ov ? fmtByCurrency(ov.platformRevenue?.thisMonth) : '—'}
              sub="فواتير مدفوعة من المطاعم للمنصة"
            />
            <KpiCard
              label="مداخيل المنصة (الإجمالي)" icon={DollarSign} color="blue"
              value={ov ? fmtByCurrency(ov.platformRevenue?.allTime) : '—'}
              sub={ov ? `${(ov.platformRevenue?.allTime ?? []).reduce((n, r) => n + (r.invoices ?? 0), 0)} فاتورة مدفوعة` : undefined}
            />
            <KpiCard
              label="مبيعات المطاعم لزبائنها" icon={Store} color="zinc"
              value={ov ? fmtByCurrency(ov.restaurantSales) : '—'}
              sub="ليست مداخيل للمنصة — مجموع طلبات الزبائن المدفوعة"
            />
          </>)}
        </div>
      </Section>

      {/* ── AI Center KPIs ── */}
      <Section title="الذكاء الاصطناعي">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading && !ai ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <KpiCard
              label="مهام قيد التنفيذ" icon={Brain} color="blue" href="/superadmin/ai-center"
              value={ai?.running ?? '—'}
              sub={`${ai?.queued ?? 0} في الانتظار`}
            />
            <KpiCard
              label="مكتملة اليوم" icon={CheckCircle2} color="emerald" href="/superadmin/ai-center"
              value={ai?.completedToday ?? '—'}
              sub="عمليات توليد ناجحة"
            />
            <KpiCard
              label="فاشلة اليوم" icon={XCircle} color="red" href="/superadmin/ai-center"
              value={ai?.failedToday ?? '—'}
              sub="تتطلب الفحص"
            />
            <KpiCard
              label="متوسط تكلفة التوليد" icon={DollarSign} color="purple" href="/superadmin/ai-center"
              value={ai?.avgCost ? `${(ai.avgCost).toFixed(4)} USD` : '—'}
              sub={ai?.avgTokens ? `متوسط ${ai.avgTokens.toLocaleString('en-US')} رمز` : 'متوسط لكل عملية توليد'}
            />
          </>)}
        </div>
      </Section>

      {/* ── Recent AI Jobs ── */}
      <Section title="آخر مهام الذكاء الاصطناعي" action={
        <Link href="/superadmin/ai-center" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
          عرض الكل <ArrowLeft className="w-3 h-3" />
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
            <div className="py-10 text-center text-zinc-600 text-sm">لا توجد مهام بعد</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {data.recentJobs.map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${JOB_BADGE[job.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                    {JOB_LABEL[job.status] ?? job.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{job.module} / {job.jobType}</p>
                    {job.inputReference && <p className="text-[10px] text-zinc-600 truncate">{job.inputReference}</p>}
                  </div>
                  {job.provider && (
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">{job.provider}</span>
                  )}
                  <div className="text-end shrink-0">
                    {job.estimatedCost ? (
                      <p className="text-xs text-zinc-400">{job.estimatedCost.toFixed(4)} USD</p>
                    ) : null}
                    <p className="text-[10px] text-zinc-700">{new Date(job.queuedAt).toLocaleTimeString('ar')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

    </div>
  )
}
