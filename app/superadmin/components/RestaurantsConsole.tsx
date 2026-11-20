'use client'
import { useState } from 'react'
import {
  Loader2, RefreshCw, Filter, Ban, CheckCircle, Edit3, Trash2, X,
  ChevronDown, Play, CalendarPlus, Package, Flame, LayoutDashboard, Store,
  BarChart3, Map, AlertTriangle, Activity, Wallet, Gem, KeyRound,
} from 'lucide-react'
import type { ThemeProps } from './types'
import KpiCards from './analytics/KpiCards'
import RevenueChart from './analytics/RevenueChart'
import ClientsMap from './analytics/ClientsMap'
import ActivityLog, { logActivity } from './analytics/ActivityLog'
import OnboardingProgress from './analytics/OnboardingProgress'
import { AR_LOCALE, statusLabel } from './labels'

// ─── Colors (labels come from ./labels) ──────────────────────────────────────

const BILLING_COLORS: Record<string, string> = {
  GRACE_PERIOD:    'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  COLLECTING_DEBT: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  SUSPENDED:       'bg-red-500/10 text-red-300 border border-red-500/30',
  PAST_DUE:        'bg-orange-500/10 text-orange-300 border border-orange-500/30',
}
const TIER_COLORS: Record<string, string> = {
  ECONOMY:  'bg-sky-500/10 text-sky-300 border border-sky-500/30',
  ADVANCED: 'bg-violet-500/10 text-violet-300 border border-violet-500/30',
}
const RESET_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-900 text-amber-300',
  SENT:    'bg-blue-900 text-blue-300',
}

function trialDaysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type ConsoleTab =
  | 'overview' | 'analytics' | 'map' | 'restaurants' | 'demo'
  | 'plans' | 'resets' | 'log' | 'danger'

const TABS: { key: ConsoleTab; icon: typeof Store; label: string; danger?: boolean }[] = [
  { key: 'overview',    icon: LayoutDashboard, label: 'نظرة عامة' },
  { key: 'analytics',   icon: BarChart3,       label: 'التحليلات' },
  { key: 'map',         icon: Map,             label: 'خريطة العملاء' },
  { key: 'restaurants', icon: Store,           label: 'المطاعم' },
  { key: 'demo',        icon: CalendarPlus,    label: 'طلبات العرض التجريبي' },
  { key: 'plans',       icon: Gem,             label: 'الباقات المميزة' },
  { key: 'resets',      icon: KeyRound,        label: 'إعادة تعيين كلمة المرور' },
  { key: 'log',         icon: Activity,        label: 'سجل النشاط' },
  { key: 'danger',      icon: AlertTriangle,   label: 'منطقة الخطر', danger: true },
]

const DEMO_TABS = { pending: 'قيد الانتظار', activated: 'مفعّلة', rejected: 'مرفوضة' } as const

