# SuperAdmin — Plan 1: Theme Redesign + Analytics UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the superadmin dashboard into a parent + 3 swappable theme components, add a top-bar theme switcher, and build analytics widgets (KPI cards, revenue chart, churn alerts, onboarding progress, activity log).

**Architecture:** `app/superadmin/page.tsx` becomes a pure data/logic parent that passes all state and handlers as props to whichever theme component (`ThemeA`, `ThemeB`, `ThemeC`) is active. All themes share the same analytics widgets. Theme choice is persisted in `localStorage('superadmin-theme')`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, SVG (no chart library), `localStorage`, Express backend at `src/routes/superadmin.ts`

---

## File Map

**Create:**
- `app/superadmin/components/types.ts` — shared TypeScript interfaces + ThemeProps
- `app/superadmin/components/ThemeSwitcher.tsx` — A/B/C switcher buttons
- `app/superadmin/components/analytics/KpiCards.tsx` — 5 stat cards with trend
- `app/superadmin/components/analytics/RevenueChart.tsx` — SVG 6-bar chart
- `app/superadmin/components/analytics/ChurnAlerts.tsx` — tenants with 0 orders
- `app/superadmin/components/analytics/OnboardingProgress.tsx` — 5-step progress per tenant
- `app/superadmin/components/analytics/ActivityLog.tsx` — localStorage action log
- `app/superadmin/components/themes/ThemeA.tsx` — Dark Premium (sidebar)
- `app/superadmin/components/themes/ThemeB.tsx` — Glass Sidebar
- `app/superadmin/components/themes/ThemeC.tsx` — Minimal Pro (top nav)

**Modify:**
- `app/superadmin/page.tsx` — strip all JSX, keep only data/logic/state
- `src/routes/superadmin.ts` — extend `tenants/rich` to include `tables`+`staff`+`categories` counts; add `/revenue-history` endpoint

---

## Task 1 — Shared Types

**Files:**
- Create: `app/superadmin/components/types.ts`

- [ ] Create the file with all shared interfaces:

