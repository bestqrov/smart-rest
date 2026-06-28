# Marketplace Orders Engine — Architecture

## Purpose

Order management with approval workflow for the SmartSuite Marketplace Engine.
No checkout, no payments, no shipping, no invoicing.

---

## Module Location

```
src/marketplace/
  orders/
    OrderService.ts          — createOrder, submit, cancel, getOrder(s), refreshTotals
  order-items/
    OrderItemService.ts      — addItem, removeItem, getOrderItems (with product snapshot)
  approval/
    ApprovalService.ts       — markUnderReview, approve, reject, fulfill
  workflow/
    OrderWorkflow.ts         — valid status transitions, guards
  services/
    OrderTotalsService.ts    — calculateOrderTotals, calculateItemTotal
```

---

## Data Models

### `MarketplaceOrder` → `marketplace_orders`

| Field       | Type     | Notes |
|-------------|----------|-------|
| orderNumber | String   | Unique, human-readable: `MO-{year}-{seq}` |
| tenantId    | String   | cafeId / hotelId / etc. |
| module      | String   | RESTAURANT \| HOTEL \| CLINIC \| RETAIL |
| status      | String   | See lifecycle below |
| requestedBy | String   | userId or cafeId |
| approvedBy  | String?  | Superadmin email |
| supplierId  | String?  | Optional supplier linkage |
| subtotal    | Float    | Sum of (item base × qty) after per-item discounts |
| discount    | Float    | Order-level discount amount (MAD) |
| tax         | Float    | Sum of per-item tax amounts |
| total       | Float    | subtotal - discount + tax |

### `MarketplaceOrderItem` → `marketplace_order_items`

| Field     | Type   | Notes |
|-----------|--------|-------|
| orderId   | String | Parent order |
| productId | String | Reference (not FK) |
| sku       | String | **Snapshot** — immutable |
| name      | String | **Snapshot** — immutable |
| quantity  | Int    | |
| unitPrice | Float  | Price at time of order |
| discount  | Float  | Percentage 0–100 applied to this line |
| tax       | Float  | Percentage 0–100 applied to this line |
| total     | Float  | `(unitPrice × (1 - discount/100) × (1 + tax/100)) × quantity` |
| metadata  | JSON?  | Any extra data (custom attributes, module-specific) |

> **Immutability**: `sku` and `name` are copied at `addItem()` time. Future product edits do not affect historical orders.

---

## Order Lifecycle

```
DRAFT ──────────────────────────────────────────────────────┐
  │                                                          │
  ▼ submit()                                                 │
SUBMITTED ──────────────────────────────────────────────────┤
  │                                                          │
  ▼ markUnderReview()                                        ▼ cancel()
UNDER_REVIEW ──────────────────────────────────────────── CANCELLED
  │
  ├─── approve() ──► APPROVED ──── fulfill() ──► FULFILLED
  │
  └─── reject() ───► REJECTED
```

### Allowed transitions

| From          | To                                    |
|---------------|---------------------------------------|
| DRAFT         | SUBMITTED, CANCELLED                  |
| SUBMITTED     | UNDER_REVIEW, CANCELLED               |
| UNDER_REVIEW  | APPROVED, REJECTED, CANCELLED         |
| APPROVED      | FULFILLED                             |
| REJECTED      | *(terminal)*                          |
| CANCELLED     | *(terminal)*                          |
| FULFILLED     | *(terminal)*                          |

All transitions are enforced in `OrderWorkflow.assertTransition()` — services never update status directly without going through this guard.

---

## Approval Flow

```
Restaurant (module tenant)
  POST /api/restaurant/marketplace/orders            → DRAFT
  POST /api/restaurant/marketplace/orders/:id/items  → add items
  POST /api/restaurant/marketplace/orders/:id/submit → SUBMITTED
  POST /api/restaurant/marketplace/orders/:id/cancel → CANCELLED

SuperAdmin
  GET  /api/superadmin/marketplace/orders            → list all
  POST /api/superadmin/marketplace/orders/:id/review  → UNDER_REVIEW
  POST /api/superadmin/marketplace/orders/:id/approve → APPROVED
  POST /api/superadmin/marketplace/orders/:id/reject  → REJECTED
  POST /api/superadmin/marketplace/orders/:id/fulfill → FULFILLED
```

