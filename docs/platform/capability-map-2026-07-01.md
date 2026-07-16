# SmartSuite OS — Capability Map
> Date: 2026-07-01 | Source: session review (K2–K12) + docs/platform/platform-audit-v1.md (2026-06-30)

## Legend
✅ COMPLETE — backend + API, in active use
🟡 PARTIAL — backend exists, gaps in API/UI/wiring
🔴 MISSING — no meaningful implementation

## Capability Table

| Area | Status | Notes |
|---|---|---|
| **POS** | ✅ COMPLETE | `routes/pos/*` (orders, checkout, shifts, waiter) live in production. `src/pos/PosOrderService.ts` (K11) adds a formal core-service layer (open/add/update/remove item, discount, close) alongside it — not yet wired into the routes, additive only. |
| **Orders** | 🟡 PARTIAL | `routes/orders.ts` (QR ordering) is production-complete. `src/orders/OrderCoreService.ts` (K11) adds channel-agnostic create/get/update/cancel/complete + order types (dine-in/takeaway/delivery), but delivery has no logistics (address, courier, ETA) — type tag only. Not wired into any route yet. |
| **Kitchen** | 🟡 PARTIAL | `routes/kitchen.ts` (queue, status patch, daily stats) is production-complete for basic KDS. `src/kitchen/KitchenTicketService.ts` (K12) adds a structured ticket workflow (pending→accepted→preparing→ready→served, station assignment) auto-wired via `OrderCreated` event — **no HTTP routes exposing it yet** (API-first per spec, but literally no API surface for kitchen staff to call these transitions). |
| **Inventory** | 🟡 PARTIAL | `InventorySupplier`, `ProductInventory`, `MaintenanceRecord` models + `routes/inventoryAdmin.ts` + marketplace-side inventory (`marketplaceInventorySA.ts`) + `services/inventoryDeduction.ts` (auto-deduct on order completion). Per prior audit: 80% complete, purchase-order flow and low-stock alerting depth unverified this session. |
| **Reservations** | ✅ COMPLETE | `Reservation` model + `routes/reservations.ts`. Per memory: in live QA as of last check. |
| **CRM** | 🟡 PARTIAL | No dedicated CRM model — `CafeCustomer` (WhatsApp opt-in/visit tracking) + `routes/customers.ts` + `LoyaltyAccount`/`routes/loyalty.ts` cover basic customer identity and points, but no unified customer profile, segmentation, or lifetime-value view. |
| **Marketing** | 🟡 PARTIAL | `MarketingCampaign` model + `routes/marketing.ts` + separate `marketing-brain/` engine (video campaign generation, own Mongoose DB). Per prior audit: 85%, but gated behind `comingSoon` feature flag and uses a second DB connection with no shutdown coordination. |
| **Reviews** | 🟡 PARTIAL | `ReviewGallery` model + `routes/reviewGallery.ts` + `routes/reviews.ts`. Per prior audit: 70%, "Social / Review Gallery." |
| **AI** | 🟡 PARTIAL | `AIJob`/`AIJobLog`/`AIProviderSettings`/`RecommendationLog` models + `routes/aiCenter.ts`, `aiJobs.ts`, `marketplaceAISA.ts`. Per prior audit: 80%, gated behind `comingSoon` flag; menu-generation route bypasses the unified AI job queue (uses Groq SDK directly). |
| **Billing (Platform)** | ✅ COMPLETE | Built this session (K2–K10): plans, subscriptions, invoices, payments delegation, revenue metrics, lifecycle automation (trial/grace/renewal), settings (runtime-configurable), full audit trail, usage-limit enforcement. Distinct from the older legacy cafe-level wallet/commission billing (`services/billing.ts`, 85% per prior audit) — two billing systems now coexist and are not unified. |

## Cross-Cutting Observations
- **Two billing systems**: legacy cafe wallet/commission billing (pre-existing) vs. new platform subscription billing (K2–K10). Not yet reconciled — worth flagging, not fixing now.
- **Kitchen has zero HTTP surface for K12's ticket workflow.** It's genuinely "API-first" only in the sense of being service-layer code; no Express routes call it yet.
- **Order Core (K11) and POS Core (K11) are unwired**: neither has replaced the routes that predate them. They exist as parallel, ready-to-adopt service layers.
- Marketing Brain's separate Mongoose connection and the AI Center's `comingSoon` gating are pre-existing issues, unrelated to this session's work.

## Recommended Next Sprint: K14 — Kitchen Ticket API

**Why this over other candidates:** Every other MISSING/PARTIAL gap (CRM unification, delivery logistics, two-billing-system reconciliation, marketing-brain DB consolidation) is either a larger cross-cutting redesign or a UI/flag-flip problem outside backend scope. The kitchen ticket workflow is the one place where a **complete, tested backend service (K12) has literally no way to be called** — it's the smallest, highest-leverage gap: expose `KitchenTicketService` (accept/preparing/ready/served/station-assign) as SuperAdmin + cafe-staff REST endpoints, mirroring the existing `routes/kitchen.ts` auth pattern. This unlocks the K12 investment immediately without touching any other module.
