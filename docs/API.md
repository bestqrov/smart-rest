# SmartRestau — API Reference

All endpoints are served by the Express backend on the same server as the Next.js frontend.  
Base URL: `https://yourdomain.com` (configured via `FRONTEND_URL`).

## Authentication

Most endpoints require a JWT Bearer token:
```
Authorization: Bearer <access_token>
```

Access tokens expire after `ACCESS_TOKEN_EXPIRY` (default 30 minutes).  
Use `POST /api/auth/refresh` with a valid refresh token to get a new access token.

**Auth levels:**
- **Public** — no token required
- **Admin** — restaurant owner JWT (role: MANAGER or OWNER)
- **POS** — cashier/waiter JWT issued by `/api/pos/shift/login`
- **Kitchen** — kitchen staff JWT
- **Waiter** — waiter JWT
- **SuperAdmin** — platform admin (`x-superadmin-secret` + `x-superadmin-email` headers)
- **Internal** — service-to-service (`x-internal-secret` header = `INTERNAL_API_SECRET`)

---

## Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register new cafe (legacy — use magic-send) |
| POST | `/api/auth/quick-register` | Public | One-step register + login |
| POST | `/api/auth/login` | Public | Email + password login |
| POST | `/api/auth/logout` | Admin | Revoke refresh token |
| POST | `/api/auth/refresh` | Public | Exchange refresh token for new access token |
| POST | `/api/auth/magic-send` | Public | Send magic link email to registered admin |
| POST | `/api/auth/magic-login-send` | Public | Send magic link to existing account |
| GET | `/api/auth/magic` | Public | Verify magic link token, return JWT |
| GET | `/api/auth/magic-verify` | Public | Alternative magic link verification path |
| POST | `/api/admin/auth/change-password` | Admin | Change manager password |
| GET | `/api/auth/test-email` | SuperAdmin | Send test email (QA only) |
| POST | `/api/demo-login` | Public | Login to demo account |

---

## Menu Management (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/categories` | Admin | List all categories with products |
| POST | `/api/admin/categories` | Admin | Create category |
| PATCH | `/api/admin/categories/:id` | Admin | Update category (name, image, order) |
| DELETE | `/api/admin/categories/:id` | Admin | Delete category |
| GET | `/api/admin/products` | Admin | List all products |
| POST | `/api/admin/products` | Admin | Create product |
| PATCH | `/api/admin/products/:id` | Admin | Update product |
| DELETE | `/api/admin/products/:id` | Admin | Delete product |
| POST | `/api/admin/menu/seed-demo` | Admin | Seed demo menu (4 categories, 12 products) |

---

## Menu AI Generation (`/api/admin/menu-gen`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/menu-gen/from-url` | Admin | Scrape menu from website URL via Groq AI |
| POST | `/api/admin/menu-gen/from-images` | Admin | Extract menu from uploaded photos via Groq vision |
| POST | `/api/admin/menu-gen/from-file` | Admin | Parse xlsx/pdf/docx/csv menu file via Groq AI |
| POST | `/api/admin/menu-gen/enhance` | Admin | Enhance existing menu with AI descriptions |
| POST | `/api/admin/menu-gen/price-suggest` | Admin | Suggest prices based on market data |
| POST | `/api/admin/menu-gen/fetch-images` | Admin | Auto-fetch dish images from web |
| POST | `/api/admin/menu-gen/publish-draft` | Admin | Publish AI-generated draft to live menu |

---

## Customer Menu (Public QR)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/menu` | Public | Full menu for QR scan page (`?token=<qrToken>`) |
| GET | `/api/menu/public` | Public | Public menu by subdomain |
| GET | `/api/menu/wifi` | Public | WiFi password for QR menu page |

---

## Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | Public | Create order from QR menu |
| GET | `/api/orders` | Admin | List orders (paginated, filterable) |
| PATCH | `/api/orders/:id` | Admin/Kitchen | Update order status |

---

## POS Terminal (`/api/pos`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/pos/shift/login` | Public | Staff PIN login → POS JWT |
| POST | `/api/pos/shift/logout` | POS | End shift |
| GET | `/api/pos/tables` | POS | Live table status grid |
| GET | `/api/pos/orders` | POS | Orders for a table |
| POST | `/api/pos/orders` | POS | Create manual POS order |
| PATCH | `/api/pos/orders/:id` | POS | Update order |
| POST | `/api/pos/checkout` | POS | Close bill for a table (cash/card/online) |
| POST | `/api/pos/checkout-by-seats` | POS | Split bill by seat |
| GET | `/api/pos/waiter/tables` | Waiter | Tables assigned to this waiter |

