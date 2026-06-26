'use client'
import { useState } from 'react'
import {
  Loader2, RefreshCw, Filter, Ban, CheckCircle, Edit3, Trash2,
  ChevronDown, Play, CalendarPlus, Package, Globe, TrendingUp,
  Flame, LayoutDashboard, Store, BarChart3, Map, AlertTriangle,
  Activity, ChevronRight, Wallet,
} from 'lucide-react'
import type { ThemeProps } from '../types'
import KpiCards from '../analytics/KpiCards'
import RevenueChart from '../analytics/RevenueChart'
import ClientsMap from '../analytics/ClientsMap'
import ActivityLog, { logActivity } from '../analytics/ActivityLog'
import OnboardingProgress from '../analytics/OnboardingProgress'

// ─── Label maps ──────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  GRACE_PERIOD: 'Trial', COLLECTING_DEBT: 'Active', SUSPENDED: 'Suspended',
}
const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-50 text-amber-700 border border-amber-200',
  COLLECTING_DEBT: 'bg-green-50 text-green-700 border border-green-200',
  SUSPENDED:       'bg-red-50 text-red-600 border border-red-200',
}
const TIER_COLORS: Record<string, string> = {
  ECONOMY:  'bg-sky-50 text-sky-700 border border-sky-200',
  ADVANCED: 'bg-violet-50 text-violet-700 border border-violet-200',
}

function trialDaysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const NAV = [
  { icon: LayoutDashboard, label: 'Overview',       href: '#overview' },
  { icon: BarChart3,       label: 'Analytics',      href: '#analytics' },
  { icon: Map,             label: 'Client Map',     href: '#map' },
  { icon: Store,           label: 'Restaurants',    href: '#restaurants' },
  { icon: CalendarPlus,    label: 'Demo Requests',  href: '#demo' },
  { icon: AlertTriangle,   label: 'Danger Zone',    href: '#danger' },
  { icon: Activity,        label: 'Activity Log',   href: '#log' },
]

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-600">
        {icon}
      </div>
      <div>
        <h2 className="text-slate-800 font-bold text-sm leading-none">{title}</h2>
        {subtitle && <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px bg-slate-200 ml-2" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ThemeA(p: ThemeProps) {
  const [search, setSearch] = useState('')

  const filtered = p.tenants.filter(t =>
    !search || t.businessName?.toLowerCase().includes(search.toLowerCase()) || t.subdomain.includes(search.toLowerCase())
  )
  const hasMore = p.tenants.length < p.total

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside className="w-56 bg-[#1e2d3d] flex-shrink-0 flex flex-col overflow-y-auto">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-sm leading-none">SmartRestau</p>
              <p className="text-slate-400 text-[10px] mt-0.5 font-medium">Superadmin Console</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 py-2">Navigation</p>
          {NAV.map(item => (
            <a key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors group text-sm font-medium">
              <item.icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              {item.label}
              <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </a>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <a href="/superadmin/landing"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium">
            <Globe className="w-4 h-4" /> Landing Page
          </a>
          <button onClick={p.onRunSweep} disabled={p.sweeping}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium">
            {p.sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Sweep
          </button>
          {p.onOpenPurge && (
            <button onClick={p.onOpenPurge}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors text-sm font-medium">
              <Flame className="w-4 h-4" /> Purge Test Data
            </button>
          )}
        </div>
      </aside>

      {/* ════════════════ MAIN CONTENT ════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-slate-800 font-bold text-base">Dashboard</h1>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-slate-500 text-sm">{p.total} restaurants</span>
          </div>
          <div className="flex items-center gap-2">
            {p.sweepMsg && (
              <span className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">{p.sweepMsg}</span>
            )}
            <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${p.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ── Section 1: Overview ── */}
          <section id="overview">
            <SectionHeading
              icon={<LayoutDashboard className="w-4 h-4" />}
              title="Overview"
              subtitle="Key metrics at a glance"
            />
            {p.overview && (
              <KpiCards overview={p.overview} mrrData={p.mrrData} onOpenMrr={() => p.onSetMrrOpen(true)} />
            )}
          </section>

          {/* ── Section 2: Analytics ── */}
          <section id="analytics">
            <SectionHeading
              icon={<BarChart3 className="w-4 h-4" />}
              title="Analytics"
              subtitle="Revenue history & demo pipeline"
            />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <RevenueChart data={p.revenueHistory} />
              </div>
              <div id="demo">
                {/* Demo Requests */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-slate-700 font-bold text-sm flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-emerald-500" /> Demo Requests
                    </h3>
                    <div className="flex gap-1">
                      {(['pending','activated','rejected'] as const).map(tab => (
                        <button key={tab} onClick={() => { p.onSetDemoTab(tab); p.onLoadDemoRequests(tab) }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                            p.demoTab === tab ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {{ pending: 'Pending', activated: 'Active', rejected: 'Rejected' }[tab]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {p.demoRequests.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">No requests</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {p.demoRequests.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 gap-2 border border-slate-100">
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-800 text-xs font-bold truncate">{d.businessName}</p>
                            <p className="text-slate-400 text-[10px]">{d.city} · {d.country}</p>
                          </div>
                          {d.status === 'pending' && (
                            <button onClick={() => p.onActivateDemo(d.id)} disabled={p.activatingDemo === d.id}
                              className="shrink-0 flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                              {p.activatingDemo === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              Activate
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Client Map ── */}
          <section id="map">
            <SectionHeading
              icon={<Map className="w-4 h-4" />}
              title="Client Distribution"
              subtitle="Geographic spread of your restaurant partners"
            />
            <ClientsMap tenants={p.tenants} />
          </section>

          {/* ── Section 4: Restaurants ── */}
          <section id="restaurants">
            <SectionHeading
              icon={<Store className="w-4 h-4" />}
              title="Restaurants"
              subtitle={`${p.total} tenants total — click any row to manage`}
            />

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Country</label>
                <select value={p.filterCountry} onChange={e => p.onSetFilterCountry(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm outline-none focus:border-blue-400">
                  <option value="">All</option>
                  <option value="MA">🇲🇦 Morocco</option>
                  <option value="SA">🇸🇦 Saudi Arabia</option>
                  <option value="AE">🇦🇪 UAE</option>
                  <option value="DZ">🇩🇿 Algeria</option>
                  <option value="TN">🇹🇳 Tunisia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Status</label>
                <select value={p.filterStatus} onChange={e => p.onSetFilterStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm outline-none focus:border-blue-400">
                  <option value="">All</option>
                  <option value="GRACE_PERIOD">Trial</option>
                  <option value="COLLECTING_DEBT">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name or subdomain…"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm outline-none focus:border-blue-400 w-48" />
              </div>
              <button onClick={() => p.onLoadAll(1)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>

            {/* Bulk bar */}
            {p.selectedIds.size > 0 && (
              <div className="sticky top-2 z-20 flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-3 shadow-sm">
                <span className="text-red-700 font-bold text-sm">{p.selectedIds.size} restaurant(s) selected</span>
                <div className="flex gap-2">
                  <button onClick={p.onClearSelection} className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">Cancel</button>
                  <button onClick={p.onBulkDelete} disabled={p.bulkDeleting}
                    className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded-xl text-sm">
                    {p.bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete {p.selectedIds.size}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-3 py-3 text-center w-10">
                        <input type="checkbox" className="accent-blue-500 w-4 h-4 cursor-pointer"
                          checked={filtered.filter(t => !t.isDemo).length > 0 && filtered.filter(t => !t.isDemo).every(t => p.selectedIds.has(t.id))}
                          onChange={e => e.target.checked ? p.onSelectAll() : p.onClearSelection()} />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Restaurant</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Trial</th>
                      <th className="px-4 py-3 text-center font-semibold">Orders/wk</th>
                      <th className="px-4 py-3 text-left font-semibold">Plan</th>
                      <th className="px-4 py-3 text-right font-semibold">Balance</th>
                      <th className="px-4 py-3 text-left font-semibold">Onboarding</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(t => {
                      const bal     = Number(t.walletBalance)
                      const days    = trialDaysLeft(t.trialEndsAt)
                      const checked = p.selectedIds.has(t.id)
                      return (
                        <tr key={t.id} onClick={() => p.onOpenModal(t)}
                          className={`transition-colors cursor-pointer ${checked ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-3 py-3 text-center" onClick={e => { e.stopPropagation(); p.onToggleSelect(t.id, t.isDemo) }}>
                            {t.isDemo
                              ? <span className="text-amber-500 select-none" title="Protected">🛡</span>
                              : <input type="checkbox" className="accent-blue-500 w-4 h-4 cursor-pointer" checked={checked} onChange={() => p.onToggleSelect(t.id, t.isDemo)} />}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap text-sm">
                              {t.businessName || t.name}
                              {t.isDemo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Demo</span>}
                              {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
                                  <Package className="w-2.5 h-2.5" /> Inventory
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-xs font-mono">{t.subdomain}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                              {BILLING_LABELS[t.billingStatus] ?? t.billingStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            {days == null ? <span className="text-slate-300">—</span>
                              : days > 0  ? <span className="text-amber-500 font-semibold">{days}d</span>
                              :             <span className="text-red-500 font-semibold">Expired</span>}
                            {t.hasExtendedTrial && <span className="ml-1 text-sky-400 text-[10px]">↗</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-slate-700">{t.weeklyOrderCount ?? t._count.orders}</span>
                          </td>
                          <td className="px-4 py-3">
                            {t.subscriptionTier
                              ? <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_COLORS[t.subscriptionTier] ?? 'bg-slate-100 text-slate-600'}`}>{t.subscriptionTier}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className={`px-4 py-3 font-bold text-xs text-right ${bal < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {bal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 min-w-[120px]">
                            <OnboardingProgress tenant={t} />
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 flex-wrap">
                              {t.billingStatus !== 'SUSPENDED'
                                ? <RowBtn icon={<Ban className="w-3 h-3" />} label="Suspend" color="red" loading={p.actionId === t.id} onClick={() => { p.onSuspend(t.id); logActivity('Suspend', t.businessName || t.name) }} />
                                : <RowBtn icon={<CheckCircle className="w-3 h-3" />} label="Activate" color="green" loading={p.actionId === t.id} onClick={() => { p.onReactivate(t.id); logActivity('Activate', t.businessName || t.name) }} />}
                              <RowBtn icon={<Edit3 className="w-3 h-3" />} label="Config" color="blue" loading={false} onClick={() => p.onOpenModal(t, 'billing')} />
                              <RowBtn icon={<Trash2 className="w-3 h-3" />} label="Delete" color="red" loading={false} onClick={() => p.onDeleteConfirm(t)} />
                              <RowBtn icon={<span className="text-[11px]">{t.isDemo ? '🛡' : '🔓'}</span>} label={t.isDemo ? 'Protected' : 'Protect'} color={t.isDemo ? 'amber' : 'blue'} loading={false} onClick={() => p.onToggleDemoFlag(t.id, t.isDemo)} />
                              {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                                <RowBtn icon={<Package className="w-3 h-3" />} label="Inventory" color="amber" loading={p.actionId === t.id} onClick={() => p.onApproveInventory(t.id)} />
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {p.loading && (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                </div>
              )}
              {!p.loading && filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">No restaurants found</div>
              )}
              {hasMore && !p.loading && (
                <div className="p-4 text-center border-t border-slate-100">
                  <button onClick={p.onLoadMore}
                    className="text-sm text-slate-400 hover:text-blue-500 flex items-center gap-1 mx-auto transition-colors">
                    <ChevronDown className="w-4 h-4" /> Load more ({p.total - p.tenants.length} remaining)
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 5: Danger Zone ── */}
          <section id="danger">
            <SectionHeading
              icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              title="Danger Zone"
              subtitle="Irreversible operations — use with caution"
            />
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest mb-3">Delete account by email</p>
              <div className="flex gap-2 max-w-lg">
                <input type="email" value={p.deleteEmail} onChange={e => p.onSetDeleteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && p.onDeleteByEmail()}
                  placeholder="admin@restaurant.com"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-red-400" />
                <button onClick={p.onDeleteByEmail} disabled={p.delByEmail || !p.deleteEmail.trim()}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
                  {p.delByEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>
          </section>

          {/* ── Section 6: Activity Log ── */}
          <section id="log">
            <SectionHeading
              icon={<Activity className="w-4 h-4" />}
              title="Activity Log"
              subtitle="Recent superadmin actions this session"
            />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <ActivityLog />
            </div>
          </section>

        </main>
      </div>

      {/* ── MRR Breakdown Modal ── */}
      {p.mrrOpen && p.mrrData && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => p.onSetMrrOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-violet-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> MRR Breakdown
                </h3>
                <p className="text-violet-200 text-xs mt-0.5">{new Date(p.mrrData.computedAt).toLocaleString('fr')}</p>
              </div>
              <p className="text-3xl font-extrabold text-white">${p.mrrData.totalMRR_USD.toFixed(0)}</p>
            </div>
            <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase px-2 pb-2 border-b border-slate-100">
                <span>Country</span><span className="text-right">Cafés</span>
                <span className="text-right">Local</span><span className="text-right">USD</span>
              </div>
              {p.mrrData.byCountry.map((r: any) => (
                <div key={r.country} className="grid grid-cols-4 items-center px-2 py-2 hover:bg-slate-50 rounded-xl text-sm">
                  <span className="font-bold text-slate-800">{r.country}</span>
                  <span className="text-right text-slate-500">{r.cafes}</span>
                  <span className="text-right text-slate-600 text-xs">{r.monthlyCommissionLocal.toFixed(0)} {r.currency}</span>
                  <span className="text-right font-extrabold text-violet-600">${r.monthlyUSD.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => p.onSetMrrOpen(false)} className="text-slate-500 hover:text-slate-800 px-3 py-1 text-sm font-medium">✕ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Row action button ────────────────────────────────────────────────────────

function RowBtn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string
  color: 'red' | 'green' | 'blue' | 'amber'
  loading: boolean; onClick: () => void
}) {
  const cls = {
    red:   'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    green: 'bg-green-50 hover:bg-green-100 text-green-600 border border-green-200',
    blue:  'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200',
    amber: 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 ${cls[color]} px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )
}
