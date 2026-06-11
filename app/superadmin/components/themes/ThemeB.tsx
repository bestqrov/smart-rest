'use client'
import { useState } from 'react'
import { Loader2, RefreshCw, Ban, CheckCircle, Edit3, Trash2, ChevronDown, Play, Package } from 'lucide-react'
import type { ThemeProps, Tenant } from '../types'
import ThemeSwitcher from '../ThemeSwitcher'
import KpiCards from '../analytics/KpiCards'
import RevenueChart from '../analytics/RevenueChart'
import ChurnAlerts from '../analytics/ChurnAlerts'
import ActivityLog, { logActivity } from '../analytics/ActivityLog'
import OnboardingProgress from '../analytics/OnboardingProgress'

const BILLING_LABELS: Record<string, string> = { GRACE_PERIOD: 'تجريبي', COLLECTING_DEBT: 'نشط', SUSPENDED: 'موقوف' }
const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-900/50 text-amber-300 border border-amber-700',
  COLLECTING_DEBT: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  SUSPENDED:       'bg-red-900/50 text-red-300 border border-red-700'
}

function trialDaysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

const NAV_ITEMS = [
  { icon: '📊', label: 'Overview' },
  { icon: '🏪', label: 'Tenants' },
  { icon: '🎯', label: 'Demo Requests' },
  { icon: '📈', label: 'Analytics' },
  { icon: '💳', label: 'Billing' },
]

