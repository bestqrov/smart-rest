# Restaurant Marketplace — UI Reference

SmartSuite Marketplace experience for Restaurant Admins. Visible only when the `marketplace` Feature Flag is enabled. Dark theme, RTL-first, Arabic default.

---

## Navigation

### Main Admin Sidebar
- **Marketplace** link appears conditionally (when `marketplace` Feature Flag is `enabled`).
- Navigates to `/admin/marketplace`.

### Marketplace Sub-Nav (dark sticky bar)
Shared layout via `app/admin/marketplace/layout.tsx`:

| Tab | Path | Icon |
|-----|------|------|
| Home | `/admin/marketplace` | Store |
| Catalog | `/admin/marketplace/catalog` | Package |
| Bundles | `/admin/marketplace/bundles` | Layers |
| Orders | `/admin/marketplace/orders` | ShoppingCart |
| Alerts | `/admin/marketplace/notifications` | Bell |

---

## Theme

All marketplace pages use **dark theme**:
- Background: `bg-gray-950`
- Cards: `bg-gray-900 border border-gray-800`
- Primary text: `text-white` / `text-gray-100`
- Secondary text: `text-gray-400`
- Muted: `text-gray-500`
- Accent: `text-emerald-400` / `bg-emerald-600`
- Inputs: `bg-gray-900 border border-gray-700 text-gray-100`
- Skeleton: `animate-pulse bg-gray-800`

---

## Pages

### 1. Marketplace Home (`/admin/marketplace`)

**Sections (top to bottom):**
1. **Hero** — Gradient banner (`from-emerald-950 via-gray-900`) with search bar. Submits to `/catalog?q=`.
2. **Stats Row** — Pending Orders · Approved Orders · Total Spent.
3. **Quick Categories** — 8-column icon grid linking to `/catalog?category=:id`.
4. **Smart Alerts** — Color-coded by severity (INFO/WARNING/SUCCESS).
5. **Featured Products** — 4-card grid.
6. **Recommended For You** — AI-scored recommendations with type badge.
7. **Bundles** — 3-column cards with savings. Links to `/bundles`.
8. **Services** — Products of type `SERVICE`.
9. **Trending** — Ordered by purchase frequency.
10. **New Arrivals** — Most recently added.
11. **Recent Orders** — Last 5 with status + total.

---

### 2. Product Catalog (`/admin/marketplace/catalog`)

**Filters (collapsible panel):**
| Filter | Type | API param |
|--------|------|-----------|
| Search | Debounced text | `?q=` |
| Type | Dropdown | `?type=` |
| Brand | Dropdown (from API) | `?brand=` |
| Availability | Dropdown | `?avail=inStock|lowStock|outOfStock` |
| Price Range | Min + Max inputs | `?priceMin=&priceMax=` |
| Featured | Toggle | `?featured=true` |
| Category | From URL | `?category=` |
| Sort | `newest|priceAsc|priceDesc|name|featured|trending` | `?sort=` |

**Views:** Grid (2–4 cols) ↔ List toggle. Pagination: 20/page.

---

### 3. Product Detail (`/admin/marketplace/products/[id]`)

**Layout:** Left = image gallery · Right = info + CTA

**Sections:**
- Aspect-square gallery with prev/next arrows + thumbnail strip
- Type · Name · Brand · SKU
- Effective price + crossed-out original
- Stock status badge (In Stock / Low Stock / Out of Stock + unit count)
- **Compatibility badge** — COMPATIBLE / PARTIAL / INCOMPATIBLE with score % and reason list
- "Add to Order" CTA → `/orders/new?productId=:id`
- Shipping placeholder
- Supplier card (name, email, phone)
- Description
- Specs (from `metadata.specs` JSON)
- Compatible SmartSuite Modules
- Tags
- **Bundles Including This** — filtered from bundle list
- **Related Products** — 4-column grid

---

### 4. Bundle List (`/admin/marketplace/bundles`)

