'use client'

import { useState } from 'react'
import { ScanSearch, CheckCircle2, AlertTriangle, XCircle, Play, Loader2 } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagStatus = 'passed' | 'warning' | 'error'

interface DiagCheck {
  name: string; category: string; status: DiagStatus
  message: string; value?: string | number; recommendation?: string; durationMs: number
}

interface DiagReport {
  runAt: string; durationMs: number; passed: number; warnings: number; errors: number
  checks: DiagCheck[]; recommendations: string[]
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'التشخيص', subtitle: 'فحص شامل لجميع مكونات المنصة',
    run: 'تشغيل الفحص', running: 'جاري الفحص...',
    passed: 'ناجح', warnings: 'تحذيرات', errors: 'أخطاء',
    duration: 'المدة', recommendations: 'التوصيات',
    category: { connectivity: 'الاتصال', resources: 'الموارد', configuration: 'الإعداد', data: 'البيانات', security: 'الأمان' },
    empty: 'اضغط "تشغيل الفحص" لبدء الفحص الكامل للمنصة.',
  },
  en: {
    title: 'Diagnostics', subtitle: 'Full platform check suite',
    run: 'Run Diagnostics', running: 'Running checks...',
    passed: 'Passed', warnings: 'Warnings', errors: 'Errors',
    duration: 'Duration', recommendations: 'Recommendations',
    category: { connectivity: 'Connectivity', resources: 'Resources', configuration: 'Configuration', data: 'Data', security: 'Security' },
    empty: 'Press "Run Diagnostics" to run a full platform check.',
  },
}
type Lang = keyof typeof T

const STATUS_STYLE: Record<DiagStatus, { color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  passed:  { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: CheckCircle2 },
  warning: { color: 'text-amber-400',   bg: 'bg-amber-950/30',   border: 'border-amber-800/40',   icon: AlertTriangle },
  error:   { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: XCircle },
}

export default function DiagnosticsPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [report,  setReport]  = useState<DiagReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function run() {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/superadmin/system/diagnostics', { method: 'POST', headers: header() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReport(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? t.running : t.run}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <ScanSearch className="w-10 h-10 mb-3 text-zinc-700" />
          <p className="text-sm">{t.empty}</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: t.passed,   value: report.passed,   color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
              { label: t.warnings, value: report.warnings, color: 'text-amber-400',   bg: 'bg-amber-950/40' },
              { label: t.errors,   value: report.errors,   color: 'text-red-400',     bg: 'bg-red-950/40' },
              { label: t.duration, value: `${report.durationMs}ms`, color: 'text-zinc-300', bg: 'bg-zinc-900' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-zinc-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-4 mb-5">
              <div className="text-amber-400 text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />{t.recommendations}
              </div>
              <ul className="space-y-1">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="text-zinc-300 text-xs flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Checks */}
          <div className="space-y-2">
            {report.checks.map((check, i) => {
              const s    = STATUS_STYLE[check.status]
              const Icon = s.icon
              return (
                <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 ${s.color} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium">{check.name}</span>
                        <span className="text-zinc-600 text-xs">
                          {(t.category as any)[check.category] ?? check.category}
                        </span>
                        <span className="text-zinc-600 text-xs">{check.durationMs}ms</span>
                      </div>
                      <div className="text-zinc-400 text-xs mt-0.5">{check.message}</div>
                      {check.recommendation && (
                        <div className="text-amber-500/80 text-xs mt-1">↳ {check.recommendation}</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