```typescript
// app/superadmin/components/types.ts

export interface Overview {
  totalCafes:       number
  activeCafes:      number
  suspendedCafes:   number
  trialCafes:       number
  economyCafes:     number
  advancedCafes:    number
  totalAccruedDebt: number
  totalRevenue:     number
  mrr:              number
}

export interface Tenant {
  id:               string
  name:             string
  businessName:     string
  subdomain:        string
  country:          string
  currency:         string
  isActive:         boolean
  walletBalance:    number
  billingStatus:    string
  trialEndsAt:      string | null
  hasExtendedTrial: boolean
  subscriptionTier: string | null
  monthlyFee:       number | null
  coffeeRefPrice:   number | null
  sandwichRefPrice: number | null
  weeklyOrderCount: number | null
  billingCycle:     number | null
  maintenancePack:  boolean
  maintenanceFee:   number | null
  nextBillingDate:  string | null
  isSmartInventoryEnabled:        boolean
  inventoryActivationRequested:   boolean
  inventoryActivationRequestedAt: string | null
  isDemo:           boolean
  _count: {
    orders:     number
    tables:     number
    staff:      number
    categories: number
  }
}

export interface MrrData {
  totalMRR_USD: number
  computedAt:   string
  byCountry:    {
    country:                 string
    cafes:                   number
    currency:                string
    monthlyCommissionLocal:  number
    monthlyMaintenanceUSD:   number
    monthlyUSD:              number
  }[]
}

export interface ModalState {
  tenant:          Tenant
  tab:             'billing' | 'trial' | 'activate'
  loading:         boolean
  error:           string
  coffee:          string
  sandwich:        string
  days:            string
  fee:             string
  tier:            string
  billingCycle:    number
  maintenance:     boolean
  maintenanceFee:  string
  preview:  { tier: string; monthlyFee: number; weeklyOrderCount: number } | null
}

export type Theme = 'A' | 'B' | 'C'

export interface ThemeProps {
  // ── Data ────────────────────────────────────────────────────────
  overview:      Overview | null
  tenants:       Tenant[]
  total:         number
  mrrData:       MrrData | null
  demoRequests:  any[]
  demoTab:       'pending' | 'activated' | 'rejected'
  revenueHistory: { month: string; value: number }[]

  // ── UI state ─────────────────────────────────────────────────────
  loading:         boolean
  sweeping:        boolean
  sweepMsg:        string
  page:            number
  filterCountry:   string
  filterStatus:    string
  filterTier:      string
  sortBal:         'asc' | 'desc'
  actionId:        string | null
  selectedIds:     Set<string>
  bulkDeleting:    boolean
  deleteEmail:     string
  delByEmail:      boolean
  demoLoading:     boolean
  activatingDemo:  string | null
  mrrOpen:         boolean
  theme:           Theme

  // ── Callbacks ────────────────────────────────────────────────────
  onLoadAll:           (p?: number, append?: boolean) => void
  onRunSweep:          () => void
  onSuspend:           (id: string) => void
  onReactivate:        (id: string) => void
  onOpenModal:         (tenant: Tenant, tab?: 'billing' | 'trial' | 'activate') => void
  onDeleteConfirm:     (tenant: Tenant) => void
  onToggleSelect:      (id: string, isDemo: boolean) => void
  onSelectAll:         () => void
  onClearSelection:    () => void
  onBulkDelete:        () => void
  onToggleDemoFlag:    (id: string, current: boolean) => void
  onApproveInventory:  (id: string) => void
  onDeleteByEmail:     () => void
  onSetDeleteEmail:    (v: string) => void
  onLoadDemoRequests:  (status: string) => void
  onActivateDemo:      (id: string) => void
  onRejectDemo:        (id: string) => void
  onSetDemoTab:        (t: 'pending' | 'activated' | 'rejected') => void
  onSetFilterCountry:  (v: string) => void
  onSetFilterStatus:   (v: string) => void
  onSetFilterTier:     (v: string) => void
  onSetSortBal:        (v: 'asc' | 'desc') => void
  onSetMrrOpen:        (v: boolean) => void
  onSetTheme:          (t: Theme) => void
  onLoadMore:          () => void
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/types.ts
git commit -m "feat(superadmin): add shared types for theme refactor"
```

---

## Task 2 — ThemeSwitcher

**Files:**
- Create: `app/superadmin/components/ThemeSwitcher.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/ThemeSwitcher.tsx
'use client'
import type { Theme } from './types'

interface Props {
  current: Theme
  onChange: (t: Theme) => void
}

const THEMES: { id: Theme; label: string; title: string }[] = [
  { id: 'A', label: 'A', title: 'Dark Premium' },
  { id: 'B', label: 'B', title: 'Glass Sidebar' },
  { id: 'C', label: 'C', title: 'Minimal Pro' },
]

export default function ThemeSwitcher({ current, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-xl p-0.5" title="Switch theme">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          title={t.title}
          className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
            current === t.id
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/ThemeSwitcher.tsx
git commit -m "feat(superadmin): add ThemeSwitcher component"
```

---

## Task 3 — Backend: Extend tenants/rich + add revenue-history

**Files:**
- Modify: `src/routes/superadmin.ts`

- [ ] In `src/routes/superadmin.ts`, find the `tenants/rich` `_count` select (around line 492) and extend it:

```typescript
// BEFORE:
_count: { select: { orders: true } }

// AFTER:
_count: { select: { orders: true, tables: true, staff: true, categories: true } }
```

- [ ] Add a new endpoint just before `export default router` at the end of the file:

```typescript
// ─── GET /api/superadmin/revenue-history ──────────────────────────────────────
// Returns commission totals for the last 6 calendar months.
router.get('/api/superadmin/revenue-history', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const months: { month: string; value: number }[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const agg   = await prisma.order.aggregate({
        _sum: { totalCommission: true },
        where: { isPaid: true, createdAt: { gte: start, lt: end } }
      })
      months.push({
        month: start.toLocaleDateString('fr-MA', { month: 'short', year: '2-digit' }),
        value: parseFloat((agg._sum.totalCommission ?? 0).toFixed(2))
      })
    }

    return res.json(months)
  } catch (err) {
    logger.error({ msg: 'GET revenue-history error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] Restart the backend server to apply changes:
```bash
# In the terminal running the Express server, Ctrl+C then:
npm run dev
```

- [ ] Verify endpoint works:
```bash
curl -s "http://localhost:4000/api/superadmin/revenue-history" \
  -H "x-superadmin-secret: $(grep SUPERADMIN_SECRET .env | cut -d= -f2)" \
  -H "x-superadmin-email: $(grep SUPERADMIN_EMAIL .env | cut -d= -f2)"