---

## Waiter

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/waiters/me` | Waiter | Current waiter profile |
| GET | `/api/waiters/today-stats` | Waiter | Today's order and tip stats |
| GET | `/api/waiters/active-notifications` | Waiter | Pending table call notifications |
| POST | `/api/waiter/notifications/ack` | Waiter | Acknowledge a notification |
| GET | `/api/waiters/qr-login` | Public | QR-based waiter login |
| GET | `/api/admin/waiter-qr-token` | Admin | Generate waiter login QR |
| GET | `/api/admin/waiters-performance` | Admin | Waiter performance metrics |

---

## Waiter Calls

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/waiter-calls` | Public | Customer calls waiter from QR menu |
| GET | `/api/waiter-calls` | Admin/Waiter | List active calls |

---

## Kitchen Display (`/api/kitchen`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kitchen/orders/queue` | Kitchen | NEW + COOKING orders |
| PATCH | `/api/kitchen/orders/:orderId` | Kitchen | Update order status (COOKING → READY) |
| GET | `/api/kitchen/daily-stats` | Kitchen | Today's completed/cancelled count |
| GET | `/api/kitchen/reservations` | Kitchen | Pending reservations |
| PATCH | `/api/kitchen/reservations/:id` | Kitchen | Accept/cancel reservation |

---

## Bill Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/bill-requests` | Public | Customer requests bill from QR menu |
| GET | `/api/bill-requests` | Admin | List bill requests |

---

## Tables & Zones (`/api/tables`, `/api/zones`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tables` | Admin | List all tables with sessions |
| POST | `/api/tables/sync` | Admin | Sync table count per zone |
| POST | `/api/tables/generate` | Admin | Generate QR codes for all tables |
| PATCH | `/api/tables/:id` | Admin | Update table (capacity, display type) |
| POST | `/api/tables/:id/activate` | Admin | Activate/deactivate table |
| GET | `/api/tables/:tableId/active-seats` | Admin | Active seat sessions on a table |
| POST | `/api/tables/merge` | Admin | Merge source tables into target |
| POST | `/api/tables/unmerge` | Admin | Unmerge previously merged tables |
| GET | `/api/supervisor/tables` | POS | Supervisor live table view |
| GET | `/api/admin/tables/:id` | Admin | Table detail with session history |
| GET | `/api/admin/tables/:tableId/sessions` | Admin | Session history for a table |
| POST | `/api/admin/sessions/cleanup` | Admin | Force-close stale sessions |
| GET | `/api/zones` | Admin | List zones |
| POST | `/api/zones` | Admin | Create zone |
| PATCH | `/api/zones/:zoneId` | Admin | Update zone |
| DELETE | `/api/zones/:zoneId` | Admin | Delete zone |
| PATCH | `/api/zones/:zoneId/match-mode` | Admin | Toggle match mode for zone |
| POST | `/api/zones/scan` | Public | Assign token on QR scan |
| GET | `/api/zones/sessions/active` | Admin | Active zone sessions |
| PATCH | `/api/zones/sessions/:sessionId/status` | Admin | Update session status |
| POST | `/api/zones/sessions/:sessionId/close` | Admin | Close a session |
| POST | `/api/zones/sessions/mark-served` | Admin | Mark session as served |

---

## Staff (`/api/admin/staff`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/staff` | Admin | List all staff |
| POST | `/api/admin/staff` | Admin | Add staff member |
| PATCH | `/api/admin/staff/:id` | Admin | Update staff (name, role, PIN) |
| DELETE | `/api/admin/staff/:id` | Admin | Remove staff |
| PATCH | `/api/admin/staff/:id/pin` | Admin | Update staff PIN |
| GET | `/api/admin/attendance/pointage` | Admin | Attendance log (clock-in/out) |

---

## Reservations (`/api/admin/reservations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reservations` | Public | Submit reservation from QR menu |
| GET | `/api/admin/reservations` | Admin | List reservations (filter by status, date, search) |
| PATCH | `/api/admin/reservations/:id` | Admin | Update reservation (accept/cancel/complete/assign table) |
| GET | `/api/admin/reservations/counts` | Admin | Summary counts per status |

