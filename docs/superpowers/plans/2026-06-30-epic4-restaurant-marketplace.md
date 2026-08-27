# Epic 4 — Restaurant Marketplace Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Restaurant Marketplace experience inside SmartSuite OS so restaurant owners can browse products, place purchase requests, and track orders — all from the admin panel.

**Architecture:** All backend routes (`/api/restaurant/marketplace/*`) and all frontend pages (`app/admin/marketplace/`) are already implemented. The sidebar feature-flag gate and sub-navigation layout are already wired. This plan fixes three bugs that make the catalog return zero results, adds the missing dashboard widget, and adds the missing i18n keys.

**Tech Stack:** Next.js 13 App Router, Express 5, Prisma 4 (MongoDB), Tailwind CSS, lucide-react, `useLang()` hook from `app/admin/lang-context.tsx`, `A[lang]` translations from `lib/adminI18n.ts`.

---

## What Already Exists (DO NOT REBUILD)

The following are fully implemented and must not be touched:

| File | Status |
|------|--------|
| `src/routes/marketplaceCatalogRestaurant.ts` | ✅ Exists — has bugs (fixed in Tasks 1–3) |
| `src/routes/marketplaceOrdersRestaurant.ts` | ✅ Complete |
| `src/marketplace/ai/RecommendationService.ts` | ✅ Complete |
| `src/marketplace/ai/BundleEngine.ts` | ✅ Complete |
| `src/marketplace/ai/SmartAlerts.ts` | ✅ Complete |
| `src/marketplace/ai/CompatibilityEngine.ts` | ✅ Complete |
| `app/admin/marketplace/layout.tsx` | ✅ Complete |
| `app/admin/marketplace/page.tsx` | ✅ Complete (Home/Dashboard) |
| `app/admin/marketplace/catalog/page.tsx` | ✅ Complete |
| `app/admin/marketplace/products/[id]/page.tsx` | ✅ Exists — has bug (fixed in Task 2) |
| `app/admin/marketplace/orders/page.tsx` | ✅ Complete |
| `app/admin/marketplace/orders/[id]/page.tsx` | ✅ Complete |
| `app/admin/marketplace/orders/new/page.tsx` | ✅ Exists — has bug (fixed in Task 3) |
| `app/admin/marketplace/bundles/page.tsx` | ✅ Complete |
| `app/admin/marketplace/bundles/[id]/page.tsx` | ✅ Complete |
| `app/admin/marketplace/notifications/page.tsx` | ✅ Complete |
| `app/admin/layout.tsx` | ✅ Marketplace nav item with feature-flag gate already added |
| `docs/ui/restaurant-marketplace.md` | ✅ Complete |
| Prisma models: `MarketplaceBundle`, `RecommendationLog` | ✅ In schema |

---

## Files Modified in This Plan

| File | What Changes |
|------|-------------|
| `src/routes/marketplaceCatalogRestaurant.ts` | Fix `'PUBLISHED'` → `'ACTIVE'` (5 occurrences) |
| `app/admin/marketplace/products/[id]/page.tsx` | Remove dead `/compatibility/:id` fetch; use `pData.compatibility` |
| `app/admin/marketplace/orders/new/page.tsx` | Fix `?q=` → `?search=` in catalog search URL |
| `app/admin/dashboard/page.tsx` | Add `<MarketplaceWidget>` component inline |
| `lib/adminI18n.ts` | Add `marketplace` nav key in all 4 languages |

---

## Task 1 — Fix Product Status Bug in Catalog Route

**Problem:** `src/routes/marketplaceCatalogRestaurant.ts` filters with `status: 'PUBLISHED'` but `publishProduct()` in `ProductService.ts` sets status to `'ACTIVE'`. Result: every catalog endpoint returns 0 products.

**Files:**
- Modify: `src/routes/marketplaceCatalogRestaurant.ts` (lines 52, 89, 107, 129, 163)

- [ ] **Step 1: Open `src/routes/marketplaceCatalogRestaurant.ts` and replace all 5 occurrences of `'PUBLISHED'` with `'ACTIVE'`**

  Line 52 — inside `GET /api/restaurant/marketplace/catalog`:
  ```typescript
  // Before
  status: 'PUBLISHED',
  // After
  status: 'ACTIVE',
  ```

  Line 89 — inside `GET /api/restaurant/marketplace/featured`:
  ```typescript
  // Before
  where: { status: 'PUBLISHED', tags: { has: 'featured' } },
  // After
  where: { status: 'ACTIVE', tags: { has: 'featured' } },
  ```

  Line 107 — inside `GET /api/restaurant/marketplace/recent`:
  ```typescript
  // Before
  where: { status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'MODULE_ONLY'] } },
  // After
  where: { status: 'ACTIVE', visibility: { in: ['PUBLIC', 'MODULE_ONLY'] } },
  ```

  Line 129 — inside `GET /api/restaurant/marketplace/bundles` (enriching product snapshots):
  ```typescript
  // Before
  where: { id: { in: productIds }, status: 'PUBLISHED' },
  // After
  where: { id: { in: productIds }, status: 'ACTIVE' },
  ```

  Line 163 — inside `GET /api/restaurant/marketplace/catalog/:id` (related products):
  ```typescript
  // Before
  where: { categoryId: product.categoryId, id: { not: id }, status: 'PUBLISHED' },
  // After
  where: { categoryId: product.categoryId, id: { not: id }, status: 'ACTIVE' },
  ```