# Expected: JSON array of 6 objects with { month, value }
```

- [ ] Commit:
```bash
git add src/routes/superadmin.ts
git commit -m "feat(superadmin): add table/staff/category counts to tenants/rich + revenue-history endpoint"
```

---

## Task 4 — KpiCards

**Files:**
- Create: `app/superadmin/components/analytics/KpiCards.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/analytics/KpiCards.tsx
import type { Overview, MrrData } from '../types'

interface Props {
  overview: Overview
  mrrData:  MrrData | null
  onOpenMrr: () => void
}

interface Card {
  label:  string
  value:  string | number
  trend?: string
  trendUp?: boolean
  color:  string
  bg:     string
  border: string
  icon:   string
}

export default function KpiCards({ overview, mrrData, onOpenMrr }: Props) {
  const cards: Card[] = [
    {
      label: 'إجمالي المطاعم',
      value: overview.totalCafes,
      color: 'text-blue-400', bg: 'from-blue-950/60 to-gray-900', border: 'border-blue-800/40',
      icon: '🏪',
    },
    {
      label: 'نشطة',
      value: overview.activeCafes,
      trend: `${Math.round((overview.activeCafes / Math.max(overview.totalCafes, 1)) * 100)}%`,
      trendUp: true,
      color: 'text-emerald-400', bg: 'from-emerald-950/60 to-gray-900', border: 'border-emerald-800/40',
      icon: '✅',
    },
    {
      label: 'في التجربة',
      value: overview.trialCafes,
      color: 'text-amber-400', bg: 'from-amber-950/60 to-gray-900', border: 'border-amber-800/40',
      icon: '⏳',
    },
    {
      label: 'موقوفة',
      value: overview.suspendedCafes,
      color: 'text-red-400', bg: 'from-red-950/60 to-gray-900', border: 'border-red-800/40',
      icon: '⛔',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <div key={i} className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl">{c.icon}</span>
            {c.trend && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${c.trendUp ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                {c.trend}
              </span>
            )}
          </div>
          <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
          <div className="text-gray-500 text-xs mt-1 font-medium">{c.label}</div>
        </div>
      ))}

      {/* MRR card */}
      <div className="bg-gradient-to-br from-violet-950/60 to-gray-900 border border-violet-800/40 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl">💎</span>
          <button
            onClick={onOpenMrr}
            className="w-5 h-5 rounded-full bg-violet-900/60 hover:bg-violet-700 flex items-center justify-center text-violet-400 hover:text-white text-[10px] font-black transition-colors"
            title="Breakdown"
          >
            i
          </button>
        </div>
        {mrrData ? (
          <div className="text-3xl font-black text-violet-400">${mrrData.totalMRR_USD.toFixed(0)}</div>
        ) : (
          <div className="text-3xl font-black text-violet-400 animate-pulse">…</div>
        )}
        <div className="text-gray-500 text-xs mt-1 font-medium">MRR / شهر</div>
      </div>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/analytics/KpiCards.tsx
git commit -m "feat(superadmin): add KpiCards analytics component"
```

---

## Task 5 — RevenueChart

**Files:**
- Create: `app/superadmin/components/analytics/RevenueChart.tsx`

- [ ] Create the SVG bar chart (no external library):

```tsx
// app/superadmin/components/analytics/RevenueChart.tsx

interface Props {
  data: { month: string; value: number }[]
}

