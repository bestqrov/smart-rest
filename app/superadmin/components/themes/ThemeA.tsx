'use client'
import { useState } from 'react'
import { Loader2, RefreshCw, Filter, Ban, CheckCircle, Edit3, Trash2, ChevronDown, Play, CalendarPlus, Package, Globe, TrendingUp, Flame } from 'lucide-react'
import type { ThemeProps, Tenant } from '../types'
import KpiCards from '../analytics/KpiCards'
import RevenueChart from '../analytics/RevenueChart'
import ClientsMap from '../analytics/ClientsMap'
import ActivityLog, { logActivity } from '../analytics/ActivityLog'
import OnboardingProgress from '../analytics/OnboardingProgress'

const BILLING_LABELS: Record<string, string> = { GRACE_PERIOD: 'تجريبي', COLLECTING_DEBT: 'نشط', SUSPENDED: 'موقوف' }
const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-900/50 text-amber-300 border border-amber-700',
  COLLECTING_DEBT: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  SUSPENDED:       'bg-red-900/50 text-red-300 border border-red-700'
}
const TIER_COLORS: Record<string, string> = {
  ECONOMY:  'bg-sky-900/50 text-sky-300 border border-sky-700',
  ADVANCED: 'bg-violet-900/50 text-violet-300 border border-violet-700'
}
const TIER_AR: Record<string, string> = { ECONOMY: 'اقتصادي', ADVANCED: 'متقدم' }

function trialDaysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export default function ThemeA(p: ThemeProps) {
  const [search, setSearch] = useState('')

  const filtered = p.tenants.filter(t =>
    !search || t.businessName?.toLowerCase().includes(search.toLowerCase()) || t.subdomain.includes(search.toLowerCase())
  )
  const hasMore = p.tenants.length < p.total

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/40">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white leading-none tracking-tight">SmartRestau Console</h1>
              <p className="text-gray-500 text-xs mt-0.5 font-medium">Superadmin · Operations Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {p.sweepMsg && <span className="text-emerald-400 text-xs bg-emerald-950/50 border border-emerald-700 px-3 py-1 rounded-full font-medium">{p.sweepMsg}</span>}
            {p.onOpenPurge && (
              <button onClick={p.onOpenPurge}
                className="flex items-center gap-2 bg-gray-800 hover:bg-orange-900/60 border border-gray-700 hover:border-orange-700 text-gray-400 hover:text-orange-300 px-3 py-2 rounded-xl text-xs font-bold transition-all">
                <Flame className="w-3.5 h-3.5" /> Purge
              </button>
            )}
            <a href="/superadmin/landing"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors">
              <Globe className="w-3.5 h-3.5" /> Landing
            </a>
            <button onClick={p.onRunSweep} disabled={p.sweeping}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors">
              {p.sweeping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Sweep
            </button>
            <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${p.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI + Charts ── */}
        {p.overview && (
          <KpiCards overview={p.overview} mrrData={p.mrrData} onOpenMrr={() => p.onSetMrrOpen(true)} />
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            <RevenueChart data={p.revenueHistory} />
            <ClientsMap tenants={p.tenants} />
          </div>
          <div className="space-y-3">
            {/* Demo Requests mini */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold text-sm">Demo Requests</span>
                </div>
                <div className="flex gap-1">
                  {(['pending','activated','rejected'] as const).map(t => (
                    <button key={t} onClick={() => { p.onSetDemoTab(t); p.onLoadDemoRequests(t) }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${p.demoTab === t ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                      {{ pending:'Pending', activated:'Active', rejected:'Rejected' }[t]}
                    </button>
                  ))}
                </div>
              </div>
              {p.demoRequests.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-3">No requests</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {p.demoRequests.slice(0, 3).map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-3 py-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-bold truncate">{d.businessName}</p>
                        <p className="text-gray-500 text-[10px]">{d.city} · {d.country}</p>
                      </div>
                      {d.status === 'pending' && (
                        <button onClick={() => p.onActivateDemo(d.id)} disabled={p.activatingDemo === d.id}
                          className="shrink-0 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
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

        {/* ── Churn Alerts ── */}
        {/* ChurnAlerts removed — only plage + QA Restaurant in prod */}

        {/* ── Quick Delete by Email ── */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl px-5 py-4">
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">🗑️ حذف حساب بالإيميل</p>
          <div className="flex gap-2">
            <input type="email" value={p.deleteEmail} onChange={e => p.onSetDeleteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && p.onDeleteByEmail()}
              placeholder="you@gmail.com" dir="ltr"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500" />
            <button onClick={p.onDeleteByEmail} disabled={p.delByEmail || !p.deleteEmail.trim()}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm">
              {p.delByEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">الدولة</p>
            <select value={p.filterCountry} onChange={e => p.onSetFilterCountry(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500">
              <option value="">الكل</option>
              <option value="MA">🇲🇦 المغرب</option>
              <option value="SA">🇸🇦 السعودية</option>
              <option value="AE">🇦🇪 الإمارات</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">الحالة</p>
            <select value={p.filterStatus} onChange={e => p.onSetFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500">
              <option value="">الكل</option>
              <option value="GRACE_PERIOD">تجريبي</option>
              <option value="COLLECTING_DEBT">نشط</option>
              <option value="SUSPENDED">موقوف</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">بحث</p>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="اسم أو subdomain…"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500 w-44" />
          </div>
          <button onClick={() => p.onLoadAll(1)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            <Filter className="w-4 h-4" /> تصفية
          </button>
        </div>

        {/* ── Bulk bar ── */}
        {p.selectedIds.size > 0 && (
          <div className="sticky top-2 z-20 flex items-center justify-between bg-red-950/90 border border-red-700/60 rounded-2xl px-5 py-3 backdrop-blur-sm">
            <span className="text-red-300 font-bold text-sm">{p.selectedIds.size} حساب محدد</span>
            <div className="flex gap-2">
              <button onClick={p.onClearSelection} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700">إلغاء</button>
              <button onClick={p.onBulkDelete} disabled={p.bulkDeleting}
                className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded-xl text-sm">
                {p.bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف {p.selectedIds.size}
              </button>
            </div>
          </div>
        )}

        {/* ── Tenant table ── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="px-3 py-3 text-center w-10">
                    <input type="checkbox" className="accent-emerald-500 w-4 h-4 cursor-pointer"
                      checked={filtered.filter(t => !t.isDemo).length > 0 && filtered.filter(t => !t.isDemo).every(t => p.selectedIds.has(t.id))}
                      onChange={e => e.target.checked ? p.onSelectAll() : p.onClearSelection()} />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">المطعم</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-center font-medium">التجربة</th>
                  <th className="px-4 py-3 text-center font-medium">طلبات/أسبوع</th>
                  <th className="px-4 py-3 text-right font-medium">الاشتراك</th>
                  <th className="px-4 py-3 text-right font-medium">الرصيد</th>
                  <th className="px-4 py-3 text-right font-medium">Onboarding</th>
                  <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map(t => {
                  const bal     = Number(t.walletBalance)
                  const days    = trialDaysLeft(t.trialEndsAt)
                  const checked = p.selectedIds.has(t.id)
                  return (
                    <tr key={t.id} onClick={() => p.onOpenModal(t)}
                      className={`transition-colors cursor-pointer ${checked ? 'bg-red-950/20' : 'hover:bg-gray-800/30'}`}>
                      <td className="px-3 py-3 text-center" onClick={e => { e.stopPropagation(); p.onToggleSelect(t.id, t.isDemo) }}>
                        {t.isDemo
                          ? <span className="text-amber-500 text-base select-none" title="محمي">🛡</span>
                          : <input type="checkbox" className="accent-emerald-500 w-4 h-4 cursor-pointer" checked={checked} onChange={() => p.onToggleSelect(t.id, t.isDemo)} />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                          {t.businessName || t.name}
                          {t.isDemo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Demo</span>}
                          {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                              <Package className="w-2.5 h-2.5" /> مخزون
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">{t.subdomain}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                          {BILLING_LABELS[t.billingStatus] ?? t.billingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {days == null ? <span className="text-gray-600">—</span>
                          : days > 0  ? <span className="text-amber-400">{days}ي</span>
                          :             <span className="text-red-400">انتهت</span>}
                        {t.hasExtendedTrial && <span className="mr-1 text-sky-400 text-[10px]">↗</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-white">{t.weeklyOrderCount ?? t._count.orders}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.subscriptionTier
                          ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_COLORS[t.subscriptionTier] ?? 'bg-gray-700 text-gray-300'}`}>{TIER_AR[t.subscriptionTier] ?? t.subscriptionTier}</span>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className={`px-4 py-3 font-bold text-xs ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {bal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <OnboardingProgress tenant={t} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {t.billingStatus !== 'SUSPENDED'
                            ? <RowBtn icon={<Ban className="w-3 h-3" />} label="إيقاف" color="red" loading={p.actionId === t.id} onClick={() => { p.onSuspend(t.id); logActivity('إيقاف', t.businessName || t.name) }} />
                            : <RowBtn icon={<CheckCircle className="w-3 h-3" />} label="تفعيل" color="green" loading={p.actionId === t.id} onClick={() => { p.onReactivate(t.id); logActivity('تفعيل', t.businessName || t.name) }} />}
                          <RowBtn icon={<Edit3 className="w-3 h-3" />} label="إعداد" color="blue" loading={false} onClick={() => p.onOpenModal(t, 'billing')} />
                          <RowBtn icon={<Trash2 className="w-3 h-3" />} label="حذف" color="red" loading={false} onClick={() => p.onDeleteConfirm(t)} />
                          <RowBtn icon={<span className="text-[11px]">{t.isDemo ? '🛡' : '🔓'}</span>} label={t.isDemo ? 'محمي' : 'حماية'} color={t.isDemo ? 'amber' : 'blue'} loading={false} onClick={() => p.onToggleDemoFlag(t.id, t.isDemo)} />
                          {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                            <RowBtn icon={<Package className="w-3 h-3" />} label="مخزون" color="amber" loading={p.actionId === t.id} onClick={() => p.onApproveInventory(t.id)} />
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
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
            </div>
          )}
          {!p.loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">لا توجد بيانات</div>
          )}
          {hasMore && !p.loading && (
            <div className="p-4 text-center border-t border-gray-800">
              <button onClick={p.onLoadMore}
                className="text-sm text-gray-400 hover:text-emerald-400 flex items-center gap-1 mx-auto">
                <ChevronDown className="w-4 h-4" /> تحميل المزيد ({p.total - p.tenants.length} متبقٍ)
              </button>
            </div>
          )}
        </div>

        <ActivityLog />

      </div>

      {/* MRR Breakdown Modal */}
      {p.mrrOpen && p.mrrData && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => p.onSetMrrOpen(false)}>
          <div className="bg-gray-900 border border-violet-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-950 to-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" /> MRR — Breakdown
                </h3>
                <p className="text-violet-400 text-xs mt-0.5">{new Date(p.mrrData.computedAt).toLocaleString('fr')}</p>
              </div>
              <p className="text-2xl font-extrabold text-violet-400">${p.mrrData.totalMRR_USD.toFixed(2)}</p>
            </div>
            <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-4 text-[10px] font-bold text-gray-500 uppercase px-2 pb-2 border-b border-gray-800">
                <span>Pays</span><span className="text-right">Cafés</span>
                <span className="text-right">Local</span><span className="text-right">USD</span>
              </div>
              {p.mrrData.byCountry.map((r: any) => (
                <div key={r.country} className="grid grid-cols-4 items-center px-2 py-2 hover:bg-gray-800/50 rounded-xl text-sm">
                  <span className="font-bold text-white">{r.country}</span>
                  <span className="text-right text-gray-400">{r.cafes}</span>
                  <span className="text-right text-gray-300 text-xs">{r.monthlyCommissionLocal.toFixed(0)} {r.currency}</span>
                  <span className="text-right font-extrabold text-violet-300">${r.monthlyUSD.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex justify-end">
              <button onClick={() => p.onSetMrrOpen(false)} className="text-gray-400 hover:text-white px-3 py-1 text-sm">✕ إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RowBtn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string
  color: 'red' | 'green' | 'blue' | 'amber'
  loading: boolean; onClick: () => void
}) {
  const cls = {
    red:   'bg-red-900/50 hover:bg-red-800 text-red-300',
    green: 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300',
    blue:  'bg-blue-900/50 hover:bg-blue-800 text-blue-300',
    amber: 'bg-amber-900/50 hover:bg-amber-800 text-amber-300 border border-amber-700/50 animate-pulse'
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 ${cls[color]} px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )
}