---

## Loyalty (`/api/loyalty`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/loyalty/customers` | Admin | List loyalty customers (paginated) |
| GET | `/api/loyalty/:phone` | Admin | Customer loyalty profile + ledger |
| POST | `/api/loyalty/redeem` | Admin | Redeem points for a customer |

---

## Financials & Billing (`/api/finance`, `/api/admin/financials`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/finance/status` | Admin | Wallet balance + billing status |
| GET | `/api/finance/wallet-log` | Admin | Transaction ledger (paginated) |
| GET | `/api/finance/invoices` | Admin | Invoice history |
| GET | `/api/finance/billing-package` | Admin | Current AI billing package |
| POST | `/api/finance/accept-ai-package` | Admin | Accept suggested billing package |
| POST | `/api/finance/regenerate-package` | Admin | Regenerate billing package |
| POST | `/api/finance/extend-trial` | Admin | Request trial extension |
| POST | `/api/finance/payment-request` | Admin | Submit payment request to superadmin |
| POST | `/api/finance/settle-debt` | Admin | Settle outstanding debt (requires confirmed PaymentRequest within 30 days) |
| POST | `/api/finance/subscription-invoice` | Admin | Generate subscription invoice |
| GET | `/api/admin/financials/report` | Admin | Financial report (revenue, orders, commissions) |
| GET | `/api/admin/stats` | Admin | Dashboard KPIs |
| GET | `/api/admin/stats/margins` | Admin | Product margin analysis |
| GET | `/api/admin/expenses` | Admin | List expenses |
| POST | `/api/admin/expenses` | Admin | Add expense |
| PATCH | `/api/admin/expenses/:id` | Admin | Update expense |
| DELETE | `/api/admin/expenses/:id` | Admin | Delete expense |
| GET | `/api/admin/payroll` | Admin | Staff payroll summary |
| PATCH | `/api/admin/payroll/:staffId/rate` | Admin | Update staff hourly/daily rate |

---

## Inventory (`/api/v1/inventory`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/inventory/stock` | Admin | Stock items list |
| GET | `/api/v1/inventory/stock/:id` | Admin | Stock item detail |
| POST | `/api/v1/inventory/stock/:id/restock` | Admin | Record restock |
| GET | `/api/v1/inventory/stock/low` | Admin | Low-stock alerts |
| GET | `/api/v1/inventory/suppliers` | Admin | Suppliers list |
| POST | `/api/v1/inventory/suppliers` | Admin | Add supplier |
| PATCH | `/api/v1/inventory/suppliers/:id` | Admin | Update supplier |
| DELETE | `/api/v1/inventory/suppliers/:id` | Admin | Remove supplier |
| GET | `/api/v1/inventory/purchase-orders` | Admin | Purchase orders |
| POST | `/api/v1/inventory/purchase-orders` | Admin | Create purchase order |
| PATCH | `/api/v1/inventory/purchase-orders/:id` | Admin | Update PO status |
| GET | `/api/v1/inventory/notifications` | Admin | Inventory alerts |
| PATCH | `/api/v1/inventory/notifications/:id/read` | Admin | Mark notification read |
| POST | `/api/v1/inventory/notifications/read-all` | Admin | Mark all notifications read |
| GET | `/api/v1/inventory/activation-status` | Admin | Inventory module activation status |
| POST | `/api/v1/inventory/request-activation` | Admin | Request inventory module activation |
| POST | `/api/v1/inventory/webhook/low-stock` | Internal | n8n → low-stock webhook |
| GET | `/api/v1/stock` | Admin | Legacy stock endpoint |
| PUT | `/api/v1/stock/:id` | Admin | Legacy stock update |

---

## Equipment & Maintenance (`/api/v1/equipment`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/equipment` | Admin | Equipment list |
| POST | `/api/v1/equipment` | Admin | Add equipment |
| PATCH | `/api/v1/equipment/:id` | Admin | Update equipment |
| DELETE | `/api/v1/equipment/:id` | Admin | Remove equipment |
| POST | `/api/v1/equipment/:equipId/maintenance` | Admin | Log maintenance record |
| PATCH | `/api/v1/equipment/:equipId/maintenance/:recordId` | Admin | Update maintenance record |

---