- [ ] **Step 2: Verify no remaining `PUBLISHED` references in this file**

  ```bash
  grep -n "PUBLISHED" src/routes/marketplaceCatalogRestaurant.ts
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/marketplaceCatalogRestaurant.ts
  git commit -m "fix(marketplace): catalog returns ACTIVE products — was filtering by non-existent PUBLISHED status"
  ```

---

## Task 2 — Fix Dead Compatibility Fetch in Product Detail Page

**Problem:** `app/admin/marketplace/products/[id]/page.tsx` calls two endpoints:
1. `GET /api/restaurant/marketplace/catalog/:id` — exists, returns `{ product, related, compatibility }`
2. `GET /api/restaurant/marketplace/compatibility/:id` — **does not exist** (404 every time)

The compatibility data is already inside the first response as `pData.compatibility`. The second call is redundant and broken.

**Files:**
- Modify: `app/admin/marketplace/products/[id]/page.tsx` (around lines 100–120)

- [ ] **Step 1: Find and fix the `Promise.all` fetch block**

  Locate this block (around line 100):
  ```typescript
  Promise.all([
    fetch(`/api/restaurant/marketplace/catalog/${id}`, { headers: h }),
    fetch(`/api/restaurant/marketplace/compatibility/${id}`, { headers: h }),
    fetch('/api/restaurant/marketplace/bundles', { headers: h }),
  ]).then(async ([pRes, cRes, bRes]) => {
    const pData = await pRes.json()
    const cData = await cRes.json()
    const bData = await bRes.json()
    setProduct(pData.product ?? null)
    setRelated(pData.related ?? [])
    setCompat(cData.compatibility ?? null)
    const all: Bundle[] = bData.bundles ?? []
    setBundles(all.filter(b => b.productIds.includes(id)).slice(0, 3))
  }).catch(() => {}).finally(() => setLoading(false))
  ```

  Replace with:
  ```typescript
  Promise.all([
    fetch(`/api/restaurant/marketplace/catalog/${id}`, { headers: h }),
    fetch('/api/restaurant/marketplace/bundles', { headers: h }),
  ]).then(async ([pRes, bRes]) => {
    const pData = await pRes.json()
    const bData = await bRes.json()
    setProduct(pData.product ?? null)
    setRelated(pData.related ?? [])
    setCompat(pData.compatibility ?? null)
    const all: Bundle[] = bData.bundles ?? []
    setBundles(all.filter(b => b.productIds.includes(id)).slice(0, 3))
  }).catch(() => {}).finally(() => setLoading(false))
  ```

- [ ] **Step 2: Verify TypeScript compiles without errors in this file**

  ```bash
  npx tsc --noEmit 2>&1 | grep "products/\[id\]"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add "app/admin/marketplace/products/[id]/page.tsx"
  git commit -m "fix(marketplace): product detail — remove dead compatibility fetch, use pData.compatibility"
  ```

---

## Task 3 — Fix Search Query Param Mismatch in New Order Page

**Problem:** `app/admin/marketplace/orders/new/page.tsx` sends `?q=` but the backend `GET /api/restaurant/marketplace/catalog` reads `req.query.search`. Product search in the order builder returns nothing.

**Files:**
- Modify: `app/admin/marketplace/orders/new/page.tsx` (line 122)

- [ ] **Step 1: Find and fix the search fetch call**

  Locate (around line 122):
  ```typescript
  const res  = await fetch(`/api/restaurant/marketplace/catalog?q=${encodeURIComponent(query)}&limit=8`, { headers: authHeader() })
  ```

  Replace with:
  ```typescript
  const res  = await fetch(`/api/restaurant/marketplace/catalog?search=${encodeURIComponent(query)}&limit=8`, { headers: authHeader() })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add "app/admin/marketplace/orders/new/page.tsx"
  git commit -m "fix(marketplace): new order search — use correct 'search' param, was sending 'q'"
  ```

---

## Task 4 — Add Marketplace Nav Key to adminI18n

