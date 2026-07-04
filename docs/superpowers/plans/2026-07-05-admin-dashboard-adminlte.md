# Admin Dashboard AdminLTE Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the restaurant admin dashboard sidebar into 6 accordion-grouped sections (deduplicating desktop/mobile nav into one shared component), give the top 4 KPI tiles a gradient AdminLTE look, and replace the unused "map card" slot with a live weather widget for the cafe's city.

**Architecture:** `app/admin/layout.tsx`'s flat `NAV` array becomes a grouped `NAV_GROUPS` array; a new shared `AdminSidebarNav` component renders it (desktop `<aside>` and mobile drawer both call it, replacing their duplicated markup) with per-group expand/collapse state defaulting to whichever group contains the active route. `app/admin/dashboard/page.tsx`'s `KpiCard` gets a `variant="gradient"` option used only by the first 4 cards. A new Express route `GET /api/admin/weather` (mirrors `adminStats.ts`'s `authorizeAdmin` pattern) calls OpenWeatherMap server-side using the cafe's `city`, and a new dashboard-only `WeatherWidget` component fetches and renders it.

**Tech Stack:** TypeScript, Next.js 13 App Router (client components), Tailwind CSS, Express 5, Prisma 4 (MongoDB), lucide-react icons, native `fetch` (Node 20).

---

## What Already Exists (Handle Carefully)

| What | Location | Action |
|------|----------|--------|
| Flat `NAV` array (20 items) | `app/admin/layout.tsx:21-42` | Replace with grouped `NAV_GROUPS` |
| Duplicated desktop nav render | `app/admin/layout.tsx:556-622` | Replace with `<AdminSidebarNav variant="desktop" />` |
| Duplicated mobile nav render | `app/admin/layout.tsx:693-747` | Replace with `<AdminSidebarNav variant="mobile" />` |
| Marketplace/Inventory conditional links (rendered separately in both nav copies) | `app/admin/layout.tsx:578-621`, `714-746` | Fold into `NAV_GROUPS` (Marketplace → Growth & Marketing group, Inventory → Settings group), keep their feature-flag/lock-badge behavior |
| `STAFF_LINKS` block (Kitchen/Waiter/POS) | `app/admin/layout.tsx:44-48`, rendered `624-634` | Leave untouched, outside the accordion |
| `A[lang]` i18n dict — all nav labels (`dashboard`, `menuAI`, ... `settings`, `staffScreens`, `kitchenKds`, etc.) already exist | `lib/adminI18n.ts` | Reuse as-is, no new keys needed for nav labels |
| `KpiCard` helper (flat white cards) | `app/admin/dashboard/page.tsx:542-563` | Extend with a gradient variant, don't break the 4 non-gradient callers (row 2 + others) |
| Revenue `LineChart` (recharts) | `app/admin/dashboard/page.tsx:260-274` | Keep data/library, only wrap in updated card chrome alongside new weather widget |
| `Cafe` model has `city`, `lat`, `lng` | `prisma/schema.prisma:182-196` | Read-only lookup, no schema change needed |
| `authorizeAdmin` middleware sets `req.admin.cafeId` | `src/middleware/authorizeAdmin.ts` | Reuse for the new weather route |
| `adminStatsRouter` registration pattern | `src/server.ts:38,240` | Follow same import + `app.use(...)` pattern for the new weather router |

---

## Task 1 — Weather Backend Endpoint

**Files:**
- Create: `src/routes/adminWeather.ts`
- Modify: `src/server.ts` (register the router)
- Modify: `.env.example` (document the new key)

- [ ] **Step 1: Add `OPENWEATHER_API_KEY` to `.env.example`**

Open `.env.example`, find the `# ─── MISC / INTEGRATIONS ───...` section (currently has `GOOGLE_PLACES_API_KEY`, `POSBRIDGE_SECRET`, `INVENTORY_WEBHOOK_SECRET`), and add below `INVENTORY_WEBHOOK_SECRET=`:

```
# OpenWeatherMap API key (free tier) — powers the admin dashboard weather widget
OPENWEATHER_API_KEY=
```

- [ ] **Step 2: Create `src/routes/adminWeather.ts`**

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

type WeatherResponse = {
  available: boolean
  city?: string
  tempC?: number
  condition?: string
  icon?: string
}

router.get('/api/admin/weather', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const admin = req.admin!
    const cafe = await prisma.cafe.findUnique({
      where: { id: admin.cafeId },
      select: { city: true, lat: true, lng: true },
    })

    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey || !cafe || (!cafe.city && (cafe.lat == null || cafe.lng == null))) {
      return res.json({ available: false } as WeatherResponse)
    }

    const query = cafe.city
      ? `q=${encodeURIComponent(cafe.city)}`
      : `lat=${cafe.lat}&lon=${cafe.lng}`

    const url = `https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&appid=${apiKey}`
    const weatherRes = await fetch(url)
    if (!weatherRes.ok) {
      return res.json({ available: false } as WeatherResponse)
    }
    const data: any = await weatherRes.json()

    const response: WeatherResponse = {
      available: true,
      city: data.name ?? cafe.city ?? undefined,
      tempC: typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : undefined,
      condition: data.weather?.[0]?.main ?? undefined,
      icon: data.weather?.[0]?.icon ?? undefined,
    }
    res.json(response)
  } catch (err) {
    logger.error({ msg: 'admin weather fetch error', err })
    res.json({ available: false } as WeatherResponse)
  }
})