## Supplier Invoices & Requisitions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/invoices` | Admin | Supplier invoices |
| POST | `/api/v1/invoices` | Admin | Create invoice |
| PATCH | `/api/v1/invoices/:id` | Admin | Update invoice |
| DELETE | `/api/v1/invoices/:id` | Admin | Delete invoice |
| GET | `/api/v1/requisitions` | Admin | Purchase requisitions |
| POST | `/api/v1/requisitions` | Admin | Create requisition |
| PATCH | `/api/v1/requisitions/:id` | Admin | Update requisition status |

---

## Recipes (`/api/v1/recipes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/recipes` | Admin | All recipes |
| GET | `/api/v1/recipes/:productId` | Admin | Recipe for a product |
| POST | `/api/v1/recipes` | Admin | Create/update recipe |
| POST | `/api/v1/recipes/ai-suggest` | Admin | AI ingredient suggestion (Groq) |

---

## Marketing & Social

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/campaigns` | Admin | List marketing campaigns |
| GET | `/campaigns/:id` | Admin | Campaign detail |
| GET | `/campaigns/:id/status` | Admin | Rendering/publish status |
| POST | `/generate-video` | Admin | Trigger AI video generation |
| GET | `/subscription-status` | Admin | Marketing subscription tier |
| GET | `/summary/stats` | Admin | Campaign performance stats |
| GET | `/api/v1/review-gallery` | Admin | Review gallery items |
| POST | `/api/v1/review-gallery` | Internal | n8n W2 → create review gallery item |
| PATCH | `/api/v1/review-gallery/:id/moderate` | Admin | Approve/reject review |
| GET | `/api/v1/review-gallery/:id/full` | Admin | Review with all media |
| PATCH | `/api/v1/review-gallery/:id/published` | Admin | Toggle published state |
| GET | `/api/admin/review-gallery` | Admin | Admin review gallery list |

---

## Reviews

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reviews` | Public | Submit review from QR menu |
| POST | `/api/product-interactions` | Public | Like/dislike a product |

---

## Catering / Traiteur (`/api/traiteur`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/traiteur/events` | Admin | List catering events |
| POST | `/api/traiteur/events` | Admin | Create event |
| GET | `/api/traiteur/events/:id` | Admin | Event detail |
| PATCH | `/api/traiteur/events/:id` | Admin | Update event |
| DELETE | `/api/traiteur/events/:id` | Admin | Delete event |
| POST | `/api/traiteur/events/:id/guests` | Admin | Add guest(s) |
| POST | `/api/traiteur/events/:id/guests/bulk` | Admin | Bulk import guests |
| GET | `/api/traiteur/events/:id/guests` | Admin | Guest list |
| PATCH | `/api/traiteur/events/:id/guests/:guestId` | Admin | Update guest |
| DELETE | `/api/traiteur/events/:id/guests/:guestId` | Admin | Remove guest |
| POST | `/api/traiteur/events/:id/guests/:guestId/checkin` | Public | Check in guest via QR |
| GET | `/api/traiteur/events/:id/guest-scan` | Public | QR scan → guest lookup |
| GET | `/api/traiteur/events/:id/cards` | Admin | Print guest cards |
| POST | `/api/traiteur/events/:id/close` | Admin | Close event |
| GET | `/api/traiteur/stats` | Admin | Catering revenue stats |

---

## Customers & WhatsApp Opt-in

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/customers/optin` | Internal (n8n) | Record WhatsApp re-engagement opt-in |
| POST | `/api/customers/optout` | Internal | Record opt-out |

---

## Payments (`/api/payment`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payment/initiate` | Public | Initiate online payment (Mobile Money) |
| GET | `/api/payment/status/:sessionId` | Public | Check payment status |
| POST | `/api/payment/confirm/:sessionId` | Admin | Staff confirm Mobile Money payment |
| POST | `/api/payment/gulf/stripe-webhook` | Public (Stripe) | Stripe webhook receiver |
| POST | `/api/payment/gulf/moyasar-webhook` | Public (Moyasar) | Moyasar webhook receiver |

---

## Cafe Settings (`/api/admin/cafe`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/cafe/profile` | Admin | Cafe profile (name, logo, colors) |
| PATCH | `/api/admin/cafe/profile` | Admin | Update profile |
| PATCH | `/api/admin/cafe/tier` | Admin | Set cafe tier |
| POST | `/api/admin/cafe/tier-upgrade` | Admin | Request tier upgrade |
| PATCH | `/api/admin/cafe/payment-config` | Admin | Configure payment methods |
| PATCH | `/api/admin/cafe/wifi` | Admin | Update WiFi password |
| POST | `/api/admin/onboarding` | Admin | Complete onboarding wizard (step 5) |
| GET | `/api/admin/certification` | Admin | Certification status + criteria |