**Problem:** `lib/adminI18n.ts` has no `marketplace` nav key. The admin layout hardcodes the label, but consistency with other nav items and future-proofing requires the key.

**Files:**
- Modify: `lib/adminI18n.ts`

- [ ] **Step 1: Add `marketplace` key in all 4 language blocks**

  In the `ar` block (after line 49 `social: 'التسويق الذكي',`):
  ```typescript
  social:        'التسويق الذكي',
  marketplace:   'المتجر',
  billing:       'الفواتير',
  ```

  In the `en` block (after `social: 'Smart Marketing',` around line 221):
  ```typescript
  social:        'Smart Marketing',
  marketplace:   'Marketplace',
  billing:       'Billing',
  ```

  In the `fr` block (after `social: 'Marketing intelligent',` around line 381):
  ```typescript
  social:        'Marketing intelligent',
  marketplace:   'Marketplace',
  billing:       'Facturation',
  ```

  In the `es` block (after `social: 'Marketing inteligente',` around line 541):
  ```typescript
  social:        'Marketing inteligente',
  marketplace:   'Marketplace',
  billing:       'Facturación',
  ```

- [ ] **Step 2: Verify the `AdminT` type picks up the new key**

  ```bash
  npx tsc --noEmit 2>&1 | grep "adminI18n\|marketplace"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add lib/adminI18n.ts
  git commit -m "feat(i18n): add marketplace nav key to adminI18n for all 4 languages"
  ```

---

## Task 5 — Add Marketplace Dashboard Widget

**Problem:** The admin dashboard (`app/admin/dashboard/page.tsx`) has no marketplace summary widget. The backend endpoint `GET /api/restaurant/marketplace/widget` already exists and returns `{ pendingOrders, approvedOrders, totalSpent, recentPurchases, recommendations }`.

The widget should only render when the marketplace feature flag is enabled (check via the same `/api/restaurant/marketplace/flag` call).

**Files:**
- Modify: `app/admin/dashboard/page.tsx`

- [ ] **Step 1: Add `MarketplaceWidget` state and fetch to `DashboardPage`**

  After the existing state declarations (e.g. after `const [staffCount, setStaffCount] = useState<number | null>(null)`), add:

  ```typescript
  const [mpEnabled, setMpEnabled]   = useState(false)
  const [mpWidget,  setMpWidget]    = useState<{
    pendingOrders: number
    approvedOrders: number
    totalSpent: number
    recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  } | null>(null)
  ```

- [ ] **Step 2: Add the widget fetch inside the existing `useEffect`**

  Inside the `useEffect` that runs on mount (the one calling `loadStats()`), add after the existing `fetch` calls:

  ```typescript
  const token2 = localStorage.getItem('token')
  if (token2) {
    const h2 = { Authorization: `Bearer ${token2}` }
    fetch('/api/restaurant/marketplace/flag', { headers: h2 })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.enabled) {
          setMpEnabled(true)
          fetch('/api/restaurant/marketplace/widget', { headers: h2 })
            .then(r => r.ok ? r.json() : null)
            .then(w => w && setMpWidget(w))
            .catch(() => undefined)
        }
      })
      .catch(() => undefined)
  }
  ```