export default function ThemeB(p: ThemeProps) {
  const [activeNav, setActiveNav] = useState('Overview')
  const [search, setSearch]       = useState('')

  const filtered = p.tenants.filter(t =>
    !search || t.businessName?.toLowerCase().includes(search.toLowerCase()) || t.subdomain.includes(search.toLowerCase())
  )
  const hasMore = p.tenants.length < p.total

  return (
    <div
      dir="rtl"
      className="flex h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0015 0%, #000a1a 50%, #0a000f 100%)' }}
    >
      {/* ── Glass Sidebar ── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col p-5 gap-1"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🛡</div>
          <div>
            <div className="font-black text-white text-sm">Control Room</div>
            <div className="text-[10px] font-bold text-violet-400">SmartMenu Admin</div>
          </div>
        </div>

        <div className="text-[10px] text-gray-600 px-3 uppercase tracking-widest mb-1">القائمة</div>
        {NAV_ITEMS.map(item => (
          <button key={item.label} onClick={() => setActiveNav(item.label)}
            className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold transition-all text-right ${
              activeNav === item.label
                ? 'text-violet-300'
                : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
            }`}
            style={activeNav === item.label ? {
              background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.2))',
              border: '1px solid rgba(124,58,237,0.3)'
            } : {}}>
            <span>{item.icon}</span> {item.label}
          </button>
        ))}

        {/* Server health */}
        <div className="mt-auto p-4 rounded-2xl space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">حالة الخادم</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400">نشط · API OK</span>
          </div>
          {p.overview && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">المطاعم</span>
              <span className="text-white font-bold">{p.overview.totalCafes}</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'rgba(10,0,21,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 className="text-white font-black text-lg">{activeNav}</h1>
          <div className="flex items-center gap-2">
            <ThemeSwitcher current={p.theme} onChange={p.onSetTheme} />
            <button onClick={p.onRunSweep} disabled={p.sweeping}
              className="flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl transition-colors text-amber-400 hover:text-amber-300"
              style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}>
              {p.sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Sweep
            </button>
            <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
              className="p-2 rounded-xl text-gray-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <RefreshCw className={`w-4 h-4 ${p.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* KPI cards */}
          {p.overview && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'إجمالي', value: p.overview.totalCafes, icon: '🏪', color: '#10b981', bg: 'linear-gradient(135deg, #064e3b, #065f46)', border: 'rgba(16,185,129,0.2)' },
                { label: 'MRR', value: p.mrrData ? `$${p.mrrData.totalMRR_USD.toFixed(0)}` : '…', icon: '💎', color: '#818cf8', bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: 'rgba(99,102,241,0.2)' },
                { label: 'تجريبي', value: p.overview.trialCafes, icon: '⏳', color: '#fbbf24', bg: 'linear-gradient(135deg, #1c1917, #292524)', border: 'rgba(245,158,11,0.2)' },
                { label: 'موقوفة', value: p.overview.suspendedCafes, icon: '⚠️', color: '#f87171', bg: 'linear-gradient(135deg, #450a0a, #7f1d1d)', border: 'rgba(239,68,68,0.2)' },
              ].map((c, i) => (
                <div key={i} className="rounded-3xl p-5 relative overflow-hidden"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20"
                    style={{ background: `radial-gradient(circle, ${c.color}, transparent)` }} />
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <div className="text-3xl font-black text-white">{c.value}</div>
                  <div className="text-xs mt-1 font-semibold" style={{ color: c.color }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Revenue chart */}
          <div className="rounded-3xl p-6"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-white">الإيراد الشهري</h3>
                <p className="text-gray-500 text-xs">آخر 6 أشهر</p>
              </div>
            </div>
            <div className="flex items-end gap-3 h-28">
              {p.revenueHistory.map((d, i) => {
                const max = Math.max(...p.revenueHistory.map(x => x.value), 1)
                const isLast = i === p.revenueHistory.length - 1
                const h = Math.max((d.value / max) * 100, 4)
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <div className="rounded-2xl w-full"
                      style={{ height: `${h}%`, background: isLast ? 'linear-gradient(180deg, #7c3aed, #2563eb)' : 'rgba(124,58,237,0.3)' }} />
                    <span className="text-[9px] font-medium" style={{ color: isLast ? '#a78bfa' : '#4b5563' }}>{d.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Churn */}
          <ChurnAlerts tenants={p.tenants} onOpenModal={p.onOpenModal} />

          {/* Tenant table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">المطاعم</h3>
                <span className="text-gray-600 text-xs">{p.total} إجمالي</span>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث…"
                className="text-sm px-3 py-1.5 rounded-xl outline-none w-44 text-white placeholder-gray-600"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th className="px-5 py-3 text-right">المطعم</th>
                  <th className="px-5 py-3 text-center">الحالة</th>
                  <th className="px-5 py-3 text-center">طلبات/أسبوع</th>
                  <th className="px-5 py-3 text-right">الرصيد</th>
                  <th className="px-5 py-3 text-right">Onboarding</th>
                  <th className="px-5 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const bal = Number(t.walletBalance)
                  return (
                    <tr key={t.id} onClick={() => p.onOpenModal(t)}
                      className="cursor-pointer transition-colors hover:bg-white/3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                            🇲🇦
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{t.businessName || t.name}</div>
                            <div className="text-gray-600 text-xs">{t.subdomain}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                          {BILLING_LABELS[t.billingStatus] ?? t.billingStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-white font-bold">
                        {t.weeklyOrderCount ?? t._count.orders}
                      </td>
                      <td className={`px-5 py-4 font-bold text-sm ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {bal.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 min-w-[130px]">
                        <OnboardingProgress tenant={t} />
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => p.onOpenModal(t, 'billing')}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                            إعداد
                          </button>
                          <button onClick={() => p.onDeleteConfirm(t)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-colors">
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {p.loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
              </div>
            )}
            {hasMore && !p.loading && (
              <div className="p-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={p.onLoadMore}
                  className="text-sm text-gray-500 hover:text-violet-400 flex items-center gap-1 mx-auto">
                  <ChevronDown className="w-4 h-4" /> تحميل المزيد ({p.total - p.tenants.length})
                </button>
              </div>
            )}
          </div>

          <ActivityLog />
        </div>
      </main>
    </div>
  )
}