---

## Public Cafe Info

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/public/cafe/:subdomain` | Public | Public cafe info (name, logo, features) |
| GET | `/api/public/reservation/:reservationId` | Public | Reservation detail for review page |

---

## Anti-Fraud & Integrations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/integrations/print-spy-receiver` | Internal | POS Bridge receipt ingest |
| POST | `/api/v1/integrations/qr-heartbeat` | Public | QR session activity ping |
| GET | `/api/v1/analytics/anti-fraud-check` | Admin | Run cross-check + return alerts |
| GET | `/api/v1/analytics/fraud-alerts` | Admin | Fraud alert list |
| PATCH | `/api/v1/analytics/fraud-alerts/:id` | Admin | Mark alert reviewed/dismissed |
| GET | `/api/v1/analytics/printer-logs` | Admin | POS Bridge print log |
| POST | `/api/v1/notifications/daily-fraud-report` | Internal | Trigger EOD fraud WhatsApp report |
| GET | `/api/v1/notifications/manager` | Admin | Manager push notifications |
| POST | `/api/v1/parser/ai-fallback` | Admin | Groq parse raw receipt text → JSON |
| POST | `/api/v1/restaurant/sync-menu` | Internal | POS Bridge → upsert products |

---

## Feedback

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/public/feedback` | Public | Anonymous customer feedback |
| GET | `/api/v1/feedbacks` | Admin | List feedbacks |
| GET | `/api/v1/feedbacks/summary` | Admin | Aggregated sentiment summary |

---

## SuperAdmin (`/api/superadmin`)

All require `x-superadmin-secret` and `x-superadmin-email` headers.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/superadmin/tenants` | List all cafes |
| GET | `/api/superadmin/tenants/rich` | Full cafe detail with billing + stats |
| GET | `/api/superadmin/tenants/:id` | Single cafe |
| PATCH | `/api/superadmin/tenants/:id` | Update cafe (name, status) |
| DELETE | `/api/superadmin/tenants/:id` | Soft-delete cafe |
| POST | `/api/superadmin/tenants/bulk-delete` | Bulk delete |
| POST | `/api/superadmin/tenants/purge-test` | Hard-delete test tenants |
| GET | `/api/superadmin/tenants/:id/invoices` | Invoice history for tenant |
| GET | `/api/superadmin/users/by-email` | Lookup user by email |
| GET | `/api/superadmin/webhooks/expiring-tomorrow` | Cafes whose trial ends tomorrow |
| POST | `/api/superadmin/tenants/:id/suspend` | Suspend cafe |
| POST | `/api/superadmin/tenants/:id/reactivate` | Reactivate suspended cafe |
| POST | `/api/superadmin/payment-request/confirm/:id` | Confirm payment request → generate invoice |
| GET | `/api/superadmin/demo-requests` | List demo lead requests |
| PATCH | `/api/superadmin/demo-requests/:id` | Update demo request status |
| POST | `/api/superadmin/demo-requests/:id/activate` | Activate demo cafe for lead |

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness probe — process alive |
| GET | `/ready` | Public | Readiness probe — process + DB reachable |

---

## WebSocket Events (Socket.io)

Server URL: `NEXT_PUBLIC_SOCKET_URL`  
Clients must emit `join` with `room_<cafeId>` after connecting.

| Event (server → client) | Payload | Description |
|--------------------------|---------|-------------|
| `new_order` | `{ orderId, tableNumber, items }` | New order placed from QR menu |
| `order_status_updated` | `{ orderId, status, activeSessionId? }` | Order status changed |
| `new_reservation` | `{ reservationId, name, guests, time }` | New reservation submitted |
| `reservation_updated` | `{ reservationId, status }` | Reservation status changed |
| `bill_request` | `{ tableNumber, orderId }` | Customer requested bill |
| `waiter_call` | `{ tableNumber, cafeId }` | Customer called waiter |
| `waiter_call_ack` | `{ tableNumber }` | Waiter acknowledged call |
| `zone_token_ready` | `{ activeSessionId, tokenNumber, zoneName }` | Zone order reached READY |
| `table_status_changed` | `{ tableId, status }` | Table status updated |
