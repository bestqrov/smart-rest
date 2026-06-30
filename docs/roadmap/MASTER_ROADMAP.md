# SmartSuite OS — Master Roadmap

> Last updated: 2026-06-30

---

## Phase 1 — Platform Foundation ✅

**Goal:** Build the core restaurant SaaS infrastructure — QR ordering, billing commission model, admin/superadmin frontend, authentication, staff, analytics, operations, and certification engines.

**Status:** Complete

**Included Sprints:**
- Sprint 1.1 — QR Ordering System (menu, cart, session, waiter paging, KDS)
- Sprint 1.2 — Admin & SuperAdmin Frontend Ecosystem
- Sprint 1.3 — Authentication Platform (Google OAuth, magic link, PIN, demo mode)
- Sprint 1.4 — Core Foundation (EventBus, AuditService, NotificationService, FeatureFlagService)
- Sprint 1.5 — Certification Engine (rule packs, auto-scoring, compliance dashboard)
- Sprint 1.6 — Analytics Engine (reporting, trends, AI insights)
- Sprint 1.7 — Operations Center (equipment, maintenance, inventory, requisitions)

---

## Phase 2 — AI Platform ✅

**Goal:** Build the AI automation layer — marketing brain, campaign orchestrator, AI center, and generic AI jobs infrastructure.

**Status:** Complete

**Included Sprints:**
- Sprint 2.1 — Marketing Brain (Phases A–D): E2E automation, campaign orchestrator, production integration
- Sprint 2.2 — AI Center (Phase E): SuperAdmin AI Center dashboard + AI usage tracking
- Sprint 2.3 — AI Jobs Infrastructure (Phase F): Generic AI jobs queue + handlers

---

## Phase 3 — Marketplace V1 ✅

**Goal:** Build the full B2B marketplace — supplier catalog, product engine, order management, restaurant marketplace experience, tenant lifecycle, and WhatsApp re-engagement.

**Status:** Complete

**Included Sprints:**
- Sprint 3.1 — Marketplace Engine Foundation (Epic 1): supplier CRUD, product catalog, category management
- Sprint 3.2 — Marketplace Orders Foundation (Epic 2): order lifecycle, status tracking, commission engine
- Sprint 3.3 — Marketplace Admin Console (Epic 3): SuperAdmin marketplace management
- Sprint 3.4 — Restaurant Marketplace Experience (Epic 4): restaurant-facing catalog, order builder, dashboard widget
- Sprint 3.5 — Payment Engine Foundation (Epic 5): payment config, Moyasar integration scaffolding
- Sprint 3.6 — Tenant Lifecycle Engine (Epic X): plans, lifecycle states, suspension, usage tracking, provisioning
- Sprint 3.7 — V1 Module Completion: equipment pages, invoices, requisitions, reservations, loyalty foundations
- Sprint 3.8 — QR Experience Polish: order restore on refresh, opt-in popup, WhatsApp re-engagement (n8n)

---

## Phase 4 — Billing Platform ⏳

**Goal:** Build the reusable SmartSuite Billing Engine — platform invoices, quota enforcement, tax abstraction, subscription management, and billing events. Usable by every SmartSuite product (Restaurant, Hotel, Clinic, Retail).

**Status:** In Progress — Engine complete, V1 module wiring pending

**Included Sprints:**
- Sprint 4.1 — Billing Engine (Epic K): `src/billing/` — InvoiceService, QuotaService, TaxService, BillingEvents, BillingOrchestrator, 20 API endpoints ✅
- Sprint 4.2 — V1 Module Completion: Reservations live QA, Loyalty wiring, Marketing wiring, Social wiring ⏳

---

## Phase 5 — Payment Platform

**Goal:** Connect the billing engine to real payment providers. Enable tenants to pay subscriptions via Moyasar (Morocco), Stripe (global), or other regional gateways.

**Status:** Not started

**Included Sprints:**
- Sprint 5.1 — Payment Gateway Abstraction: provider interface, Moyasar adapter
- Sprint 5.2 — Subscription Payment Flow: link BillingPlatformInvoice to payment transaction
- Sprint 5.3 — Payment Webhooks: Moyasar/Stripe webhook handlers → auto-mark invoices paid
- Sprint 5.4 — Payment UI: restaurant payment page, invoice download (PDF)

---

## Phase 6 — Fulfillment Platform

**Goal:** Complete the marketplace order fulfillment loop — shipping, delivery tracking, supplier confirmation flows, and inventory auto-deduction.

**Status:** Not started

**Included Sprints:**
- Sprint 6.1 — Supplier Order Confirmation: supplier-facing confirm/reject + notifications
- Sprint 6.2 — Delivery Tracking: shipment status, delivery events, restaurant notification
- Sprint 6.3 — Inventory Auto-Deduction: on marketplace order fulfillment, deduct stock
- Sprint 6.4 — Fulfillment Analytics: fulfillment rate, supplier performance, delivery SLA

---

## Phase 7 — Stabilization

**Goal:** Harden the platform for production — fix all P0/P1 audit findings, performance optimization, security hardening, monitoring, and QA pass.

**Status:** Not started

**Key items from Platform Audit V1 (2026-06-30):**
- Fix staff PIN storage (plain text — must hash)
- Fix 10 missing SuperAdmin pages (stubs)
- Fix AnalyticsAdapter field mismatch
- Full E2E test pass on QA restaurant
- Load testing and performance profiling
- Security audit: JWT, CORS, rate limiting
- Error monitoring (Sentry or equivalent)

---

## Phase 8 — Closed Beta

**Goal:** Onboard 10 real restaurants. Collect feedback, fix production issues, refine UX.

**Status:** Not started

**Entry criteria:**
- Phase 7 Stabilization complete
- Zero P0/P1 open bugs
- All V1 modules working in production
- Payment flow tested end-to-end

---

## Phase 9 — Open Beta

**Goal:** Expand to 50 restaurants. Enable self-serve signup. Launch landing page with live demo.

**Status:** Not started

**Entry criteria:**
- Phase 8 Closed Beta passed with < 3 critical bugs
- Billing + payment fully operational
- Self-serve onboarding flow complete

---

## Phase 10 — Commercial Launch

**Goal:** Version 1.0 public release. Activate paid plans. Marketing campaign.

**Status:** Not started

**Entry criteria:**
- Phase 9 Open Beta passed
- Revenue model validated
- Support runbook written
- SLA commitments defined