---

## Inventory Interaction

| Event            | Inventory action |
|------------------|-----------------|
| Order submitted  | No change |
| Order approved   | `reserveStock(productId, qty)` for each item |
| Order rejected   | No change |
| Order cancelled (DRAFT/SUBMITTED) | No change |
| Order fulfilled  | `releaseReservation()` + `adjustStock(-qty)` |

Inventory uses `InventoryService` from `src/marketplace/inventory/InventoryService.ts`.

`available = stock - reserved` is always computed in memory (not stored).

---

## Totals Calculation

Totals are recalculated and persisted to `MarketplaceOrder` after every `addItem()` or `removeItem()` call.

**Per-item formula:**
```
afterDiscount = unitPrice × (1 - discount/100)
afterTax      = afterDiscount × (1 + tax/100)
itemTotal     = afterTax × quantity
```

**Order totals:**
```
subtotal = Σ(unitPrice × (1 - discount/100) × quantity)   [before tax]
taxSum   = Σ(unitPrice × (1 - discount/100) × (tax/100) × quantity)
discount = subtotal × (orderDiscount/100)                   [order-level]
total    = subtotal - discount + taxSum
```

---

## Notifications

Sent to `order.requestedBy` (restaurant tenant or user) via `NotificationService.createNotification()`:

| Event       | Level   | Message |
|-------------|---------|---------|
| APPROVED    | SUCCESS | "Your order MO-XXXX has been approved." |
| REJECTED    | WARNING | "Your order MO-XXXX has been rejected. Reason: …" |
| FULFILLED   | INFO    | "Your order MO-XXXX has been fulfilled." |

---

## Events

All 6 events published to the platform `EventBus`:

| Event                       | Published by |
|-----------------------------|-------------|
| `MarketplaceOrderCreated`   | `createOrder()` |
| `MarketplaceOrderSubmitted` | `submitOrder()` |
| `MarketplaceOrderApproved`  | `approveOrder()` |
| `MarketplaceOrderRejected`  | `rejectOrder()` |
| `MarketplaceOrderCancelled` | `cancelOrder()` |
| `MarketplaceOrderFulfilled` | `fulfillOrder()` |

---

## Audit

Every status change writes to `AuditService.createAudit()` with:
- `module: 'marketplace'`
- `entity: 'Order'`
- `action: 'ORDER_SUBMITTED' | 'ORDER_CANCELLED' | 'ORDER_UNDER_REVIEW' | 'ORDER_APPROVED' | 'ORDER_REJECTED' | 'ORDER_FULFILLED'`
- `performedBy`: user/superadmin email
- `metadata`: orderNumber, total, reason (where applicable)

---

## Future Integration Points

### Payments (Future Epic)
- Add `paymentStatus`, `paymentRef`, `paidAt` fields to `MarketplaceOrder`
- Payment gateway webhook sets `paymentStatus = 'PAID'` → triggers `fulfillOrder()`
- No changes to approval workflow or inventory logic

### Shipping (Future Epic)
- Add `ShipmentRecord` model linked to `orderId`
- Fulfillment triggers shipment creation
- `fulfillOrder()` emits `MarketplaceOrderFulfilled` which shipping service subscribes to
- No changes to order or approval logic

### Invoices (Future Epic)
- Subscribe to `MarketplaceOrderApproved` or `MarketplaceOrderFulfilled`
- Generate PDF invoice from order snapshot data
- Order items already contain price snapshots — no historical data loss

### Multi-module support
- `module` field drives access control: `tenantId` + `module` pair is the tenant identity
- Hotel, Clinic, Retail tenants use the same endpoints with their own JWT payloads
- SuperAdmin sees all orders across all modules
