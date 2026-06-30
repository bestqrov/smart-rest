# Restaurant Marketplace Experience — UI Reference

Restaurant-facing marketplace inside the Admin panel. Gated behind Feature Flag `marketplace = enabled`. No payments. No shipping. No customer checkout.

---

## Navigation

Added to `/admin/layout.tsx` sidebar when `marketplaceEnabled === true` (fetched from `/api/restaurant/marketplace/flag`):

| Icon | Label (AR) | Label (EN) | Path |
|------|-----------|-----------|------|
| Store | المتجر | Marketplace | `/admin/marketplace` |

The nav item is hidden when the feature flag is disabled or `comingSoon`.

---

## Pages

### Homepage (`/admin/marketplace`)

**Hero section** — gradient emerald, search bar (navigates to catalog on submit).

**Stats widget (4 cards):**
- Pending Orders (SUBMITTED status count)
- Approved Orders count
- Total Spent (sum of APPROVED + FULFILLED orders)
- AI Recommendations count

**Smart Alerts** — from `/api/restaurant/marketplace/alerts` — cards with severity color (INFO=blue, WARNING=amber, SUCCESS=emerald), action link.

**Recommended For You** — from `/api/restaurant/marketplace/recommendations` — grid of 8 products with AI type badge.

**Featured Products** — from `/api/restaurant/marketplace/featured` — grid of 8.

**Trending** — from `.trending` in recommendations response — ranked list with order count reason.

**Recently Added** — from `/api/restaurant/marketplace/recent` — grid of 4.

**Recent Orders** — from widget response — list linked to order detail.

**CTA row** — Browse Catalog + My Orders buttons.

---

### Product Catalog (`/admin/marketplace/catalog`)

**Filters:** Search (300ms debounce), Type dropdown, Featured toggle.

**View switch:** Grid (default) / List.

**Pagination:** 20 per page, prev/next.

**Product card (grid):** Thumbnail, name, SKU, effective price, stock status (colored).

**Product card (list):** Row with thumbnail, name, SKU, type, price.

**API:** `GET /api/restaurant/marketplace/catalog?search&type&featured&page&limit`

---

### Product Detail (`/admin/marketplace/products/:id`)

**Image gallery:** Main image + thumbnail strip (up to 5).

**Info panel:**
- Name, SKU, brand, tags
- Price (with original + savings if discounted)
- Stock status with available count
- Compatibility badge (COMPATIBLE / PARTIAL / INCOMPATIBLE) + reasons

**Add to Order button** — navigates to `/admin/marketplace/orders/new?productId=:id`

**Description section** — full product description.

**Specifications** — type, SKU, brand grid.

**Supported Modules** — colored badges.

**Supplier card** — company, country, star rating.

**Related Products** — same category, 4 products.

**API:** `GET /api/restaurant/marketplace/catalog/:id`

---

### Order Builder (`/admin/marketplace/orders/new`)

**Product search** — inline search with 300ms debounce, dropdown results, click to add.

**Order items table:** Thumbnail, name, price/unit, quantity stepper (±), total, remove button.

**Notes textarea** — passed to order on create.

**Summary sidebar (sticky):**
- Per-item breakdown
- Subtotal
- Save Draft button → creates order + adds items → redirects to order detail
- Submit Order button → creates order + adds items + submits → redirects to order detail

**No payment fields. No shipping fields.**

**API flow:**
1. `POST /api/restaurant/marketplace/orders` → creates DRAFT order
2. `POST /api/restaurant/marketplace/orders/:id/items` (per item)
3. `POST /api/restaurant/marketplace/orders/:id/submit` (on submit)

---

### Order History (`/admin/marketplace/orders`)

**Status filter bar** — scrollable chips for all 7 statuses + All.

**Table:** Order #, Date (hidden on mobile), Status badge, Total, View link.

**New Order button** → `/admin/marketplace/orders/new`

**API:** `GET /api/restaurant/marketplace/orders?status&page&limit`

---

### Order Detail (`/admin/marketplace/orders/:id`)

**Progress timeline** — 5 steps: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILLED. Green for past, emerald dot for current. Hidden for REJECTED/CANCELLED.

**Rejection/Cancellation notice** — red alert banner with reason.

**Items table:** Product name, SKU, quantity, unit price, total.

**Notes panel** (if any).

**Totals sidebar:** Subtotal, Discount, Tax, Grand Total.

**Cancel button** — visible for DRAFT and SUBMITTED orders only. Calls `POST /api/restaurant/marketplace/orders/:id/cancel`.

**API:**
- `GET /api/restaurant/marketplace/orders/:id`
- `POST /api/restaurant/marketplace/orders/:id/cancel`

---

## Backend API Routes

All routes require `Authorization: Bearer <token>` (JWT with `cafeId`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/restaurant/marketplace/flag` | Feature flag status |
| GET | `/api/restaurant/marketplace/categories` | Active categories |
| GET | `/api/restaurant/marketplace/catalog` | Paginated product list |
| GET | `/api/restaurant/marketplace/catalog/:id` | Product detail with related |
| GET | `/api/restaurant/marketplace/featured` | Featured products (tag=featured) |
| GET | `/api/restaurant/marketplace/recent` | Recently added products |
| GET | `/api/restaurant/marketplace/low-stock-deals` | Low stock products |
| GET | `/api/restaurant/marketplace/recommendations` | AI recommendations |
| POST | `/api/restaurant/marketplace/recommendations/:logId/accept` | Log acceptance |
| POST | `/api/restaurant/marketplace/recommendations/:logId/dismiss` | Log dismissal |
| GET | `/api/restaurant/marketplace/bundles` | Active bundles with products |
| POST | `/api/restaurant/marketplace/bundles/:id/view` | Track bundle view event |
| GET | `/api/restaurant/marketplace/alerts` | Smart alerts for this cafe |
| GET | `/api/restaurant/marketplace/widget` | Dashboard widget data |
| GET | `/api/restaurant/marketplace/compatibility/:productId` | Product compatibility check |

Order management routes (from Epic 2):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/restaurant/marketplace/orders` | Create DRAFT order |
| POST | `/api/restaurant/marketplace/orders/:id/items` | Add item |
| DELETE | `/api/restaurant/marketplace/orders/:id/items/:itemId` | Remove item |
| POST | `/api/restaurant/marketplace/orders/:id/submit` | Submit for review |
| POST | `/api/restaurant/marketplace/orders/:id/cancel` | Cancel |
| GET | `/api/restaurant/marketplace/orders` | Order list with filters |
| GET | `/api/restaurant/marketplace/orders/:id` | Order detail with items |

---

## Design System

- **Theme:** Light (bg-white, bg-gray-50)
- **RTL:** `useLang()` from `app/admin/lang-context.tsx` → `isRTL` → `dir={isRTL ? 'rtl' : 'ltr'}`
- **Language:** Arabic (default) ↔ English via `useLang()` context
- **Auth:** `localStorage.getItem('token')` → `Authorization: Bearer ${token}`
- **Icons:** lucide-react only
- **Accent:** emerald-600 as primary action color

---

## Feature Flag Gate

The marketplace nav item fetches `GET /api/restaurant/marketplace/flag` on mount.  
Returns `{ enabled: boolean }` — `true` only when the `marketplace` feature flag has status `'enabled'`.

SuperAdmins enable the flag via the Feature Flags page in the SuperAdmin console.