export default router
```

- [ ] **Step 3: Register the router in `src/server.ts`**

Find line 38 (`import adminStatsRouter from './routes/adminStats'`) and add directly below it:

```typescript
import adminWeatherRouter from './routes/adminWeather'
```

Find line 240 (`app.use(adminStatsRouter)`) and add directly below it:

```typescript
app.use(adminWeatherRouter)
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 5: Manual verification**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "adminWeatherRouter" src/server.ts
```
Expected: 2 lines (import + `app.use`).

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/routes/adminWeather.ts src/server.ts .env.example && git commit -m "feat(admin-dashboard): add /api/admin/weather endpoint backed by OpenWeatherMap"
```

---

## Task 2 — Weather Widget Component (Frontend)

**Files:**
- Create: `app/admin/dashboard/WeatherWidget.tsx`
- Modify: `app/admin/dashboard/page.tsx` (mount the widget, replacing the map-card slot)

- [ ] **Step 1: Create `app/admin/dashboard/WeatherWidget.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog } from 'lucide-react'

type WeatherData = {
  available: boolean
  city?: string
  tempC?: number
  condition?: string
  icon?: string
}

function conditionIcon(condition?: string) {
  switch (condition) {
    case 'Rain':
    case 'Drizzle':  return CloudRain
    case 'Snow':     return CloudSnow
    case 'Thunderstorm': return CloudLightning
    case 'Clear':    return Sun
    case 'Mist':
    case 'Fog':
    case 'Haze':     return CloudFog
    default:         return Cloud
  }
}

export default function WeatherWidget({ authHeader }: { authHeader: () => Record<string, string> }) {
  const [data, setData] = useState<WeatherData | null>(null)

  useEffect(() => {
    fetch('/api/admin/weather', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData({ available: false }))
  }, [])

  const Icon = conditionIcon(data?.condition)

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-2xl p-5 text-white h-full flex flex-col justify-between shadow-sm">
      <div>
        <p className="text-blue-200 text-xs font-bold uppercase tracking-wide mb-1">Weather</p>
        {data?.available ? (
          <>
            <p className="font-black text-lg leading-tight">{data.city}</p>
            <p className="text-blue-200 text-xs">{data.condition}</p>
          </>
        ) : (
          <p className="font-black text-lg leading-tight">—</p>
        )}
      </div>
      <div className="flex items-end justify-between mt-4">
        <Icon className="w-10 h-10 text-white/80" />
        <span className="text-4xl font-extrabold">
          {data?.available && typeof data.tempC === 'number' ? `${data.tempC}°` : '—'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount `WeatherWidget` in `app/admin/dashboard/page.tsx`, replacing the charts-row map slot**

Read the current charts row (`app/admin/dashboard/page.tsx:260-274`, the `lg:col-span-2` revenue chart card inside `grid grid-cols-1 lg:grid-cols-3 gap-4`). There is currently no map card — the third grid column is occupied by `<div className="space-y-4">` (CertificationTracker, marketplace widget, top products, peak hours). Add the `WeatherWidget` as its own card at the top of that `space-y-4` column, above `<CertificationTracker />`:

Find:
```typescript
        <div className="space-y-4">
          {/* Smart Resto Certified progress */}
          <CertificationTracker />
