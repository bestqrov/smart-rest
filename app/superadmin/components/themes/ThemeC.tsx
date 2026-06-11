'use client'
import { useState } from 'react'
import { Loader2, RefreshCw, ChevronDown, Play } from 'lucide-react'
import type { ThemeProps, Tenant } from '../types'
import ThemeSwitcher from '../ThemeSwitcher'
import ChurnAlerts from '../analytics/ChurnAlerts'
import ActivityLog, { logActivity } from '../analytics/ActivityLog'
import OnboardingProgress from '../analytics/OnboardingProgress'

const STATUS_BADGE: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-950 text-amber-400 border-amber-800/50',
  COLLECTING_DEBT: 'bg-emerald-950 text-emerald-400 border-emerald-800/50',
  SUSPENDED:       'bg-red-950 text-red-400 border-red-800/50',
}
const STATUS_DOT: Record<string, string> = {
  GRACE_PERIOD: 'bg-amber-400 animate-pulse',
  COLLECTING_DEBT: 'bg-emerald-400',
  SUSPENDED: 'bg-red-400',
}
const STATUS_LABEL: Record<string, string> = {
  GRACE_PERIOD: 'Trial', COLLECTING_DEBT: 'Active', SUSPENDED: 'Suspended'
}

const NAV = ['Overview', 'Tenants', 'Billing', 'Analytics', 'Requests']

export default function ThemeC(p: ThemeProps) {
  const [activeNav, setActiveNav] = useState('Overview')
  const [search, setSearch]       = useState('')

  const filtered = p.tenants.filter(t =>
    !search || t.businessName?.toLowerCase().includes(search.toLowerCase()) || t.subdomain.includes(search.toLowerCase())
  )
  const hasMore = p.tenants.length < p.total
  const pending = p.demoRequests.filter(d => d.status === 'pending').length

  return (
    <div dir="rtl" style={{ background: '#09090b', minHeight: '100vh' }}>
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-8 py-3 sticky top-0 z-10 border-b"
        style={{ background: 'rgba(9,9,11,0.95)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm">🍽</div>
            <span className="font-black text-white text-sm tracking-tight">SmartMenu</span>
            <span className="text-gray-700 mx-1">/</span>
            <span className="text-gray-400 text-sm">Admin</span>
          </div>
          <nav className="flex items-center gap-0.5">
            {NAV.map(n => (
              <button key={n} onClick={() => setActiveNav(n)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeNav === n ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {n}
                {n === 'Requests' && pending > 0 && (
                  <span className="mr-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pending}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher current={p.theme} onChange={p.onSetTheme} />
          <button onClick={p.onRunSweep} disabled={p.sweeping}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors text-gray-300"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {p.sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Sweep
          </button>
          <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
            className="p-2 rounded-xl text-gray-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <RefreshCw className={`w-4 h-4 ${p.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5 max-w-7xl mx-auto">

        {/* KPI strip */}
        {p.overview && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total Tenants', value: p.overview.totalCafes,   trend: null,    color: '' },
              { label: 'Active',        value: p.overview.activeCafes,  trend: null,    color: 'text-emerald-400' },
              { label: 'MRR',           value: p.mrrData ? `$${p.mrrData.totalMRR_USD.toFixed(0)}` : '…', trend: '▲', color: 'text-emerald-400' },
              { label: 'Trial',         value: p.overview.trialCafes,   trend: null,    color: 'text-amber-400' },
              { label: 'Debt',          value: `-${p.overview.totalAccruedDebt.toFixed(0)}`, trend: null, color: 'text-red-400' },
            ].map((c, i) => (
              <div key={i} className="p-4 rounded-2xl border"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-gray-500 text-xs mb-2 font-medium">{c.label}</div>
                <div className={`text-2xl font-black ${c.color || 'text-white'}`}>{c.value}</div>
                {c.trend && <div className={`text-xs mt-1 font-medium ${c.color}`}>{c.trend} growing</div>}
              </div>
            ))}
          </div>
        )}

        {/* Churn */}
        <ChurnAlerts tenants={p.tenants} onOpenModal={p.onOpenModal} />

        {/* Tenant table */}
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-white text-sm">Tenants</h3>
              <span className="text-gray-600 text-xs">{p.total} total</span>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…" dir="ltr"
              className="text-sm px-3 py-1.5 rounded-xl outline-none w-48 text-white placeholder-gray-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wider"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th className="px-5 py-3 text-right">Tenant</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3 text-right">Onboarding</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const bal = Number(t.walletBalance)
                return (
                  <tr key={t.id} onClick={() => p.onOpenModal(t)}
                    className="border-b cursor-pointer hover:bg-white/3 transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm border"
                          style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}>
                          🇲🇦
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{t.businessName || t.name}</div>
                          <div className="text-gray-600 text-xs">{t.subdomain}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[t.billingStatus] ?? 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.billingStatus] ?? 'bg-gray-500'}`} />
                        {STATUS_LABEL[t.billingStatus] ?? t.billingStatus}
                      </span>
                    </td>
                    <td className={`px-5 py-4 font-semibold text-sm ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {bal.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 min-w-[130px]">
                      <OnboardingProgress tenant={t} />
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => p.onOpenModal(t, 'billing')}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-white/5">
                          Edit
                        </button>
                        <button onClick={() => p.onDeleteConfirm(t)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:text-red-400 hover:bg-red-950/30">
                          Delete
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
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          )}
          {hasMore && !p.loading && (
            <div className="p-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={p.onLoadMore}
                className="text-sm text-gray-500 hover:text-white flex items-center gap-1 mx-auto">
                <ChevronDown className="w-4 h-4" /> Load more ({p.total - p.tenants.length})
              </button>
            </div>
          )}
        </div>

        <ActivityLog />
      </div>
    </div>
  )
}
