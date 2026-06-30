# SmartSuite OS — Changelog

Chronological record of completed sprints and major deliverables.

---

## 2026-06-30

### Billing Platform Engine (Sprint 4.1 — Epic K) ✅
- Built `src/billing/` — 14 services: InvoiceService (BIL-YYYY-NNNNN), QuotaService, TaxService (VAT + SalesTax), BillingEvents (7 event types), BillingNotifications, PlanCatalogService, SubscriptionService, BillingOrchestrator
- Added `BillingPlatformInvoice` and `BillingEventLog` Prisma models (tenant-scoped, reusable across all products)
- Extended PlatformEventName with 7 billing events
- 20 new API endpoints: 15 SuperAdmin + 5 Restaurant
- Architecture doc: `docs/architecture/billing-platform.md`

### Platform Audit V1 (Epic QA-1) ✅
- Complete audit of all 18 SmartSuite OS modules
- Platform score: 67/100
- P0/P1 issues documented in `docs/platform/platform-audit-v1.md`
- Key findings: staff PINs plain text, 10 missing SuperAdmin pages, AnalyticsAdapter field mismatch

### Restaurant Marketplace Fixes + Dashboard Widget (Epic 4 Bug Sprint) ✅
- Fixed PUBLISHED→ACTIVE status bug in catalog routes (5 occurrences)
- Removed dead compatibility endpoint fetch from product detail page
- Fixed wrong query param (`?q=` → `?search=`) in order builder
- Added marketplace i18n key to all 4 languages
- Added Marketplace dashboard widget to admin dashboard (pending orders, recent purchases)

---

## 2026-06-26

### QR Experience — Order Restore + UI Polish ✅
- New endpoint: `GET /api/orders/session/:sessionId/active` — restores active order on page refresh
- QR page UI redesign: cafe hero section, product cards, copyright strips
- WhatsApp Re-engagement System: `CafeCustomer` model, opt-in popup, n8n inactive customer endpoint

---

## 2026-06-25 — 2026-06-26

### V1 Module Work ✅
- Equipment maintenance page (full i18n, colored icons)
- Invoices admin page
- Requisitions admin page
- Reservations admin page (pending live QA)
- Payment config phase 1 (Moyasar settings UI)
- Premium pricing admin (per-country plan pricing)
- Landing theme switcher

---

## 2026-06 (mid)

### Tenant Lifecycle Engine (Epic X) ✅
- `src/tenant/`: LifecycleService, SuspensionService, ProvisioningService, FeatureResolutionService, UsageService
- Plans: FREE, STARTER, PROFESSIONAL, ENTERPRISE, CUSTOM with full limits + features
- TenantProfile + TenantUsageSnapshot Prisma models
- SuperAdmin tenant management APIs

### Marketplace V1 (Epics 1–5) ✅
- Epic 1: Marketplace Engine — supplier CRUD, product catalog, categories, bundles, featured products
- Epic 2: Marketplace Orders — full order lifecycle, commission engine, WalletLog
- Epic 3: Marketplace Admin Console — SuperAdmin supplier/product/order management
- Epic 4: Restaurant Marketplace Experience — catalog UI, product detail, order builder, history
- Epic 5: Payment Engine Foundation — Moyasar integration scaffolding, payment config

---

## 2026-06 (early)

### SuperAdmin Dashboard + Management ✅
- Phase G: Enterprise sidebar layout + unified SuperAdmin dashboard
- SuperAdmin plans: themes, analytics, management, leads

---

## 2026-05 — 2026-06

### Core Platform Engines ✅
- Phase H0: Core Foundation (EventBus, AuditService, NotificationService, FeatureFlagService, FileService)
- Phase H1/H2: Certification Engine — rule packs, auto-scoring, compliance dashboard
- Phase I: Analytics Engine — reporting, trends, AI insights, export
- Phase J: Operations Center — equipment, maintenance tracking, inventory management, requisitions

---

## 2026-04 — 2026-05

### AI Platform ✅
- Phase E: AI Center — SuperAdmin AI Center dashboard
- Phase F: AI Jobs Infrastructure — generic AI jobs queue + handlers
- Phase A–D: Marketing Brain — E2E automation, campaign orchestrator, production integration, Soft Launch

---

## 2025–2026 (Foundation)

### Platform Foundation ✅
- First commit + project setup
- MongoDB Atlas migration (from PostgreSQL/Supabase)
- QR Ordering System: menu, cart, session, waiter paging, KDS pipeline
- Hybrid seat QR + table merging
- Admin & SuperAdmin Frontend Ecosystem
- Authentication: Google OAuth, magic link, PIN shift login, demo mode
- Language picker, RTL support
- Moroccan landing page + signup flow
- Staff management, attendance, control monitor
- Demo accounts (Morocco)