```

Replace with:
```typescript
        <div className="space-y-4">
          <WeatherWidget authHeader={authHeader} />

          {/* Smart Resto Certified progress */}
          <CertificationTracker />
```

- [ ] **Step 3: Import `WeatherWidget` at the top of `app/admin/dashboard/page.tsx`**

Find:
```typescript
import CertificationTracker from './CertificationTracker'
```
Add directly below it:
```typescript
import WeatherWidget from './WeatherWidget'
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "admin/dashboard"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/admin/dashboard/WeatherWidget.tsx app/admin/dashboard/page.tsx && git commit -m "feat(admin-dashboard): add WeatherWidget card fetching /api/admin/weather"
```

---

## Task 3 — Gradient KPI Tiles

**Files:**
- Modify: `app/admin/dashboard/page.tsx` (`KpiCard` function + its 4 headline callers)

- [ ] **Step 1: Extend `KpiCard` with a `variant` prop, default `'flat'`**

Find the existing `KpiCard` function (`app/admin/dashboard/page.tsx:542-563`):

```typescript
function KpiCard({ icon: Icon, color, label, value, sub, pulse }: {
  icon: any; color: string; label: string; value: string; sub: string; pulse?: boolean
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50   text-blue-600',
    sky:     'bg-sky-50    text-sky-600',
    violet:  'bg-violet-50 text-violet-600',
    orange:  'bg-orange-50 text-orange-600',
    red:     'bg-red-50    text-red-600',
  }
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-shadow hover:shadow-md ${pulse ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-xl font-extrabold text-gray-900 leading-tight">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  )
}
```

Replace with:

```typescript
function KpiCard({ icon: Icon, color, label, value, sub, pulse, variant = 'flat' }: {
  icon: any; color: string; label: string; value: string; sub: string; pulse?: boolean; variant?: 'flat' | 'gradient'
}) {
  const flatColors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50   text-blue-600',
    sky:     'bg-sky-50    text-sky-600',
    violet:  'bg-violet-50 text-violet-600',
    orange:  'bg-orange-50 text-orange-600',
    red:     'bg-red-50    text-red-600',
  }
  const gradients: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-700',
    blue:    'from-blue-500 to-blue-700',
    sky:     'from-sky-500 to-sky-700',
    violet:  'from-violet-500 to-violet-700',
    orange:  'from-amber-500 to-orange-600',
    red:     'from-rose-500 to-red-700',
  }

  if (variant === 'gradient') {
    return (
      <div className={`bg-gradient-to-br ${gradients[color]} rounded-2xl p-4 text-white shadow-sm transition-shadow hover:shadow-md`}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white/15">
          <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
        </div>
        <div className="text-xs text-white/70 mb-0.5">{label}</div>
        <div className="text-xl font-extrabold leading-tight">{value}</div>
        <div className="text-xs text-white/70 mt-1">{sub}</div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-shadow hover:shadow-md ${pulse ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${flatColors[color]}`}>
        <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-xl font-extrabold text-gray-900 leading-tight">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  )
}
```

- [ ] **Step 2: Apply `variant="gradient"` to the first 4 `KpiCard` calls only**

Find the first KPI row (`app/admin/dashboard/page.tsx:205-227`):

```typescript
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp} color="emerald"
          label={t.revenue} value={`${Number(stats.revenue.today).toFixed(0)} ${currency}`}
          sub={`${t.week}: ${Number(stats.revenue.week).toFixed(0)}`}
        />
        <KpiCard
          icon={ShoppingBag} color="blue"
          label={t.todayOrders} value={String(stats.ordersCountToday)}
          sub={`avg: ${Number(stats.aov).toFixed(0)} ${currency}`}
        />
        <KpiCard
          icon={Activity} color="orange"
          label={t.orders} value={String(stats.activeOrders ?? 0)}
          sub={t.preparing}
          pulse={stats.activeOrders > 0}
        />
        <KpiCard
          icon={ChefHat} color="violet"
          label={t.activeStaff} value={String(stats.activeStaff ?? 0)}
          sub={t.active}
        />
      </div>
```

Replace with (only difference: `variant="gradient"` added to each of these 4):

```typescript
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          variant="gradient"
          icon={TrendingUp} color="emerald"
          label={t.revenue} value={`${Number(stats.revenue.today).toFixed(0)} ${currency}`}
          sub={`${t.week}: ${Number(stats.revenue.week).toFixed(0)}`}
        />
        <KpiCard
          variant="gradient"
          icon={ShoppingBag} color="blue"
          label={t.todayOrders} value={String(stats.ordersCountToday)}
          sub={`avg: ${Number(stats.aov).toFixed(0)} ${currency}`}
        />
        <KpiCard
          variant="gradient"
          icon={Activity} color="orange"
          label={t.orders} value={String(stats.activeOrders ?? 0)}
          sub={t.preparing}
          pulse={stats.activeOrders > 0}
        />
        <KpiCard
          variant="gradient"
          icon={ChefHat} color="violet"
          label={t.activeStaff} value={String(stats.activeStaff ?? 0)}
          sub={t.active}
        />
      </div>
```

The second KPI row (`app/admin/dashboard/page.tsx:230-240`, `sky`/`emerald`/`red` wallet card) is **not** touched — those stay `variant="flat"` (the default).

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "admin/dashboard"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/admin/dashboard/page.tsx && git commit -m "feat(admin-dashboard): gradient variant for the 4 headline KPI tiles"
```

---

## Task 4 — Sidebar: Grouped NAV Data + Shared AdminSidebarNav Component

**Files:**
- Create: `app/admin/AdminSidebarNav.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Read the full current `app/admin/layout.tsx` sidebar sections once more to confirm line numbers before editing**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "^const NAV\|^const STAFF_LINKS\|<aside className=\"hidden md:flex\|Mobile drawer\|<nav className=\"flex-1" app/admin/layout.tsx
```

Use the reported line numbers for the edits below (they should match the previously-read ranges: `NAV` at line 21, desktop `<aside>` nav at ~556, mobile drawer nav at ~693).

- [ ] **Step 2: Create `app/admin/AdminSidebarNav.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2, CreditCard, ChevronDown,
  Users, BarChart3, Building2, Sparkles, Settings, TrendingUp, Film,
  Package, Lock, LayoutGrid, Wrench, Receipt, ShoppingCart, CalendarDays, Radio, ShieldCheck,
  Store, ChevronRight, CalendarClock, Gift,
} from 'lucide-react'
import type { AdminT } from '@/lib/adminI18n'

export type NavItem = { href: string; icon: any; key: keyof AdminT }

export type NavGroup = {
  group: 'overview' | 'menuOrdering' | 'team' | 'finance' | 'growth' | 'settingsGroup'
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { group: 'overview', items: [
    { href: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  ]},
  { group: 'menuOrdering', items: [
    { href: '/admin/menu-gen',     icon: Sparkles,        key: 'menuAI'        },
    { href: '/admin/menu',         icon: UtensilsCrossed, key: 'menu'          },
    { href: '/admin/tables',       icon: QrCode,          key: 'tables'        },
    { href: '/admin/zones',        icon: LayoutGrid,      key: 'zones'         },
    { href: '/admin/reservations', icon: CalendarDays,    key: 'reservations'  },
  ]},
  { group: 'team', items: [
    { href: '/admin/staff',      icon: Users,         key: 'staff'      },
    { href: '/admin/control',    icon: Radio,         key: 'control'    },
    { href: '/admin/attendance', icon: CalendarClock, key: 'attendance' },
  ]},
  { group: 'finance', items: [
    { href: '/admin/financials',    icon: BarChart3,    key: 'financials'   },
    { href: '/admin/margins',       icon: TrendingUp,   key: 'margins'      },
    { href: '/admin/equipment',     icon: Wrench,       key: 'equipment'    },
    { href: '/admin/invoices',      icon: Receipt,      key: 'invoices'     },
    { href: '/admin/requisitions',  icon: ShoppingCart, key: 'requisitions' },
    { href: '/admin/billing',       icon: CreditCard,   key: 'billing'      },
  ]},
  { group: 'growth', items: [
    { href: '/admin/loyalty',       icon: Gift,        key: 'loyalty'       },
    { href: '/admin/certification', icon: ShieldCheck, key: 'certification' },
    { href: '/admin/marketing',     icon: Film,        key: 'marketing'     },
    { href: '/admin/social',        icon: Share2,      key: 'social'        },
  ]},
  { group: 'settingsGroup', items: [
    { href: '/admin/settings', icon: Settings, key: 'settings' },
  ]},
]

const GROUP_LABEL: Record<NavGroup['group'], Record<string, string>> = {
  overview:      { ar: 'نظرة عامة',        en: 'Overview',            fr: 'Aperçu',              es: 'Resumen'       },
  menuOrdering:  { ar: 'المنيو والطلبات',  en: 'Menu & Ordering',     fr: 'Menu & Commandes',    es: 'Menú y Pedidos' },
  team:          { ar: 'الفريق',           en: 'Team',                fr: 'Équipe',              es: 'Equipo'        },
  finance:       { ar: 'المالية',          en: 'Finance',             fr: 'Finance',             es: 'Finanzas'      },
  growth:        { ar: 'النمو والتسويق',   en: 'Growth & Marketing',  fr: 'Croissance & Marketing', es: 'Crecimiento y Marketing' },
  settingsGroup: { ar: 'الإعدادات',        en: 'Settings',            fr: 'Paramètres',          es: 'Ajustes'       },
}

function groupOf(pathname: string): NavGroup['group'] {
  for (const g of NAV_GROUPS) {
    if (g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) return g.group
  }
  if (pathname.startsWith('/admin/marketplace')) return 'growth'
  if (pathname.startsWith('/admin/inventory'))   return 'settingsGroup'
  return 'overview'
}

export default function AdminSidebarNav({
  pathname, lang, isRTL, t, marketplaceEnabled, cafeInventoryEnabled, onNavigate,
  itemClassName = 'px-3 py-2.5 rounded-lg text-sm',
}: {
  pathname: string
  lang: string
  isRTL: boolean
  t: AdminT
  marketplaceEnabled: boolean
  cafeInventoryEnabled: boolean | null
  onNavigate?: () => void
  itemClassName?: string
}) {
  const [expanded, setExpanded] = useState<NavGroup['group']>(() => groupOf(pathname))

  useEffect(() => { setExpanded(groupOf(pathname)) }, [pathname])

  function linkClass(active: boolean) {
    return `flex items-center gap-3 ${itemClassName} transition-colors group ${
      active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
    }`
  }

  return (
    <>
      {NAV_GROUPS.map(g => {
        const isOpen = expanded === g.group
        const label = GROUP_LABEL[g.group][lang] ?? GROUP_LABEL[g.group].en
        const isSingleItem = g.group === 'overview' || g.group === 'settingsGroup'

        return (
          <div key={g.group} className="mb-1">
            {!isSingleItem && (
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? (undefined as any) : g.group)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300"
              >
                <span>{label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-0' : (isRTL ? 'rotate-90' : '-rotate-90')}`} />
              </button>
            )}
            {(isSingleItem || isOpen) && g.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(active)}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="font-medium flex-1">{t[item.key]}</span>
                  {item.href === '/admin/marketing' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                      <Sparkles className="w-2.5 h-2.5" />
                      PRO
                    </span>
                  )}
                  {active && <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />}
                </Link>
              )
            })}
            {g.group === 'growth' && (isSingleItem || isOpen) && marketplaceEnabled && (
              <Link href="/admin/marketplace" onClick={onNavigate}
                className={linkClass(pathname.startsWith('/admin/marketplace'))}>
                <Store className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1">{lang === 'ar' ? 'المتجر' : 'Marketplace'}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AI</span>
              </Link>
            )}
            {g.group === 'settingsGroup' && cafeInventoryEnabled !== null && (
              <Link href="/admin/inventory" onClick={onNavigate}
                className={linkClass(pathname.startsWith('/admin/inventory')) + ' relative'}>
                <Package className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1">
                  {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
                </span>
                {!cafeInventoryEnabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Lock className="w-2.5 h-2.5" />
                    PRO
                  </span>
                )}
              </Link>
            )}
          </div>
        )
      })}
    </>
  )
}
```

Note: `Building2` and `TrendingUp` are imported but only `TrendingUp` is used (for the `margins` icon) — remove the unused `Building2` import to avoid a lint/TS warning; it is not referenced anywhere in this file.

- [ ] **Step 3: Remove the unused `Building2` import**

In the file just created, in the `lucide-react` import block, delete `Building2,` from the import list (it is not used in `AdminSidebarNav.tsx`).

- [ ] **Step 4: TypeScript check on the new file**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "AdminSidebarNav"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/admin/AdminSidebarNav.tsx && git commit -m "feat(admin-layout): add shared AdminSidebarNav component with 6 accordion groups"
```

