# Marketplace Admin Console — UI Reference

SuperAdmin interface for full marketplace management. No payments, no shipping, no customer storefront.

---

## Navigation

Added under **Marketplace** section in `/superadmin/layout.tsx`:

| Page | Path | Icon |
|------|------|------|
| Dashboard | `/superadmin/marketplace` | ShoppingBag |
| Categories | `/superadmin/marketplace/categories` | Tag |
| Products | `/superadmin/marketplace/products` | Package |
| Suppliers | `/superadmin/marketplace/suppliers` | Truck |
| Orders | `/superadmin/marketplace/orders` | ClipboardList |
| Inventory | `/superadmin/marketplace/inventory` | Warehouse |

---

## Pages

### Dashboard (`/superadmin/marketplace`)

**Stats grid (8 cards):** Total Products, Active Products, Categories, Suppliers, Orders, Pending Orders, Low Stock, Inventory Value

**Tables:**
- Recent Orders (last 5) — click → order detail
- Recent Products (last 5) — click → edit page
- Top Categories (top 5 by product count)

**API:** `GET /api/superadmin/marketplace/dashboard`

---

### Categories (`/superadmin/marketplace/categories`)

**Tree view** — adjacency list rendered recursively. Each node:
- Expand/collapse toggle (ChevronRight/Down)
- Icon emoji display
- Name, slug, description, active badge, child count
- Hover: edit (inline), toggle active, delete

**Create form** — opens above tree: name, slug (auto), icon, parent (dropdown), description, sortOrder.

**Inline edit** — click edit icon → name + icon + description inputs appear in row; Check/X to save/cancel.

**API:**
- `GET /api/superadmin/marketplace/categories?tree=1&onlyActive=0`
- `GET /api/superadmin/marketplace/categories?onlyActive=0` (for dropdowns)
- `POST /api/superadmin/marketplace/categories`
- `PATCH /api/superadmin/marketplace/categories/:id`
- `DELETE /api/superadmin/marketplace/categories/:id` (soft-archive)

---

### Products (`/superadmin/marketplace/products`)

**Data table** with columns: Name/SKU, Type badge, Status badge, Supported Modules, Actions (Edit, Duplicate, Archive)

**Filters:** Search (300ms debounce), Type dropdown, Status dropdown

**Sorting:** Click Name column header → toggles asc/desc

**Pagination:** 20 per page, Previous/Next

**Actions:**
- Edit → `/superadmin/marketplace/products/:id`
- Duplicate → `POST /api/.../duplicate` (creates copy with -copy-{timestamp} suffix)
- Archive → `POST /api/.../archive`

**Create:** Link to `/superadmin/marketplace/products/new`

**API:** `GET /api/superadmin/marketplace/products?search&type&status&page&limit&sortBy&sortOrder`

---

### Product Form — New (`/superadmin/marketplace/products/new`)

**Tabs:**
- **General:** SKU, Name, Slug, Brand, Type, Category, Visibility, Supplier, Description, Tags, Image URLs
- **Pricing:** Base Price, Currency, Discount %, Promo Price, Tax Rate %, Cost Price
- **Inventory:** Initial Stock, Low Stock Threshold
- **Modules:** Multi-select (RESTAURANT / HOTEL / CLINIC / RETAIL / ALL)

On save: creates product → if pricing fields filled, creates pricing → if initialStock > 0, sets inventory → redirects to edit page.

---

### Product Form — Edit (`/superadmin/marketplace/products/:id`)

Same 4 tabs. Each tab has its own **Save** button (saves only that section).

**Header actions:**
- Publish / Archive toggle (green/red button)
- Refresh

**Inventory tab** shows current Stock / Reserved / Available counts before the edit form.

**Pricing tab** shows current Effective Price banner.

---

### Suppliers (`/superadmin/marketplace/suppliers`)

**Table:** Company, Email (md+), Country (lg+), Star Rating (md+), Status dropdown, Product Count (xl+), Edit button