Gradient cards by type:
| Type | Color |
|------|-------|
| STARTER | Emerald |
| PROFESSIONAL | Blue |
| PREMIUM | Purple |
| CUSTOM | Gray |

Each shows: type · name · description · product count · savings badge · price · "Bundle Details" link.

---

### 5. Bundle Detail (`/admin/marketplace/bundles/[id]`)

- Hero card: type, name, description, count, savings
- Pricing sidebar: individual total (crossed out) · bundle price · savings · "Order This Bundle"
- Included products list: numbered, thumbnail, name, SKU, stock, price

**Order Bundle:** navigates to `/orders/new?productId=...&bundleId=:id` — all products pre-loaded.

---

### 6. Order Builder (`/admin/marketplace/orders/new`)

- Product search (debounced 300ms) → dropdown results
- Cart: thumbnail · name · SKU · unit price · qty stepper · line total · remove
- Notes textarea
- Sticky summary: subtotal · Save Draft · Submit Order
- **Duplicate Previous Order** — modal listing last FULFILLED orders

**Pre-load via URL:**
- `?productId=:id` → single product
- `?productId=...&bundleId=:id` → bundle products

**Submit flow:**
1. POST `/orders` → `orderId`
2. POST `/orders/:id/items`
3. POST `/orders/:id/submit` (if submit selected)
4. Redirect to `/orders/:id`

---

### 7. Order History (`/admin/marketplace/orders`)

**Filters:** Search · Date range (from/to) · Status chips

**Views:**
- **Timeline** (default) — card per order with 5-step progress bar (DRAFT → SUBMITTED → UNDER REVIEW → APPROVED → FULFILLED). Rejected/Cancelled shown as terminal with red label.
- **List** — compact table with status badge, date, total.

**Pagination:** 12/page.

---

### 8. Order Detail (`/admin/marketplace/orders/[id]`)

- Header: order number, date, status badge
- Timeline: 5-step with active step glow (`shadow-[0_0_12px_rgba(16,185,129,0.3)]`)
- Items table: name (links to product) · SKU · qty · unit price · total
- Notes
- Reorder button (→ `/orders/new?reorder=:id`)
- Cancel button (DRAFT/SUBMITTED only)
- Summary sidebar: subtotal · discount · tax · grand total

---

### 9. Notifications (`/admin/marketplace/notifications`)

- Lists `coreNotification` records where `module = 'MARKETPLACE'` and `targetId = cafeId`
- Tabs: All · Unread · Read
- Unread count badge
- Mark individual read (click)
- Mark all read button
- "View Order" link parsed from `metadata.orderId` or `entityId`

**Notification events:**
| Trigger | Level |
|---------|-------|
| PaymentCreated | INFO |
| PaymentSucceeded | SUCCESS |
| MarketplaceOrderApproved | SUCCESS |
| Order Rejected | WARNING |
| Order Fulfilled | SUCCESS |

---

## Order Status Lifecycle (restaurant view)

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILLED
                                 ↘ REJECTED  (terminal)
DRAFT / SUBMITTED → CANCELLED    (restaurant-initiated)
```

---

## Future: Payment UI

Phase planned post-V1:
1. "Payment Required" banner on Order Detail after approval
2. Payment method selection (Cash / Bank Transfer)
3. SuperAdmin validates → "Payment Confirmed" notification
4. Order moves to "Ready for Fulfillment"

---

## Future: Shipping UI

Phase planned post-V1:
1. Supplier ships → tracking number on Order Detail
2. "In Transit" timeline step
3. Delivery confirmed → FULFILLED

---

## Quality Rules

- No online payments.
- No shipping.
- No customer checkout.
- No duplicated logic — all data via existing Marketplace APIs.
- RTL first (`dir={isRTL ? 'rtl' : 'ltr'}`).
- Arabic default.
- Dark theme throughout.
- Skeleton loading on all data-fetching sections.
- Empty states with icon + message + CTA.
- Error recovery with retry buttons.