---

## Task 5 — Wire `AdminSidebarNav` into `app/admin/layout.tsx`

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Remove the old flat `NAV` array**

Delete lines 21-42 (the `const NAV = [...] as const` block). Keep `STAFF_LINKS` (lines 44-48) unchanged.

- [ ] **Step 2: Import `AdminSidebarNav`**

Find the import block near the top of `app/admin/layout.tsx`:
```typescript
import { AdminLangProvider, useLang, type AdminLang } from './lang-context'
import { A, type AdminT } from '@/lib/adminI18n'
```
Add directly below:
```typescript
import AdminSidebarNav from './AdminSidebarNav'
```

- [ ] **Step 3: Replace the desktop nav block**

Find (in the desktop `<aside>`, currently ~lines 556-622):

```typescript
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active      = pathname === item.href
            const isMarketing = item.href === '/admin/marketing'
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                  active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                }`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium flex-1">{t[item.key as keyof AdminT]}</span>
                {isMarketing && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    PRO
                  </span>
                )}
                {active && <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />}
              </Link>
            )
          })}

          {/* ── Marketplace (feature flag gated) ────────────────────── */}
          {marketplaceEnabled && (
            <Link href="/admin/marketplace"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                pathname.startsWith('/admin/marketplace')
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-[#243460] hover:text-white'
              }`}>
              <Store className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium flex-1">
                {lang === 'ar' ? 'المتجر' : 'Marketplace'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                AI
              </span>
              {pathname.startsWith('/admin/marketplace') && (
                <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />
              )}
            </Link>
          )}

          {/* ── Smart Inventory (premium gated item) ────────────────── */}
          {cafe && (
            <Link href="/admin/inventory"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative ${
                pathname.startsWith('/admin/inventory')
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-[#243460] hover:text-white'
              }`}>
              <Package className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium flex-1">
                {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
              </span>
              {!cafe.isSmartInventoryEnabled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="w-2.5 h-2.5" />
                  PRO
                </span>
              )}
              {pathname.startsWith('/admin/inventory') && (
                <ChevronRight className={`w-4 h-4 opacity-70 ${!isRTL ? 'rotate-180' : ''}`} />
              )}
            </Link>
          )}
        </nav>
