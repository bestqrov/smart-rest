'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, WifiOff, Clock } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unavailable'

interface ModuleHealth {
  module: string; label: string; status: HealthStatus
  latencyMs?: number; message?: string; checkedAt: string
  details?: Record<string, unknown>
}

interface SystemHealth {
  overall: HealthStatus; modules: ModuleHealth[]
  checkedAt: string; uptimeMs: number
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'صحة النظام', subtitle: 'حالة جميع الوحدات في الوقت الفعلي',
    refresh: 'تحديث', latency: 'زمن الاستجابة', uptime: 'وقت التشغيل',
    overall: 'الحالة العامة', checkedAt: 'آخر فحص',
    healthy: 'سليم', warning: 'تحذير', critical: 'حرج', unavailable: 'غير متاح',
    loading: 'جاري تحميل الحالة...',
  },
  en: {
    title: 'System Health', subtitle: 'Real-time status of all modules',
    refresh: 'Refresh', latency: 'Latency', uptime: 'Uptime',
    overall: 'Overall Status', checkedAt: 'Last checked',
    healthy: 'Healthy', warning: 'Warning', critical: 'Critical', unavailable: 'Unavailable',
    loading: 'Loading health status...',
  },
}
type Lang = keyof typeof T

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

const STATUS_CONFIG: Record<HealthStatus, { color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  healthy:     { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: CheckCircle2 },
  warning:     { color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/50',   icon: AlertTriangle },
  critical:    { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: XCircle },
  unavailable: { color: 'text-zinc-500',    bg: 'bg-zinc-900/40',    border: 'border-zinc-700',       icon: WifiOff },
}

export default function HealthPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [health,  setHealth]  = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/superadmin/system/health', { headers: header() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHealth(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [header])

  useEffect(() => { load() }, [load])

  const overall = health?.overall ?? 'unavailable'
  const OvCfg   = STATUS_CONFIG[overall]
  const OvIcon  = OvCfg.icon

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {loading && !health && (
        <div className="text-zinc-500 text-center py-16">{t.loading}</div>
      )}

      {health && (
        <>
          {/* Overall status banner */}
          <div className={`${OvCfg.bg} border ${OvCfg.border} rounded-2xl p-5 mb-6 flex items-center gap-4 flex-wrap`}>
            <OvIcon className={`w-8 h-8 ${OvCfg.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-lg font-bold ${OvCfg.color}`}>
                {t[overall as keyof typeof t] ?? overall}
              </div>
              <div className="text-zinc-400 text-sm mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.uptime}: {formatUptime(health.uptimeMs)}</span>
                <span>{t.checkedAt}: {new Date(health.checkedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Module grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {health.modules.map(mod => {
              const cfg  = STATUS_CONFIG[mod.status]
              const Icon = cfg.icon
              return (
                <div key={mod.module} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-white text-sm">{mod.label}</div>
                    <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                  </div>
                  <div className="text-xs text-zinc-400">{mod.message}</div>
                  {mod.latencyMs !== undefined && (
                    <div className="mt-2 text-xs text-zinc-500">{t.latency}: {mod.latencyMs}ms</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