const card = 'bg-zinc-900 border border-zinc-800 rounded-2xl'
const input = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm outline-none focus:border-purple-500'

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-300">{icon}</div>
      <div>
        <h2 className="text-zinc-100 font-bold text-sm leading-none">{title}</h2>
        {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export interface ResetsProps {
  pwResets:       any[]
  pwResetLoading: boolean
  approvingReset: string | null
  onLoadPwResets: () => void
  onApproveReset: (id: string) => void
  onRejectReset:  (id: string) => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RestaurantsConsole(p: ThemeProps & ResetsProps) {
  const [tab, setTab] = useState<ConsoleTab>('overview')
  const [search, setSearch] = useState('')

  const filtered = p.tenants.filter(t =>
    !search || t.businessName?.toLowerCase().includes(search.toLowerCase()) || t.subdomain.includes(search.toLowerCase())
  )
  const hasMore = p.tenants.length < p.total
  const pendingResets = p.pwResets.filter(r => r.status === 'PENDING').length
  const grandTotal = p.overview?.totalCafes

  function openTab(t: ConsoleTab) {
    setTab(t)
    if (t === 'demo') p.onLoadDemoRequests(p.demoTab)
    if (t === 'resets') p.onLoadPwResets()
  }

  return (
    <div dir="rtl" className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-zinc-100 font-bold text-lg">إدارة المطاعم</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {grandTotal != null ? `${grandTotal} مطعم إجمالاً` : '…'}
            {' · '}
            {`عرض ${p.tenants.length} من ${p.total} حسب التصفية الحالية`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.sweepMsg && (
            <span className="text-emerald-300 text-xs bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full font-medium">{p.sweepMsg}</span>
          )}
          <button onClick={() => openTab('resets')}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <KeyRound className="w-3.5 h-3.5" />
            طلبات إعادة تعيين كلمة المرور
            {pendingResets > 0 && (
              <span className="bg-red-600 text-white rounded-full text-[10px] font-bold min-w-5 h-5 px-1 flex items-center justify-center">{pendingResets}</span>
            )}
          </button>
          <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${p.loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 -mx-1 px-1">
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => openTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                active
                  ? (t.danger ? 'border-red-500 text-red-300' : 'border-purple-500 text-purple-300')
                  : (t.danger ? 'border-transparent text-red-400/70 hover:text-red-300' : 'border-transparent text-zinc-500 hover:text-zinc-200')
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.key === 'resets' && pendingResets > 0 && (
                <span className="bg-red-600 text-white rounded-full text-[10px] font-bold px-1.5">{pendingResets}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <section>
          <SectionHeading icon={<LayoutDashboard className="w-4 h-4" />} title="نظرة عامة" subtitle="أهم المؤشرات على كل المنصة" />
          {p.overview
            ? <KpiCards overview={p.overview} mrrData={p.mrrData} onOpenMrr={() => p.onSetMrrOpen(true)} />
            : <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>}
        </section>
      )}

      {/* ── Analytics ── */}
      {tab === 'analytics' && (
        <section>
          <SectionHeading icon={<BarChart3 className="w-4 h-4" />} title="التحليلات" subtitle="سجل العمولات الشهري" />
          <RevenueChart data={p.revenueHistory} />
        </section>
      )}

      {/* ── Map ── */}
      {tab === 'map' && (
        <section>
          <SectionHeading icon={<Map className="w-4 h-4" />} title="توزيع العملاء" subtitle="التوزيع الجغرافي للمطاعم المعروضة حسب التصفية الحالية" />
          <ClientsMap tenants={p.tenants} />
        </section>
      )}

      {/* ── Restaurants ── */}
      {tab === 'restaurants' && (
        <section>
          <SectionHeading icon={<Store className="w-4 h-4" />} title="المطاعم"
            subtitle={`عرض ${p.tenants.length} من ${p.total} — انقر على أي صف للإدارة`} />

          {/* Filters */}
          <div className={`${card} p-4 flex flex-wrap gap-3 items-end mb-4`}>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">الدولة</label>
              <select value={p.filterCountry} onChange={e => p.onSetFilterCountry(e.target.value)} className={input}>
                <option value="">الكل</option>
                <option value="MA">المغرب</option>
                <option value="SA">السعودية</option>
                <option value="AE">الإمارات</option>
                <option value="DZ">الجزائر</option>
                <option value="TN">تونس</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">الحالة</label>
              <select value={p.filterStatus} onChange={e => p.onSetFilterStatus(e.target.value)} className={input}>
                <option value="">الكل</option>
                <option value="GRACE_PERIOD">{statusLabel('GRACE_PERIOD')}</option>
                <option value="COLLECTING_DEBT">{statusLabel('COLLECTING_DEBT')}</option>
                <option value="SUSPENDED">{statusLabel('SUSPENDED')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">بحث</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="الاسم أو النطاق الفرعي…" className={`${input} w-48`} />
            </div>
            <button onClick={() => p.onLoadAll(1)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <Filter className="w-4 h-4" /> تصفية
            </button>
          </div>

          {/* Selection bar — deletion itself lives in the danger tab */}
          {p.selectedIds.size > 0 && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 bg-zinc-900 border border-red-500/40 rounded-2xl px-5 py-3 mb-3">
              <span className="text-red-300 font-bold text-sm">تم تحديد {p.selectedIds.size} مطعم</span>
              <div className="flex gap-2">
                <button onClick={p.onClearSelection} className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-700">إلغاء التحديد</button>
                <button onClick={() => setTab('danger')}
                  className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg border border-red-500/40">
                  <AlertTriangle className="w-3.5 h-3.5" /> الحذف الجماعي في منطقة الخطر
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500 text-xs">
                    <th className="px-3 py-3 text-center w-10">
                      <input type="checkbox" className="accent-purple-500 w-4 h-4 cursor-pointer"
                        checked={filtered.filter(t => !t.isDemo).length > 0 && filtered.filter(t => !t.isDemo).every(t => p.selectedIds.has(t.id))}
                        onChange={e => e.target.checked ? p.onSelectAll() : p.onClearSelection()} />
                    </th>
                    <th className="px-4 py-3 text-start font-semibold">المطعم</th>
                    <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                    <th className="px-4 py-3 text-center font-semibold">التجربة</th>
                    <th className="px-4 py-3 text-center font-semibold">طلبات/أسبوع</th>
                    <th className="px-4 py-3 text-start font-semibold">الباقة</th>
                    <th className="px-4 py-3 text-end font-semibold">الرصيد</th>
                    <th className="px-4 py-3 text-start font-semibold">الإعداد</th>
                    <th className="px-4 py-3 text-start font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filtered.map(t => {
                    const bal     = Number(t.walletBalance)
                    const days    = trialDaysLeft(t.trialEndsAt)
                    const checked = p.selectedIds.has(t.id)
                    return (
                      <tr key={t.id} onClick={() => p.onOpenModal(t)}
                        className={`transition-colors cursor-pointer ${checked ? 'bg-red-500/10' : 'hover:bg-zinc-800/50'}`}>
                        <td className="px-3 py-3 text-center" onClick={e => { e.stopPropagation(); p.onToggleSelect(t.id, t.isDemo) }}>
                          {t.isDemo
                            ? <span className="text-amber-400 select-none" title="محمي">🛡</span>
                            : <input type="checkbox" className="accent-purple-500 w-4 h-4 cursor-pointer" checked={checked} onChange={() => p.onToggleSelect(t.id, t.isDemo)} />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-100 flex items-center gap-2 flex-wrap text-sm">
                            {t.businessName || t.name}
                            {t.isDemo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">تجريبي</span>}
                            {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Package className="w-2.5 h-2.5" /> المخزون
                              </span>
                            )}
                          </div>
                          <div className="text-zinc-500 text-xs font-mono" dir="ltr">{t.subdomain}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BILLING_COLORS[t.billingStatus] ?? 'bg-zinc-800 text-zinc-400'}`}>
                            {statusLabel(t.billingStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {days == null ? <span className="text-zinc-600">—</span>
                            : days > 0  ? <span className="text-amber-400 font-semibold">{days} يوم</span>
                            :             <span className="text-red-400 font-semibold">منتهية</span>}
                          {t.hasExtendedTrial && <span className="ms-1 text-sky-400 text-[10px]" title="مُمدّدة">↗</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-zinc-200">{t.weeklyOrderCount ?? t._count.orders}</span>
                        </td>
                        <td className="px-4 py-3">
                          {t.subscriptionTier
                            ? <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_COLORS[t.subscriptionTier] ?? 'bg-zinc-800 text-zinc-400'}`}>{statusLabel(t.subscriptionTier)}</span>
                            : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className={`px-4 py-3 font-bold text-xs text-end ${bal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {bal.toFixed(2)} <span className="text-zinc-500 font-normal">{t.currency}</span>
                        </td>
                        <td className="px-4 py-3 min-w-[120px]">
                          <OnboardingProgress tenant={t} />
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 flex-wrap">
                            {t.billingStatus !== 'SUSPENDED'
                              ? <RowBtn icon={<Ban className="w-3 h-3" />} label="إيقاف" color="red" loading={p.actionId === t.id} onClick={() => { p.onSuspend(t.id); logActivity('إيقاف', t.businessName || t.name) }} />
                              : <RowBtn icon={<CheckCircle className="w-3 h-3" />} label="تفعيل" color="green" loading={p.actionId === t.id} onClick={() => { p.onReactivate(t.id); logActivity('تفعيل', t.businessName || t.name) }} />}
                            <RowBtn icon={<Edit3 className="w-3 h-3" />} label="الإعدادات" color="blue" loading={false} onClick={() => p.onOpenModal(t, 'billing')} />
                            <RowBtn icon={<Trash2 className="w-3 h-3" />} label="حذف" color="red" loading={false} onClick={() => p.onDeleteConfirm(t)} />
                            <RowBtn icon={<span className="text-[11px]">{t.isDemo ? '🛡' : '🔓'}</span>} label={t.isDemo ? 'محمي' : 'حماية'} color={t.isDemo ? 'amber' : 'blue'} loading={false} onClick={() => p.onToggleDemoFlag(t.id, t.isDemo)} />
                            {t.inventoryActivationRequested && !t.isSmartInventoryEnabled && (
                              <RowBtn icon={<Package className="w-3 h-3" />} label="تفعيل المخزون" color="amber" loading={p.actionId === t.id} onClick={() => p.onApproveInventory(t.id)} />
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
              <div className="flex items-center justify-center py-10 gap-2 text-zinc-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
              </div>
            )}
            {!p.loading && filtered.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-sm">لا توجد مطاعم</div>
            )}
            {hasMore && !p.loading && (
              <div className="p-4 text-center border-t border-zinc-800">
                <button onClick={p.onLoadMore}
                  className="text-sm text-zinc-500 hover:text-purple-300 flex items-center gap-1 mx-auto transition-colors">
                  <ChevronDown className="w-4 h-4" /> تحميل المزيد ({p.total - p.tenants.length} متبقٍ)
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Demo requests ── */}
      {tab === 'demo' && (
        <section>
          <SectionHeading icon={<CalendarPlus className="w-4 h-4" />} title="طلبات العرض التجريبي" />
          <div className={`${card} p-4`}>
            <div className="flex gap-1 mb-3">
              {(['pending', 'activated', 'rejected'] as const).map(dt => (
                <button key={dt} onClick={() => { p.onSetDemoTab(dt); p.onLoadDemoRequests(dt) }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    p.demoTab === dt ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}>
                  {DEMO_TABS[dt]}
                </button>
              ))}
            </div>
            {p.demoLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : p.demoRequests.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs">لا توجد طلبات</div>
            ) : (
              <div className="space-y-2">
                {p.demoRequests.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-100 text-xs font-bold truncate">{d.businessName}</p>
                      <p className="text-zinc-500 text-[10px]">{d.city} · {d.country}</p>
                    </div>
                    {d.status === 'pending' && (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => p.onActivateDemo(d.id)} disabled={p.activatingDemo === d.id}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                          {p.activatingDemo === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          تفعيل
                        </button>
                        <button onClick={() => p.onRejectDemo(d.id)}
                          className="bg-zinc-700 hover:bg-red-800 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg">
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Premium plans ── */}
      {tab === 'plans' && (
        <section>
          <SectionHeading icon={<Gem className="w-4 h-4 text-amber-400" />} title="الباقات المميزة" subtitle="الأسعار والميزات حسب الدولة" />
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 border-b border-zinc-800">
                  <tr className="text-xs font-semibold text-zinc-500">
                    <th className="px-4 py-3 text-start">الدولة</th>
                    <th className="px-4 py-3 text-start">السعر / شهر</th>
                    <th className="px-4 py-3 text-center">بدون عمولة</th>
                    <th className="px-4 py-3 text-center">التسويق</th>
                    <th className="px-4 py-3 text-center">الشهادة</th>
                    <th className="px-4 py-3 text-center">التحليلات</th>
                    <th className="px-4 py-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {p.premiumPlans.map(plan => (
                    <tr key={plan.country} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded-md text-xs">{plan.country}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.editingPlan?.country === plan.country ? (
                          <input type="number" value={p.editingPlan.monthlyPrice}
                            onChange={e => p.onSetEditingPlan({ ...p.editingPlan!, monthlyPrice: Number(e.target.value) })}
                            className={`${input} w-28`} />
                        ) : (
                          <span className="font-bold text-emerald-400">{plan.monthlyPrice} <span className="text-zinc-500 font-normal text-xs">{plan.currency}</span></span>
                        )}
                      </td>
                      {(['hasNoCommission', 'hasMarketing', 'hasCertification', 'hasAnalytics'] as const).map(key => (
                        <td key={key} className="px-4 py-3 text-center">
                          <input type="checkbox"
                            checked={p.editingPlan?.country === plan.country ? p.editingPlan[key] : plan[key]}
                            onChange={e => {
                              if (p.editingPlan?.country === plan.country) {
                                p.onSetEditingPlan({ ...p.editingPlan!, [key]: e.target.checked })
                              } else {
                                p.onSavePlan(plan.country, { [key]: e.target.checked })
                              }
                            }}
                            className="w-4 h-4 accent-purple-500 cursor-pointer" />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        {p.editingPlan?.country === plan.country ? (
                          <div className="flex gap-1.5 justify-center">
                            <button onClick={() => p.onSavePlan(plan.country, { monthlyPrice: p.editingPlan!.monthlyPrice })}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-xs font-medium">حفظ</button>
                            <button onClick={() => p.onSetEditingPlan(null)}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-medium">إلغاء</button>
                          </div>
                        ) : (
                          <button onClick={() => p.onSetEditingPlan({ ...plan })}
                            className="flex items-center gap-1 mx-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                            <Edit3 className="w-3 h-3" /> تعديل
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Password reset requests ── */}
      {tab === 'resets' && (
        <section>
          <SectionHeading icon={<KeyRound className="w-4 h-4" />} title="طلبات إعادة تعيين كلمة المرور" subtitle="إرسال كلمة مرور مؤقتة بالبريد الإلكتروني أو رفض الطلب" />
          <div className={`${card} p-4`}>
            {p.pwResetLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : p.pwResets.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-6">لا توجد طلبات</p>
            ) : (
              <div className="space-y-2">
                {p.pwResets.map(r => (
                  <div key={r.id} className="bg-zinc-800/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-zinc-100 text-xs font-semibold truncate">{r.cafeName || '—'}</p>
                      <p className="text-zinc-400 text-xs truncate" dir="ltr">{r.email}</p>
                      <p className="text-zinc-500 text-[10px]">{new Date(r.createdAt).toLocaleString(AR_LOCALE)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RESET_COLORS[r.status] ?? 'bg-zinc-700 text-zinc-400'}`}>{statusLabel(r.status)}</span>
                      {['PENDING', 'SENT'].includes(r.status) && <>
                        <button onClick={() => p.onApproveReset(r.id)} disabled={p.approvingReset === r.id}
                          className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                          {p.approvingReset === r.id ? '…' : 'إرسال'}
                        </button>
                        <button onClick={() => p.onRejectReset(r.id)}
                          className="bg-zinc-700 hover:bg-red-800 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg">
                          رفض
                        </button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Activity log ── */}
      {tab === 'log' && (
        <section>
          <SectionHeading icon={<Activity className="w-4 h-4" />} title="سجل النشاط" subtitle="آخر إجراءات المشرف العام (محفوظة في هذا المتصفح فقط)" />
          <ActivityLog />
        </section>
      )}

      {/* ── Danger zone ── */}
      {tab === 'danger' && (
        <section className="space-y-4">
          <SectionHeading icon={<AlertTriangle className="w-4 h-4 text-red-400" />} title="منطقة الخطر" subtitle="عمليات حساسة أو لا يمكن التراجع عنها — استخدمها بحذر" />

          <div className={`${card} border-red-500/30 p-5 space-y-2`}>
            <p className="text-zinc-200 text-sm font-semibold">تشغيل تحليل الفوترة</p>
            <p className="text-zinc-500 text-xs">يعيد احتساب حالة الفوترة لكل المطاعم وقد يغيّر حالتها.</p>
            <button onClick={() => { if (confirm('تشغيل تحليل الفوترة لكل المطاعم الآن؟')) p.onRunSweep() }} disabled={p.sweeping}
              className="flex items-center gap-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl text-sm">
              {p.sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              تشغيل التحليل
            </button>
          </div>

          {p.onOpenPurge && (
            <div className={`${card} border-red-500/30 p-5 space-y-2`}>
              <p className="text-zinc-200 text-sm font-semibold">حذف بيانات الاختبار</p>
              <p className="text-zinc-500 text-xs">يحذف كل المطاعم ما عدا النطاقات الفرعية المحمية والمطاعم التجريبية.</p>
              <button onClick={p.onOpenPurge}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
                <Flame className="w-4 h-4" /> حذف بيانات الاختبار…
              </button>
            </div>
          )}

          <div className={`${card} border-red-500/30 p-5 space-y-2`}>
            <p className="text-zinc-200 text-sm font-semibold">الحذف الجماعي</p>
            <p className="text-zinc-500 text-xs">
              {p.selectedIds.size > 0
                ? `تم تحديد ${p.selectedIds.size} مطعم من تبويب «المطاعم».`
                : 'حدّد المطاعم أولاً من تبويب «المطاعم».'}
            </p>
            <div className="flex gap-2">
              <button onClick={p.onBulkDelete} disabled={p.bulkDeleting || p.selectedIds.size === 0}
                className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl text-sm">
                {p.bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف المحدد ({p.selectedIds.size})
              </button>
              {p.selectedIds.size > 0 && (
                <button onClick={p.onClearSelection} className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-700">إلغاء التحديد</button>
              )}
            </div>
          </div>

          <div className={`${card} border-red-500/30 p-5 space-y-2`}>
            <p className="text-zinc-200 text-sm font-semibold">حذف حساب عبر البريد الإلكتروني</p>
            <div className="flex gap-2 max-w-lg">
              <input type="email" dir="ltr" value={p.deleteEmail} onChange={e => p.onSetDeleteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && p.onDeleteByEmail()}
                placeholder="admin@restaurant.com"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-red-500" />
              <button onClick={p.onDeleteByEmail} disabled={p.delByEmail || !p.deleteEmail.trim()}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm">
                {p.delByEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── MRR breakdown modal ── */}
      {p.mrrOpen && p.mrrData && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => p.onSetMrrOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-violet-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> تفصيل الإيراد الشهري المتكرر
                </h3>
                <p className="text-violet-200 text-xs mt-0.5">{new Date(p.mrrData.computedAt).toLocaleString(AR_LOCALE)}</p>
              </div>
              <p className="text-3xl font-extrabold text-white" dir="ltr">${p.mrrData.totalMRR_USD.toFixed(0)}</p>
            </div>
            <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 px-2 pb-2 border-b border-zinc-800">
                <span>الدولة</span><span className="text-end">المطاعم</span>
                <span className="text-end">بالعملة المحلية</span><span className="text-end">USD</span>
              </div>
              {p.mrrData.byCountry.map((r: any) => (
                <div key={r.country} className="grid grid-cols-4 items-center px-2 py-2 hover:bg-zinc-800/50 rounded-xl text-sm">
                  <span className="font-bold text-zinc-100">{r.country}</span>
                  <span className="text-end text-zinc-400">{r.cafes}</span>
                  <span className="text-end text-zinc-300 text-xs">{r.monthlyCommissionLocal.toFixed(0)} {r.currency}</span>
                  <span className="text-end font-extrabold text-violet-300" dir="ltr">${r.monthlyUSD.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => p.onSetMrrOpen(false)} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100 px-3 py-1 text-sm font-medium">
                <X className="w-4 h-4" /> إغلاق
              </button>
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
    red:   'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30',
    green: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    blue:  'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30',
    amber: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 ${cls[color]} px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )
}