```

Replace with:

```typescript
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <AdminSidebarNav
            pathname={pathname}
            lang={lang}
            isRTL={isRTL}
            t={t}
            marketplaceEnabled={marketplaceEnabled}
            cafeInventoryEnabled={cafe ? cafe.isSmartInventoryEnabled : null}
          />
        </nav>
```

- [ ] **Step 4: Replace the mobile drawer nav block**

Find (in the mobile drawer, currently ~lines 693-747):

```typescript
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV.map((item) => {
                const active      = pathname === item.href
                const isMarketing = item.href === '/admin/marketing'
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                      active ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                    }`}>
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium flex-1">{t[item.key as keyof AdminT]}</span>
                    {isMarketing && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        PRO
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* Marketplace (feature flag gated) */}
              {marketplaceEnabled && (
                <Link href="/admin/marketplace" onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                    pathname.startsWith('/admin/marketplace')
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                  }`}>
                  <Store className="w-5 h-5" />
                  <span className="font-medium flex-1">
                    {lang === 'ar' ? 'المتجر' : 'Marketplace'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">AI</span>
                </Link>
              )}

              {/* Smart Inventory (gated) */}
              {cafe && (
                <Link href="/admin/inventory" onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                    pathname.startsWith('/admin/inventory')
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:bg-[#243460] hover:text-white'
                  }`}>
                  <Package className="w-5 h-5" />
                  <span className="font-medium flex-1">
                    {lang === 'ar' ? 'المخزون' : lang === 'fr' ? 'Inventaire' : 'Inventory'}
                  </span>
                  {!cafe.isSmartInventoryEnabled && (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </Link>
              )}
            </nav>
```

Replace with:

```typescript
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <AdminSidebarNav
                pathname={pathname}
                lang={lang}
                isRTL={isRTL}
                t={t}
                marketplaceEnabled={marketplaceEnabled}
                cafeInventoryEnabled={cafe ? cafe.isSmartInventoryEnabled : null}
                onNavigate={() => setOpen(false)}
                itemClassName="px-3 py-3 rounded-xl text-base"
              />
            </nav>
```

- [ ] **Step 5: Remove now-unused imports from `app/admin/layout.tsx`**

The following icons were only used by the deleted inline nav blocks and are no longer referenced in `app/admin/layout.tsx` itself (they're used inside `AdminSidebarNav.tsx` now, imported separately there): `LayoutDashboard, UtensilsCrossed, QrCode, ChevronRight, Users, BarChart3, Building2, CalendarClock, Sparkles as menuSparkles-if-unused, TrendingUp, Package, Lock, LayoutGrid, Wrench, Receipt, ShoppingCart, CalendarDays, Radio, ShieldCheck, Store, Gift, Share2, CreditCard, Settings, Film`.

Run this check first to see exactly what's still used elsewhere in the file (e.g. `Settings` might still be needed if referenced outside nav, `CreditCard` too):

```bash
cd "/Users/mac/Documents/SaaS restau" && for icon in LayoutDashboard UtensilsCrossed QrCode ChevronRight Users BarChart3 Building2 CalendarClock TrendingUp Package Lock LayoutGrid Wrench Receipt ShoppingCart CalendarDays Radio ShieldCheck Store Gift Share2 CreditCard Settings Film Sparkles; do
  count=$(grep -c "\b$icon\b" app/admin/layout.tsx)
  echo "$icon: $count"
done
```

For every icon reported with count `1` (meaning it only appears in the `import { ... } from 'lucide-react'` line itself, now unused elsewhere in the file), remove it from the `lucide-react` import block at the top of `app/admin/layout.tsx`. Keep any icon whose count is `2+` (still referenced elsewhere, e.g. `Building2` is used inside `PaymentGate`'s method-tabs section — check before removing).

- [ ] **Step 6: TypeScript check (full)**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output. If there are "declared but never used" or "cannot find name" errors referencing `app/admin/layout.tsx`, reconcile the import list from Step 5 (add back anything still needed, remove anything genuinely dead).

- [ ] **Step 7: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/admin/layout.tsx && git commit -m "refactor(admin-layout): replace duplicated desktop/mobile nav with shared AdminSidebarNav"
```

---

## Task 6 — Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run dev
```

- [ ] **Step 2: Log into an admin account and open `/admin/dashboard`**

Confirm:
- The first 4 KPI tiles (Revenue, Today's Orders, Active Orders, Active Staff) show as colored gradient cards.
- A new Weather card appears in the third dashboard column, above the certification tracker. If `OPENWEATHER_API_KEY` is not set locally, it should show `—` placeholders without crashing the page.
- The sidebar shows 6 groups; the group containing `/admin/dashboard` ("Overview" — a single, non-collapsible item) is visible, and clicking group headers (e.g. "Finance") expands/collapses their items.
- Navigating to `/admin/menu` auto-expands the "Menu & Ordering" group.
- Marketplace (if enabled) appears inside "Growth & Marketing"; Inventory appears inside "Settings" with its PRO/lock badge behavior intact.
- Resize to mobile width, open the hamburger drawer, and confirm the same grouped nav renders there with working expand/collapse and that tapping a link closes the drawer.

- [ ] **Step 3: Set a real `OPENWEATHER_API_KEY` locally (optional) and re-check the Weather card shows a real temperature/condition for a cafe with a `city` set.**

- [ ] **Step 4: Final full TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 5: Push**

```bash
cd "/Users/mac/Documents/SaaS restau" && git push
```