**Status change** — inline select dropdown (ACTIVE / INACTIVE / BLOCKED) — fires PATCH immediately.

**Edit** — inline expand row with same form fields.

**Create** — slide-in form above table: Company, Contact, Email, Phone, Country, Rating (1–5), Notes.

**API:**
- `GET /api/superadmin/marketplace/suppliers?status=`
- `POST /api/superadmin/marketplace/suppliers`
- `PATCH /api/superadmin/marketplace/suppliers/:id`
- `PATCH /api/superadmin/marketplace/suppliers/:id/status`

---

### Orders (`/superadmin/marketplace/orders`)

**Table:** Order #, Module badge, Status badge, Total, Date, View button

**Filters:** Status dropdown, Module dropdown

**Pagination:** 20 per page

**API:** `GET /api/superadmin/marketplace/orders?status&module&page&limit`

---

### Order Detail (`/superadmin/marketplace/orders/:id`)

**Timeline bar** — 5 steps: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILLED. Filled green for past steps, blue for current.

**Action buttons** (context-aware):
- SUBMITTED → "Mark as Under Review" (yellow)
- UNDER_REVIEW → "Approve" (green) + "Reject" (red, with reason textarea)
- APPROVED → "Fulfill" (emerald)
- Terminal states (REJECTED, CANCELLED, FULFILLED) → no actions

**Items table:** Name/SKU, Qty, Unit Price, Discount %, Total

**Sidebar:** Order metadata + Totals breakdown (Subtotal, Discount, Tax, Total)

**API:**
- `GET /api/superadmin/marketplace/orders/:id`
- `POST /api/superadmin/marketplace/orders/:id/review`
- `POST /api/superadmin/marketplace/orders/:id/approve`
- `POST /api/superadmin/marketplace/orders/:id/reject`
- `POST /api/superadmin/marketplace/orders/:id/fulfill`

---

### Inventory (`/superadmin/marketplace/inventory`)

**Alert banner** if any products are below low stock threshold.

**Toggle:** All Items / Low Stock Only

**Table:** Product ID, Stock, Reserved (md+), Available (bold emerald), Threshold (lg+), Status badge (LOW/OK), Inline adjustment

**Inline adjustment** — per row: mode select (Set / ±), number input, OK button. Fires immediately.

**API:**
- `GET /api/superadmin/marketplace/inventory`
- `GET /api/superadmin/marketplace/inventory/low-stock`
- `PATCH /api/superadmin/marketplace/inventory/:productId/stock`
- `POST /api/superadmin/marketplace/inventory/:productId/adjust`

---

## Design System

- **Theme:** Dark (zinc-950 background)
- **RTL:** `dir={isRTL ? 'rtl' : 'ltr'}` on root div; `text-start`, `ms-*`, `ps-*`, `pe-*`
- **Language toggle:** Arabic (default) ↔ English on every page
- **Auth:** `useSAAuth()` → `const { header } = useSAAuth()` → `headers: header()`
- **Icons:** lucide-react only
- **Accent colors per section:** Dashboard=emerald, Categories=purple, Products=blue, Suppliers=orange, Orders=sky, Inventory=violet

---

## Backend API Routes

| Router file | Prefix |
|---|---|
| `marketplaceDashboardSA.ts` | `/api/superadmin/marketplace/dashboard` |
| `marketplaceCategoriesSA.ts` | `/api/superadmin/marketplace/categories` |
| `marketplaceProductsSA.ts` | `/api/superadmin/marketplace/products` |
| `marketplaceSuppliersSA.ts` | `/api/superadmin/marketplace/suppliers` |
| `marketplaceInventorySA.ts` | `/api/superadmin/marketplace/inventory` |
| `marketplaceOrdersSA.ts` | `/api/superadmin/marketplace/orders` |

All routes require `x-superadmin-secret` + `x-superadmin-email` headers.