- [ ] **Step 3: Add the `MarketplaceWidget` component at the bottom of the file (before the final `}`)**

  Add this component function before the closing of the file:

  ```typescript
  function MarketplaceWidget({ data, isRTL, lang }: {
    data: { pendingOrders: number; approvedOrders: number; totalSpent: number; recentPurchases: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }> }
    isRTL: boolean
    lang: string
  }) {
    const t = lang === 'ar'
      ? { title: 'المتجر الذكي', pending: 'بانتظار الموافقة', approved: 'معتمدة', spent: 'إجمالي المشتريات', recent: 'آخر الطلبات', viewAll: 'عرض الكل', quickOrder: 'طلب سريع', currency: 'د.م.' }
      : { title: 'Marketplace', pending: 'Pending', approved: 'Approved', spent: 'Total Spent', recent: 'Recent Orders', viewAll: 'View All', quickOrder: 'Quick Order', currency: 'MAD' }

    const STATUS_STYLE: Record<string, string> = {
      DRAFT: 'text-gray-400', SUBMITTED: 'text-amber-500',
      UNDER_REVIEW: 'text-blue-500', APPROVED: 'text-emerald-500',
      REJECTED: 'text-red-500', FULFILLED: 'text-emerald-400',
    }
    const STATUS_LABEL: Record<string, Record<string, string>> = {
      ar: { DRAFT:'مسودة', SUBMITTED:'مُرسل', UNDER_REVIEW:'مراجعة', APPROVED:'معتمد', REJECTED:'مرفوض', FULFILLED:'مُنجز', CANCELLED:'ملغى' },
      en: { DRAFT:'Draft', SUBMITTED:'Submitted', UNDER_REVIEW:'Under Review', APPROVED:'Approved', REJECTED:'Rejected', FULFILLED:'Fulfilled', CANCELLED:'Cancelled' },
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Store className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{t.title}</span>
          </div>
          <Link href="/admin/marketplace/orders/new"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <ShoppingCart className="w-3 h-3" />
            {t.quickOrder}
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-xl font-extrabold text-amber-600">{data.pendingOrders}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t.pending}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold text-emerald-600">{data.approvedOrders}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t.approved}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold text-gray-800">
              {data.totalSpent >= 1000
                ? `${(data.totalSpent / 1000).toFixed(1)}k`
                : data.totalSpent.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t.currency}</div>
          </div>
        </div>

        {/* Recent purchases */}
        {data.recentPurchases.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.recent}</div>
            <div className="space-y-1.5">
              {data.recentPurchases.slice(0, 3).map(o => (
                <Link key={o.id} href={`/admin/marketplace/orders/${o.id}`}
                  className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1 transition-colors">
                  <span className="text-xs font-mono text-gray-600">{o.orderNumber}</span>
                  <span className={`text-[10px] font-medium ${STATUS_STYLE[o.status] ?? 'text-gray-400'}`}>
                    {STATUS_LABEL[lang]?.[o.status] ?? o.status}
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/admin/marketplace/orders"
              className="mt-2 text-[10px] text-emerald-600 hover:underline block text-center">{t.viewAll}</Link>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 4: Add the `Store` and `ShoppingCart` imports from lucide-react**

  Locate the existing `import { ... } from 'lucide-react'` line and add `Store, ShoppingCart` if not already present:

  ```typescript
  import {
    TrendingUp, ShoppingBag, Users, Clock,
    Bell, CheckCheck, Wallet, AlertTriangle, Loader2,
    ChefHat, Heart, Activity, UserPlus, Store, ShoppingCart
  } from 'lucide-react'
  ```

  Also add the missing `Link` import if not present:
  ```typescript
  import Link from 'next/link'
  ```

- [ ] **Step 5: Render the widget in the dashboard JSX**

  Find the section that renders the `CertificationTracker` component and add the marketplace widget nearby. Look for `<CertificationTracker` and add **after** it:

  ```typescript
  {mpEnabled && mpWidget && (
    <MarketplaceWidget data={mpWidget} isRTL={isRTL} lang={lang} />
  )}
  ```

  The exact placement should be at the same level as `CertificationTracker` — both are sidebar/supplementary widgets.

- [ ] **Step 6: Verify TypeScript compiles clean**

  ```bash
  npx tsc --noEmit 2>&1 | grep "dashboard"
  ```
  Expected: no output.

- [ ] **Step 7: Commit**

  ```bash
  git add app/admin/dashboard/page.tsx
  git commit -m "feat(marketplace): add marketplace summary widget to admin dashboard"
  ```

---

## Task 6 — Final verification and push

- [ ] **Step 1: Full TypeScript check (excluding known pre-existing integration error)**

  ```bash
  npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
  ```
  Expected: no output.

- [ ] **Step 2: Verify the catalog route has zero PUBLISHED references**

  ```bash
  grep -n "PUBLISHED" src/routes/marketplaceCatalogRestaurant.ts
  ```
  Expected: no output.

- [ ] **Step 3: Verify all 3 query-param bugs are fixed**

  ```bash
  grep -n "status.*PUBLISHED\|/compatibility/\|?q=" src/routes/marketplaceCatalogRestaurant.ts "app/admin/marketplace/products/[id]/page.tsx" "app/admin/marketplace/orders/new/page.tsx"
  ```
  Expected: no output.

- [ ] **Step 4: Push to remote**

  ```bash
  git push
  ```

---

## Summary of Changes

| Bug / Feature | File | Change |
|---|---|---|
| Catalog returns 0 products | `marketplaceCatalogRestaurant.ts` | `'PUBLISHED'` → `'ACTIVE'` (5 places) |
| Product detail 404 on compat | `products/[id]/page.tsx` | Remove dead fetch, use `pData.compatibility` |
| Order builder search broken | `orders/new/page.tsx` | `?q=` → `?search=` |
| No marketplace i18n key | `lib/adminI18n.ts` | Add `marketplace` in ar/en/fr/es |
| No dashboard widget | `dashboard/page.tsx` | Add `MarketplaceWidget` component |

All other Epic 4 requirements (catalog UI, order builder, order history, bundles, notifications, product detail, sidebar gate, documentation) are already implemented and working.
