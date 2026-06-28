'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldAlert, RefreshCw, Users, AlertTriangle, Activity, TrendingUp, ShieldCheck } from 'lucide-react'
import { useSAAuth } from '../../context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityOverview {
  activeSessions: number
  fraudAlerts: { pending: number; total: number; recent: number }
  auditActivity: { last24h: number; last7d: number; topModules: { module: string; count: number }[] }
  suspiciousPatterns: string[]
  securityScore: number
  generatedAt: string
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'الأمان', subtitle: 'التنبيهات والجلسات والنشاط المشبوه',
    refresh: 'تحديث', score: 'نقاط الأمان',
    activeSessions: 'الجلسات النشطة', fraudAlerts: 'تنبيهات الاحتيال',
    pending: 'قيد الانتظار', total: 'الإجمالي', recent: 'حديثاً',
    auditActivity: 'نشاط التدقيق', last24h: 'آخر 24 ساعة', last7d: 'آخر 7 أيام',
    topModules: 'أكثر الوحدات نشاطاً', suspicious: 'أنماط مشبوهة',
    noSuspicious: 'لا توجد أنماط مشبوهة حالياً', loading: 'جاري التحميل...',
  },
  en: {
    title: 'Security', subtitle: 'Alerts, sessions, and suspicious activity',
    refresh: 'Refresh', score: 'Security Score',
    activeSessions: 'Active Sessions', fraudAlerts: 'Fraud Alerts',
    pending: 'Pending', total: 'Total', recent: 'Recent (1h)',
    auditActivity: 'Audit Activity', last24h: 'Last 24h', last7d: 'Last 7d',
    topModules: 'Top Active Modules', suspicious: 'Suspicious Patterns',
    noSuspicious: 'No suspicious patterns detected', loading: 'Loading...',
  },
}
type Lang = keyof typeof T

function ScoreRing({ score }: { score: number }) {
  const r  = 40
  const c  = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="50" y="56" textAnchor="middle" fill={color} fontSize="16" fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>
        {score}
      </text>
    </svg>
  )
}

export default function SecurityPage() {
  const lang: Lang = 'ar'
  const t   = T[lang]
  const isRTL = lang === 'ar'

  const { header } = useSAAuth()
  const [data,    setData]    = useState<SecurityOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/superadmin/ops/security', { headers: header() })
      const json = await res.json()
      if (res.ok) setData(json)
    } finally { setLoading(false) }
  }, [header])

  useEffect(() => { load() }, [load])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {!data && <div className="text-zinc-500 text-center py-16">{t.loading}</div>}

      {data && (
        <div className="space-y-6">
          {/* Top row: score + sessions + fraud */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Security Score */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-3">
              <ScoreRing score={data.securityScore} />
              <div className="text-zinc-400 text-sm text-center">{t.score}</div>
            </div>

            {/* Active Sessions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <Users className="w-4 h-4" />{t.activeSessions}
              </div>
              <div className="text-3xl font-bold text-white">{data.activeSessions}</div>
            </div>

            {/* Fraud Alerts */}
            <div className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col gap-2 ${
              data.fraudAlerts.pending > 0 ? 'border-red-800/50' : 'border-zinc-800'
            }`}>
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <AlertTriangle className={`w-4 h-4 ${data.fraudAlerts.pending > 0 ? 'text-red-400' : ''}`} />
                {t.fraudAlerts}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t.pending, value: data.fraudAlerts.pending, color: data.fraudAlerts.pending > 0 ? 'text-red-400' : 'text-white' },
                  { label: t.total,   value: data.fraudAlerts.total,   color: 'text-white' },
                  { label: t.recent,  value: data.fraudAlerts.recent,  color: data.fraudAlerts.recent > 0 ? 'text-amber-400' : 'text-white' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-zinc-600 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4">
                <Activity className="w-4 h-4" />{t.auditActivity}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t.last24h, value: data.auditActivity.last24h },
                  { label: t.last7d,  value: data.auditActivity.last7d },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">{s.value}</div>
                    <div className="text-zinc-500 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top modules */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4">
                <TrendingUp className="w-4 h-4" />{t.topModules}
              </div>
              <div className="space-y-2">
                {data.auditActivity.topModules.map((m, i) => (
                  <div key={m.module} className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs w-4">{i + 1}</span>
                    <span className="flex-1 text-sm text-zinc-300">{m.module}</span>
                    <span className="text-zinc-500 text-xs">{m.count}</span>
                    <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${Math.min(100, (m.count / (data.auditActivity.topModules[0]?.count || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Suspicious Patterns */}
          <div className={`border rounded-2xl p-5 ${
            data.suspiciousPatterns.length > 0
              ? 'bg-red-950/20 border-red-800/40'
              : 'bg-emerald-950/20 border-emerald-800/40'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {data.suspiciousPatterns.length > 0
                ? <AlertTriangle className="w-4 h-4 text-red-400" />
                : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              <span className="text-sm font-medium text-white">{t.suspicious}</span>
            </div>
            {data.suspiciousPatterns.length === 0 ? (
              <p className="text-emerald-400/80 text-sm">{t.noSuspicious}</p>
            ) : (
              <ul className="space-y-1">
                {data.suspiciousPatterns.map((p, i) => (
                  <li key={i} className="text-red-300 text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>{p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
