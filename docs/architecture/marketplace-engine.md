# Marketplace Engine — Architecture

## Purpose

A shared SmartSuite OS engine that provides product catalogue, pricing, supplier management, and inventory tracking for all SmartSuite modules (Restaurant, Hotel, Clinic, Retail, and future verticals).

**Explicit non-goals:** No checkout, no payments, no shipping, no invoicing, no frontend store.

---

## Module Location

```
src/marketplace/
  types/index.ts          — All shared TypeScript types and enums
  categories/
    CategoryService.ts    — CRUD + unlimited hierarchy tree builder
  products/
    ProductService.ts     — Product lifecycle (DRAFT → ACTIVE → ARCHIVED)
  pricing/
    PricingService.ts     — Effective price, margin, tax, promo logic
  suppliers/
    SupplierService.ts    — Supplier CRUD + product count aggregation
  inventory/
    InventoryService.ts   — Stock / reserved / available tracking
  catalog/
    CatalogService.ts     — High-level read API (search, filter, featured)
  events/
    MarketplaceEvents.ts  — EventBus publish + AuditService write
  index.ts                — Public API + initMarketplaceEngine()
```

---

## Data Models (Prisma / MongoDB)

| Model                  | Collection                  | Key Fields |
|------------------------|-----------------------------|------------|
| `MarketplaceCategory`  | `marketplace_categories`    | slug (unique), parentId (nullable), sortOrder |
| `MarketplaceProduct`   | `marketplace_products`      | sku (unique), slug (unique), type, status, visibility, supportedModules[] |
| `ProductPricing`       | `marketplace_pricing`       | productId (unique), basePrice, discount, promotionalPrice, taxRate, costPrice |
| `MarketplaceSupplier`  | `marketplace_suppliers`     | email (unique), rating, status |
| `ProductInventory`     | `marketplace_inventory`     | productId (unique), stock, reserved, lowStockThreshold |

---

## Product Types

| Type           | Use case |
|----------------|----------|
| `HARDWARE`     | Physical POS terminals, printers, tablets |
| `SOFTWARE`     | SaaS plan add-ons, modules |
| `DIGITAL`      | Templates, reports, digital assets |
| `SERVICE`      | Onboarding, setup, consulting |
| `SUBSCRIPTION` | Recurring access plans |
| `LICENSE`      | Feature licenses per module |

---

## Pricing Logic

Priority order for `effectivePrice`:
1. If `promotionalPrice` is set → use it directly
2. Else if `discount` (%) is set → `basePrice × (1 - discount/100)`
3. Else → `basePrice`

`margin` = `(basePrice - costPrice) / basePrice × 100` (requires `costPrice`)

`calculateWithTax(price, taxRate)` applies tax on top of the effective price.

---

## Category Hierarchy

Categories use an adjacency list (`parentId`). Since MongoDB doesn't support recursive CTEs, the tree is built in memory by `getCategoryTree()`:
1. Fetch all categories in a single query
2. Build a `Map<id, CategoryTree>` (O(n))
3. Iterate and attach children to parents

This is O(n) and safe for hundreds of categories.

---

## Inventory Model

- `stock` — total physical stock
- `reserved` — stock held by pending actions (not deducted yet)
- `available` = `max(0, stock - reserved)` — computed in memory, not stored
- `isLowStock` = `available ≤ lowStockThreshold`

`reserveStock()` checks `available >= qty` before incrementing `reserved`. MongoDB does not enforce atomic check-and-update here — this is intentional for the foundation layer. Full atomic reservation should use a transaction when integrated into an order flow.

---

## Feature Flags

All marketplace flags follow the naming convention `marketplace.*`:

| Flag key                | Default       | Meaning |
|-------------------------|---------------|---------|
| `marketplace.enabled`   | `comingSoon`  | Master switch |
| `marketplace.restaurant`| `comingSoon`  | Visible to Restaurant module |
| `marketplace.hotel`     | `comingSoon`  | Visible to Hotel module |
| `marketplace.clinic`    | `comingSoon`  | Visible to Clinic module |
| `marketplace.retail`    | `comingSoon`  | Visible to Retail module |

The `marketplace` flag (no suffix) already exists in platform DEFAULT_FLAGS. The per-module flags are seeded by `initMarketplaceEngine()` at startup.

---

## Platform Events

All events are published to the platform `EventBus` and written to `AuditService`:

| Event                | Trigger |
|----------------------|---------|
| `ProductCreated`     | `createProduct()` |
| `ProductUpdated`     | `updateProduct()`, `setProductStatus()` |
| `ProductArchived`    | `archiveProduct()` |
| `SupplierCreated`    | `createSupplier()` |
| `InventoryUpdated`   | `setStock()` |
| `CategoryCreated`    | `createCategory()` |

---

## Catalog Service

`CatalogService` is the preferred read path for all consumer modules. It wraps the lower-level services and adds:

- `search(query)` — full-text across name, description, sku, brand
- `filter(criteria)` — multi-field filter with optional `inStockOnly`
- `getFeatured(limit)` — ACTIVE + PUBLIC products
- `getProductWithDetails(id)` — product + pricing + inventory in one call
- Pagination on all list endpoints

---

## Startup Sequence

`initMarketplaceEngine()` is called at server start after `initAnalyticsEngine()`. It upserts the 5 per-module feature flags idempotently. Failure is non-fatal.

---

## Integration Points

- **Analytics Engine**: Can add marketplace collectors (products count, active listings, low-stock count) — see `src/analytics/collectors/`.
- **Billing Engine**: Products can be referenced in subscription line items — billing stays independent.
- **Restaurant/Hotel/Clinic/Retail modules**: Use `CatalogService.getProductsByModule('RESTAURANT')` to list relevant items.
- **AI Center**: Can generate product descriptions via `createProduct({ description: aiGeneratedText })`.