export default function RevenueChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">الإيراد الشهري</h3>
          <p className="text-gray-500 text-xs mt-0.5">آخر 6 أشهر (MAD)</p>
        </div>
        <span className="text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
          {data[data.length - 1]?.value.toFixed(0) ?? '—'} هذا الشهر
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-600 text-sm">لا توجد بيانات</div>
      ) : (
        <div className="flex items-end gap-2 h-24">
          {data.map((d, i) => {
            const isLast   = i === data.length - 1
            const heightPct = Math.max((d.value / max) * 100, 4)
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1 group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {d.value.toFixed(2)}
                </div>
                <div
                  className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-emerald-500' : 'bg-emerald-800/50 group-hover:bg-emerald-700/70'}`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className={`text-[9px] font-medium ${isLast ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {d.month}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/analytics/RevenueChart.tsx
git commit -m "feat(superadmin): add RevenueChart SVG component"
```

---

## Task 6 — ChurnAlerts

**Files:**
- Create: `app/superadmin/components/analytics/ChurnAlerts.tsx`

- [ ] Create the component (uses `_count.orders === 0` as churn proxy):

```tsx
// app/superadmin/components/analytics/ChurnAlerts.tsx
import type { Tenant } from '../types'

interface Props {
  tenants:     Tenant[]
  onOpenModal: (tenant: Tenant) => void
}

export default function ChurnAlerts({ tenants, onOpenModal }: Props) {
  const at_risk = tenants.filter(t => !t.isDemo && t._count.orders === 0 && t.billingStatus !== 'SUSPENDED')

  if (at_risk.length === 0) return null

  return (
    <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚠️</span>
        <h3 className="text-red-400 font-bold text-sm">
          {at_risk.length} مطعم بدون أي طلبية
        </h3>
        <span className="text-gray-600 text-xs">— تحتاج متابعة</span>
      </div>
      <div className="space-y-2">
        {at_risk.slice(0, 5).map(t => (
          <div key={t.id} className="flex items-center justify-between bg-red-950/30 rounded-xl px-3 py-2">
            <div>
              <span className="text-white text-xs font-bold">{t.businessName || t.name}</span>
              <span className="text-gray-600 text-xs mr-2">· {t.subdomain}</span>
            </div>
            <button
              onClick={() => onOpenModal(t)}
              className="text-[10px] font-bold bg-red-700 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              متابعة
            </button>
          </div>
        ))}
        {at_risk.length > 5 && (
          <p className="text-gray-600 text-xs text-center">+ {at_risk.length - 5} أخرى</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/analytics/ChurnAlerts.tsx
git commit -m "feat(superadmin): add ChurnAlerts component"
```

---

## Task 7 — OnboardingProgress

**Files:**
- Create: `app/superadmin/components/analytics/OnboardingProgress.tsx`

- [ ] Create the component (5 steps derived from existing Tenant fields):

```tsx
// app/superadmin/components/analytics/OnboardingProgress.tsx
import type { Tenant } from '../types'

interface Props {
  tenant: Tenant
}

interface Step {
  label: string
  done:  boolean
}

function getSteps(t: Tenant): Step[] {
  return [
    { label: 'منيو',     done: t._count.categories > 0 },
    { label: 'طاولات',   done: t._count.tables > 0 },
    { label: 'موظفين',   done: t._count.staff > 0 },
    { label: 'طلبية',    done: t._count.orders > 0 },
    { label: 'فاتورة',   done: t.subscriptionTier != null },
  ]
}

export default function OnboardingProgress({ tenant }: Props) {
  const steps    = getSteps(tenant)
  const done     = steps.filter(s => s.done).length
  const pct      = Math.round((done / steps.length) * 100)
  const complete = done === steps.length

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-400' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] font-bold ${complete ? 'text-emerald-400' : 'text-amber-400'}`}>
          {done}/{steps.length}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <span
            key={i}
            title={s.label}
            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              s.done
                ? 'bg-emerald-900/60 text-emerald-400'
                : 'bg-gray-800 text-gray-600'
            }`}
          >
            {s.done ? '✓' : '○'} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/analytics/OnboardingProgress.tsx
git commit -m "feat(superadmin): add OnboardingProgress component"
```

---

## Task 8 — ActivityLog

**Files:**
- Create: `app/superadmin/components/analytics/ActivityLog.tsx`

- [ ] Create the component + the `logActivity` helper:

```tsx
// app/superadmin/components/analytics/ActivityLog.tsx
'use client'
import { useEffect, useState } from 'react'

const KEY     = 'superadmin-activity-log'
const MAX_LOG = 100

export interface ActivityEntry {
  action:     string
  tenantName: string
  timestamp:  string
}

export function logActivity(action: string, tenantName: string) {
  try {
    const existing: ActivityEntry[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    const entry: ActivityEntry = {
      action,
      tenantName,
      timestamp: new Date().toISOString(),
    }
    const updated = [entry, ...existing].slice(0, MAX_LOG)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {}
}

export default function ActivityLog() {
  const [entries,  setEntries]  = useState<ActivityEntry[]>([])
  const [open,     setOpen]     = useState(false)

  useEffect(() => {
    try {
      setEntries(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    } catch {}
  }, [open])

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/40 transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <span>🗂</span>
          <span className="text-gray-400 font-bold">سجل النشاط</span>
          {entries.length > 0 && (
            <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
              {entries.length}
            </span>
          )}
        </div>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 max-h-56 overflow-y-auto divide-y divide-gray-800/50">
          {entries.length === 0 ? (
            <p className="text-center py-6 text-gray-600 text-sm">لا يوجد نشاط بعد</p>
          ) : (
            entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <span className="text-white text-xs font-medium">{e.action}</span>
                  <span className="text-gray-500 text-xs mr-1.5">· {e.tenantName}</span>
                </div>
                <span className="text-gray-700 text-[10px]">
                  {new Date(e.timestamp).toLocaleString('ar-MA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit:
```bash
git add app/superadmin/components/analytics/ActivityLog.tsx
git commit -m "feat(superadmin): add ActivityLog component with logActivity helper"
```

---

## Task 9 — ThemeA (Dark Premium)

**Files:**
- Create: `app/superadmin/components/themes/ThemeA.tsx`

ThemeA is the refactored version of the current `page.tsx` JSX — dark sidebar on the right (RTL), gradient KPI cards, the analytics widgets above the tenant table.

- [ ] Create `app/superadmin/components/themes/ThemeA.tsx`:

```tsx
// app/superadmin/components/themes/ThemeA.tsx
'use client'
import { useState } from 'react'
import { Loader2, RefreshCw, Filter, Ban, CheckCircle, Edit3, Trash2, ChevronDown, ChevronUp, X, Play, CalendarPlus, Package, Globe, TrendingUp } from 'lucide-react'
import type { ThemeProps, Tenant, ModalState } from '../types'
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white leading-none">Super Admin</h1>
            <p className="text-gray-500 text-xs mt-0.5">Smart Resto · لوحة التحكم العليا</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeSwitcher current={p.theme} onChange={p.onSetTheme} />
            {p.sweepMsg && <span className="text-emerald-400 text-xs bg-emerald-950/50 border border-emerald-700 px-3 py-1 rounded-full">{p.sweepMsg}</span>}
            <a href="/superadmin/landing" className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-xl text-sm font-bold transition-colors">
              <Globe className="w-4 h-4" /> Landing
            </a>
            <button onClick={p.onRunSweep} disabled={p.sweeping}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-bold transition-colors">
              {p.sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              تحليل
            </button>
            <button onClick={() => p.onLoadAll(1)} disabled={p.loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${p.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI + Charts ── */}
        {p.overview && (
          <KpiCards overview={p.overview} mrrData={p.mrrData} onOpenMrr={() => p.onSetMrrOpen(true)} />
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <RevenueChart data={p.revenueHistory} />
          </div>
          <div className="space-y-3">
            {/* Demo Requests mini */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold text-sm">طلبات التجربة</span>
                </div>
                <div className="flex gap-1">
                  {(['pending','activated','rejected'] as const).map(t => (
                    <button key={t} onClick={() => { p.onSetDemoTab(t); p.onLoadDemoRequests(t) }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${p.demoTab === t ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                      {{ pending:'معلق', activated:'مُفعّل', rejected:'مرفوض' }[t]}
                    </button>
                  ))}
                </div>
              </div>
              {p.demoRequests.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-3">لا توجد طلبات</p>
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
                          تفعيل
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
        <ChurnAlerts tenants={p.tenants} onOpenModal={p.onOpenModal} />

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
```

- [ ] Commit:
```bash
git add app/superadmin/components/themes/ThemeA.tsx
git commit -m "feat(superadmin): add ThemeA Dark Premium component"
```

---

## Task 10 — ThemeB (Glass Sidebar)

**Files:**
- Create: `app/superadmin/components/themes/ThemeB.tsx`

- [ ] Create ThemeB:

```tsx
// app/superadmin/components/themes/ThemeB.tsx
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
```

- [ ] Commit:
```bash
git add app/superadmin/components/themes/ThemeB.tsx
git commit -m "feat(superadmin): add ThemeB Glass Sidebar component"
```

---

## Task 11 — ThemeC (Minimal Pro)

**Files:**
- Create: `app/superadmin/components/themes/ThemeC.tsx`

- [ ] Create ThemeC:

```tsx
// app/superadmin/components/themes/ThemeC.tsx
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
```

- [ ] Commit:
```bash
git add app/superadmin/components/themes/ThemeC.tsx
git commit -m "feat(superadmin): add ThemeC Minimal Pro component"
```

---

## Task 12 — Refactor page.tsx to pure data parent

**Files:**
- Modify: `app/superadmin/page.tsx` — replace all JSX with theme switcher logic

This is the final wiring task. Replace the entire return statement (and all JSX) in `page.tsx` with the following, keeping all state and handler functions unchanged:

- [ ] Add these imports at the top of `app/superadmin/page.tsx` (replace the existing lucide + component imports block):

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Trash2, X, BarChart3, CalendarPlus, Zap } from 'lucide-react'
import type { Overview, Tenant, MrrData, ModalState, Theme } from './components/types'
import ThemeA from './components/themes/ThemeA'
import ThemeB from './components/themes/ThemeB'
import ThemeC from './components/themes/ThemeC'
```

- [ ] Add `revenueHistory` state and fetch after the existing `mrrData` state (around line 162):

```typescript
const [revenueHistory, setRevenueHistory] = useState<{ month: string; value: number }[]>([])
```

- [ ] Add `theme` state (after `mrrOpen`):

```typescript
const [theme, setTheme] = useState<Theme>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('superadmin-theme') as Theme) ?? 'A'
  }
  return 'A'
})

function handleSetTheme(t: Theme) {
  setTheme(t)
  localStorage.setItem('superadmin-theme', t)
}
```

- [ ] In the `loadAll` function, after `setMrrData(d)`, add a revenue history fetch:

```typescript
fetch('/api/superadmin/revenue-history', { headers: superHeader() })
  .then(r => r.ok ? r.json() : null)
  .then(d => d && setRevenueHistory(d))
```

- [ ] Replace the entire `return (...)` block in `page.tsx` (everything after the login screen guard `if (!authed)`) with:

```tsx
  // ── Build shared props ──────────────────────────────────────────────────────
  const themeProps = {
    overview, tenants, total, mrrData, demoRequests, demoTab, revenueHistory,
    loading, sweeping, sweepMsg, page, filterCountry, filterStatus, filterTier,
    sortBal, actionId, selectedIds, bulkDeleting, deleteEmail, delByEmail,
    demoLoading, activatingDemo, mrrOpen, theme,
    onLoadAll:          loadAll,
    onRunSweep:         runSweep,
    onSuspend:          suspend,
    onReactivate:       reactivate,
    onOpenModal:        openModal,
    onDeleteConfirm:    setDeleteConfirm,
    onToggleSelect:     toggleSelect,
    onSelectAll:        selectAll,
    onClearSelection:   clearSelection,
    onBulkDelete:       bulkDelete,
    onToggleDemoFlag:   toggleDemoFlag,
    onApproveInventory: approveInventory,
    onDeleteByEmail:    deleteByEmail,
    onSetDeleteEmail:   setDeleteEmail,
    onLoadDemoRequests: loadDemoRequests,
    onActivateDemo:     activateDemo,
    onRejectDemo:       rejectDemo,
    onSetDemoTab:       setDemoTab,
    onSetFilterCountry: setFilterCountry,
    onSetFilterStatus:  setFilterStatus,
    onSetFilterTier:    setFilterTier,
    onSetSortBal:       setSortBal,
    onSetMrrOpen:       setMrrOpen,
    onSetTheme:         handleSetTheme,
    onLoadMore:         () => { const n = page + 1; setPage(n); loadAll(n, true) },
  }

  return (
    <>
      {theme === 'A' && <ThemeA {...themeProps} />}
      {theme === 'B' && <ThemeB {...themeProps} />}
      {theme === 'C' && <ThemeC {...themeProps} />}

      {/* ── Shared modals (rendered above theme layer) ── */}
      {modal && <TenantModalInline modal={modal} setModal={setModal} setMF={setMF}
        saveBillingConfig={saveBillingConfig} extendTrial={extendTrial} manualActivate={manualActivate}
        superHeader={superHeader} loadAll={loadAll} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-base">حذف نهائي</h3>
                <p className="text-gray-400 text-xs mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-red-300 font-bold text-sm">{deleteConfirm.businessName || deleteConfirm.name}</p>
              <p className="text-red-500 text-xs mt-1">سيتم حذف كل الطلبات، المنيو، الطاولات، الموظفين، والسجلات.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold">
                إلغاء
              </button>
              <button onClick={() => deleteTenant(deleteConfirm.id)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
```

- [ ] Add the `TenantModalInline` function component at the bottom of `page.tsx` (this is the extracted modal from the old JSX — copy it verbatim from the old `{modal && ...}` block and wrap it as a component):

```tsx
function TenantModalInline({ modal, setModal, setMF, saveBillingConfig, extendTrial, manualActivate, superHeader, loadAll }: any) {
  // ... paste the existing modal JSX here from the old page.tsx
  // It's the block starting with:
  //   <div className="fixed inset-0 z-50 bg-black/80 ...">
  // and ending before the MRR breakdown modal
}
```

> **Note:** Copy the existing `{modal && (...)}` JSX block from the current `page.tsx` into `TenantModalInline`. Also copy `FSelect`, `FInput`, `RowBtn`, `BILLING_LABELS`, `BILLING_COLORS`, `TIER_COLORS`, `TIER_AR`, `trialDaysLeft`, `getCommission`, `estimateCycle`, `TIERS`, `EU`, `MAINTENANCE_COUNTRIES`, `defaultMaintenance` helpers — move them to a new file `app/superadmin/components/shared/helpers.ts` and import them where needed.

- [ ] Commit:
```bash
git add app/superadmin/page.tsx
git commit -m "feat(superadmin): refactor page.tsx to pure data parent with theme switching"
```

---

## Task 13 — Manual Verification

- [ ] Start both servers:
```bash
# Terminal 1 — Express backend
npm run dev

# Terminal 2 — Next.js frontend
npx next dev --port 3000
```

- [ ] Open `http://localhost:3000/superadmin` — verify login screen renders.

- [ ] Login with credentials from `.env` (`SUPERADMIN_EMAIL` / `SUPERADMIN_SECRET`).

- [ ] Verify **Theme A** loads by default, KPI cards show real numbers, revenue chart renders.

- [ ] Click **B** in the switcher — verify Glass Sidebar theme loads.

- [ ] Click **C** in the switcher — verify Minimal Pro theme loads.

- [ ] Refresh the page — verify the last selected theme is restored from `localStorage`.

- [ ] Click a tenant row — verify the billing modal opens.

- [ ] Suspend a tenant → verify activity log records the action (open ActivityLog panel at the bottom).

- [ ] Final commit:
```bash
git add -A
git commit -m "feat(superadmin): complete theme redesign + analytics UI (Plan 1)"
```

---

## What's NOT in this plan (covered by Plan 2 + Plan 3)

- Impersonation UI (backend already exists at `/api/superadmin/tenants/:id/impersonate`)
- Tenant Notes (new Prisma model + routes needed)
- Send Message (new route needed)
- Export CSV
- Lead Scraper + Pipeline
