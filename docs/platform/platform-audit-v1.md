# SmartSuite OS — Platform Audit v1
> Date: 2026-06-30 | Auditor: Claude AI | Status: Pre-Beta

---

## Executive Summary

SmartSuite OS is a feature-rich multi-tenant restaurant SaaS with a strong backend architecture. The core restaurant operations layer (QR ordering, POS, kitchen KDS, billing, reservations, loyalty) is functionally complete and production-ready at ~80–90%. The newer engines — Marketplace, Tenant Lifecycle, Analytics, Certification, and AI Center — have solid backends but are gated behind `comingSoon` feature flags and lack several frontend management pages in the superadmin. Ten superadmin navigation items link to pages that do not exist as files (`/superadmin/analytics`, `/superadmin/billing`, `/superadmin/demo`, `/superadmin/automation`, `/superadmin/users`, `/superadmin/activity`, `/superadmin/settings`, `/superadmin/danger-zone`, `/superadmin/client-map`, `/superadmin/marketing`), making the superadmin panel incomplete. One notable security concern exists: Staff PINs are stored both hashed (`pinCode`) and in plain text (`pinDisplay`) in MongoDB for admin-facing display purposes. The overall platform is close to a V1 launch for the core restaurant module; the full SmartSuite OS vision requires significant frontend work before it is production-ready end-to-end.

---

## Module Completion Table

| Module | Completion % | Production Readiness % | Status |
|--------|-------------|----------------------|--------|
| Core Foundation (EventBus, Audit, Notifications, Files, Feature Flags) | 90% | 85% | ✅ |
| Authentication (JWT + magic link + refresh tokens) | 95% | 90% | ✅ |
| Restaurant Admin (menu, tables, staff, zones, orders) | 90% | 85% | ✅ |
| POS (Mini POS, cashier shifts, waiter, checkout, seat checkout) | 85% | 80% | ✅ |
| Kitchen KDS | 90% | 85% | ✅ |
| Billing / Finance (commission, wallet, tiers, payment requests) | 85% | 80% | ✅ |
| Marketing Brain (video campaign generation, AI orchestration) | 85% | 75% | ⚠️ |
| Social / Review Gallery | 70% | 65% | ⚠️ |
| Certification Engine | 80% | 75% | ⚠️ |
| Analytics Engine | 70% | 60% | ⚠️ |
| Operations Layer (health, logs, backup, diagnostics, security, runtime) | 80% | 75% | ⚠️ |
| Marketplace Engine (catalog, orders, bundles, AI recommendations) | 75% | 65% | ⚠️ |
| AI Center (provider management, AI jobs queue) | 80% | 75% | ⚠️ |
| Tenant Lifecycle Engine | 75% | 70% | ⚠️ |
| Loyalty Program | 85% | 80% | ✅ |
| Reservations | 85% | 80% | ✅ |
| Inventory (stock, suppliers, purchase orders) | 80% | 75% | ⚠️ |
| Equipment & Maintenance | 80% | 75% | ⚠️ |
| Supplier Invoices / Requisitions | 75% | 70% | ⚠️ |
| SmartTraiteur (events, guests) | 70% | 60% | ⚠️ |
| Menu Generation (AI scraping + Groq) | 80% | 70% | ⚠️ |
| WhatsApp Integration (webhook, re-engagement, opt-in) | 80% | 70% | ⚠️ |
| Anti-Fraud / Printer Spy | 75% | 65% | ⚠️ |
| SuperAdmin Panel | 55% | 45% | ❌ |
| Payment Engine (Stripe, Moyasar, Mobile Money) | 80% | 75% | ⚠️ |
| Demo Request Pipeline | 50% | 40% | ❌ |

---

## Production Score
**Overall: 67/100**

The core restaurant loop (QR scan → order → KDS → POS → billing) scores high (~85/100). The score is dragged down by the incomplete superadmin panel (10 missing pages out of 20 nav items), plain-text PIN storage, marketplace and analytics engines gated behind `comingSoon` flags, and several frontend-only nav items without backing pages. The infrastructure quality (security headers, CORS, rate limiting, graceful shutdown, structured logging, error handling) is excellent and would score 90/100 on its own.

---

## Critical Issues (P0)

- [ ] **Issue:** Staff PIN stored in plain text in `pinDisplay` column. **File:** `src/routes/menuAdmin.ts:415,617`, `prisma/schema.prisma:Staff.pinDisplay`. **Impact:** If the MongoDB database is exfiltrated, all staff PINs are exposed in cleartext. This contradicts the bcrypt-hashed `pinCode` field. The plain-text field was added for admin "show/hide PIN" UX but creates a serious security gap.

- [ ] **Issue:** 10 superadmin navigation links point to pages that do not exist. **File:** `app/superadmin/layout.tsx:37,73–76 + more`. **Impact:** Clicking `/superadmin/analytics`, `/superadmin/billing`, `/superadmin/demo`, `/superadmin/automation`, `/superadmin/users`, `/superadmin/activity`, `/superadmin/settings`, `/superadmin/danger-zone`, `/superadmin/client-map`, `/superadmin/marketing` will render a Next.js 404. Superadmin cannot manage billing, demo requests, or user accounts from the UI.

- [ ] **Issue:** Demo Request pipeline (`DemoRequest` model + `src/routes/demoRequests.ts`) has a backend but no superadmin UI page exists at `/superadmin/demo`. **File:** `app/superadmin/layout.tsx:28`. **Impact:** Superadmin cannot review or activate demo trial requests via the UI, breaking the customer acquisition funnel.

---

## High Issues (P1)

- [ ] **Issue:** `Analytics` and `Marketplace` feature flags default to `comingSoon` status in `FeatureFlagService`. **File:** `src/core/feature-flags/FeatureFlagService.ts:17–18`. **Impact:** Even though backends are implemented, the feature flags gate prevents real usage. Superadmin has no UI to flip flags to `enabled` (settings page is missing).

- [ ] **Issue:** SuperAdmin authentication uses plain headers (`x-superadmin-secret` + `x-superadmin-email`) instead of session tokens or JWT. **File:** `src/routes/superadmin.ts:requireSuperAdmin`, `src/routes/opsSystem.ts:requireSuperAdmin` (duplicated across 10+ route files). **Impact:** Credentials are re-sent on every request; no session revocation mechanism; the header-based auth pattern is duplicated in 10+ route files with slight variations (some check email, some don't).

- [ ] **Issue:** `authorizeAdmin` middleware does not verify that the JWT user still exists in the database. A deleted user's token remains valid until expiry. **File:** `src/middleware/authorizeAdmin.ts:27–44`. **Impact:** Deleted restaurant owners retain API access for up to 30 minutes.

- [ ] **Issue:** `AnalyticsAdapter` in the Integration layer queries a `MetricSnapshot` field `type` and `cafeId` that do not match the actual Prisma schema for `MetricSnapshot` (`metricId`, `period`, `tenantId`). **File:** `src/integration/adapters/AnalyticsAdapter.ts:35–55`. **Impact:** Activity feed for Analytics module will always return empty or throw runtime errors.

- [ ] **Issue:** `Marketing Brain` uses Mongoose with a separate database (`marketing_brain`), while all other modules use Prisma + MongoDB. No connection-pooling or shutdown coordination for the Mongoose client. **File:** `src/marketing-brain/connection.ts`. **Impact:** Under heavy load or graceful shutdown, Mongoose connections may not be properly closed, leading to connection leaks.

- [ ] **Issue:** Email whitelist in `src/routes/auth.ts` only permits `gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.fr, hotmail.fr, live.com, icloud.com`. Business emails (e.g., `chef@myrestaurant.ma`) are rejected at signup. **File:** `src/routes/auth.ts:16`. **Impact:** Legitimate restaurant owners using business email domains cannot register.

---

## Medium Issues (P2)

- [ ] **Issue:** `pinDisplay` is returned in the staff list API response (select includes `pinDisplay: true`). **File:** `src/routes/menuAdmin.ts:350`. **Impact:** Plain-text PINs are transmitted over the network to the browser on every staff list load.

- [ ] **Issue:** `validatePin` in `src/routes/pos/shift.ts` fetches ALL active staff for a cafe and runs bcrypt.compare in a loop. For a cafe with 50 staff, this runs 50 bcrypt comparisons per login attempt. **File:** `src/routes/pos/shift.ts:validatePin`. **Impact:** CPU-intensive login; combined with no rate limiting on `/api/pos/shift`, allows low-cost brute-force of PINs.

- [ ] **Issue:** `src/routes/orders.ts` does not rate-limit QR order submission. A customer could flood the cafe's order queue. **File:** `src/routes/orders.ts`. **Impact:** Order spam / DoS on kitchen KDS.

- [ ] **Issue:** `Cafe.deleteCascade` in `src/routes/superadmin.ts` is a sequential, non-transactional delete across 30+ collections. If any step fails mid-delete, the database is left in a partially deleted state. **File:** `src/routes/superadmin.ts:deleteCafeCascade`. **Impact:** Data corruption risk on cafe deletion.

- [ ] **Issue:** `AnalyticsAdapter` uses `prisma as any` cast to query `metricSnapshot`. **File:** `src/integration/adapters/AnalyticsAdapter.ts`. **Impact:** Type safety lost; typos will cause silent runtime failures rather than compile errors.

- [ ] **Issue:** `Cafe.subscriptionTier` and `Cafe.monthlyFee` are marked `DEPRECATED` in schema comments but still present in `Cafe` model, returned in API responses, and referenced in `finance.ts`. **File:** `prisma/schema.prisma:256–258`, `src/routes/finance.ts`. **Impact:** Frontend may display misleading deprecated billing data.

- [ ] **Issue:** `src/routes/menuGeneration.ts` uses the Groq SDK directly (not via the AI Center / Marketing Brain provider system). **File:** `src/routes/menuGeneration.ts:getGroq()`. **Impact:** Menu generation AI calls bypass the unified AI job queue, provider fallback chain, and cost tracking in AI Center.

- [ ] **Issue:** `SUPERADMIN_SECRET` is a static environment variable with no rotation mechanism. Superadmin routes do not log access attempts for audit purposes. **File:** All `requireSuperAdmin` functions. **Impact:** If the secret leaks, there is no detection mechanism and no way to invalidate active sessions.

- [ ] **Issue:** The `opsBackup.ts` backup route likely creates logical backups (data exports) rather than true MongoDB binary snapshots. No S3/remote storage integration visible. **File:** `src/routes/opsBackup.ts`. **Impact:** Backups may be stored locally on the server and lost if the server disk fails.

- [ ] **Issue:** `src/routes/customers.ts` (WhatsApp opt-in) has no authentication — only validates `tableToken`. A malicious actor who knows any table token can register arbitrary phone numbers to a cafe's re-engagement list. **File:** `src/routes/customers.ts`. **Impact:** Phone number spam injection into re-engagement campaigns.

- [ ] **Issue:** `RefreshToken` table has no cleanup cron job. Expired tokens accumulate indefinitely. **File:** `prisma/schema.prisma:RefreshToken`, no cleanup in `src/cron/`. **Impact:** MongoDB collection grows unboundedly; potential performance degradation.

---

## Minor Issues (P3)

- [ ] **Issue:** `console.log` and `console.error` used in `src/server.ts` alongside the structured `logger`. **File:** `src/server.ts:112,121,347,398`. **Impact:** Inconsistent log formatting; these messages bypass the pino JSON logger in production.

- [ ] **Issue:** `src/marketing-brain/seed/index.ts` uses `console.log` for all seed output. **File:** `src/marketing-brain/seed/index.ts:119–352`. **Impact:** Seed output not captured by structured logger.

- [ ] **Issue:** `as unknown as` cast used in `src/routes/payment.ts:187` and `src/routes/whatsappWebhook.ts:153` to pass Prisma client as `TransactionClient`. **File:** Both files. **Impact:** Possible type mismatch if Prisma client interface changes; indicates a workaround for a transaction API design issue.

- [ ] **Issue:** `src/routes/adminStats.ts:94` uses `as unknown as string` cast on `o.totalPrice`. **File:** `src/routes/adminStats.ts:94`. **Impact:** Brittle revenue calculation; if `totalPrice` is already a number, the `toString()` path works but the cast is misleading.

- [ ] **Issue:** `src/marketing-brain/CampaignOrchestratorService.ts` uses `as unknown as ICampaignExecution[]` for Mongoose `insertMany` result. **File:** `src/marketing-brain/CampaignOrchestratorService.ts:133`. **Impact:** Type safety gap in campaign orchestration.

- [ ] **Issue:** Architecture docs `10-future-architecture.md` still lists Certification Engine, Analytics, and Marketplace as "placeholders". The `docs/architecture/` has been updated with individual engine docs, but the README index still references the old structure. **File:** `docs/architecture/README.md`. **Impact:** Outdated documentation could mislead new contributors.

- [ ] **Issue:** `docs/architecture/10-future-architecture.md` — file name suggests future state but the engines it describes are now implemented. **Impact:** Confusing naming for new developers.

---

## Module Detail Reports

### Core Foundation
- **Completion:** 90%
- **Production Readiness:** 85%
- **Known Issues:** None critical
- **Missing APIs:** No HTTP endpoints for notifications (CoreNotification) exposed to admins; notifications are internal only
- **Missing UI:** No superadmin UI to browse audit log entries or platform notifications
- **Missing Documentation:** None; `docs/architecture/core-foundation.md` exists
- **Technical Debt:** `prisma as any` cast used in NotificationService for `coreNotification` — Prisma model is named `CoreNotification` but TypeScript types may not recognize it without regenerating client
- **Security Concerns:** None critical
- **Performance Concerns:** EventBus is fully in-memory; if server restarts, all subscriptions re-register only after module init — race condition possible during cold starts
- **Future Improvements:** Persistent event store for replay; notification delivery to restaurant owner emails
- **Critical Blockers:** None

### Authentication
- **Completion:** 95%
- **Production Readiness:** 90%
- **Known Issues:** Business email whitelist blocks non-consumer domains (`src/routes/auth.ts:16`)
- **Missing APIs:** No endpoint to list or revoke active refresh tokens (useful for session management)
- **Missing UI:** No "active sessions" view for restaurant admins
- **Missing Documentation:** `docs/architecture/05-authentication-flow.md` exists
- **Technical Debt:** `jwt.sign` uses `as any` for options object at `src/routes/auth.ts`
- **Security Concerns:** `authorizeAdmin` does not DB-validate token on every call (relies on expiry only); deleted users stay valid 30 min
- **Performance Concerns:** None
- **Future Improvements:** Session management UI; email domain whitelist expansion or removal
- **Critical Blockers:** Email whitelist is a business-blocking issue for restaurant owners with custom domains

### Restaurant Admin
- **Completion:** 90%
- **Production Readiness:** 85%
- **Known Issues:** `pinDisplay` plain-text PIN stored and returned in staff API
- **Missing APIs:** Bulk product import/export endpoint (partial — `menu-gen` covers import only)
- **Missing UI:** No admin page for managing `AdminWaitersPerf` data (route exists, no dedicated page); `app/admin/control/` and `app/admin/attendance/` exist as pages
- **Missing Documentation:** None critical
- **Technical Debt:** `menuAdmin.ts` is a very large file (~700+ lines) covering categories, products, staff, onboarding, and branding — should be split
- **Security Concerns:** Plain-text PIN (`pinDisplay`) transmitted to browser; no PIN complexity enforcement
- **Performance Concerns:** `adminStats` fetches all 30-day orders into memory for peak-hour calculation (`src/routes/adminStats.ts:~90`) — should use MongoDB aggregation
- **Future Improvements:** Aggregation pipeline for peak hours; PIN display via encrypted retrieval only
- **Critical Blockers:** Plain-text PIN (P0 security)

### POS (Mini POS)
- **Completion:** 85%
- **Production Readiness:** 80%
- **Known Issues:** `validatePin` in shift login iterates all staff with bcrypt (N comparisons per login)
- **Missing APIs:** None critical
- **Missing UI:** POS has a single `app/pos/page.tsx` — fully functional
- **Missing Documentation:** None
- **Technical Debt:** PIN validation loop (`src/routes/pos/shift.ts:validatePin`) — O(N) bcrypt calls per attempt
- **Security Concerns:** No rate limiting on `/api/pos/shift` despite PIN brute-force risk
- **Performance Concerns:** bcrypt loop on PIN validation
- **Future Improvements:** Index staff by pinCode hash; add per-IP rate limit on POS shift endpoint
- **Critical Blockers:** None (functional but brute-force risk)

### Kitchen KDS
- **Completion:** 90%
- **Production Readiness:** 85%
- **Known Issues:** None
- **Missing APIs:** None
- **Missing UI:** `app/kitchen/page.tsx` exists and is functional
- **Missing Documentation:** None
- **Technical Debt:** None
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Multi-station KDS (prep vs expo); order bump screen
- **Critical Blockers:** None

### Billing / Finance
- **Completion:** 85%
- **Production Readiness:** 80%
- **Known Issues:** `Cafe.monthlyFee` and `Cafe.subscriptionTier` deprecated but still active in responses
- **Missing APIs:** No admin endpoint to view billing history / invoices list directly (separate `BillingInvoice` model exists but no dedicated admin UI)
- **Missing UI:** `app/admin/billing/page.tsx` exists; no invoice list page for admins
- **Missing Documentation:** `docs/architecture/04-billing-lifecycle.md` exists
- **Technical Debt:** Deprecated fields still present in schema and API responses
- **Security Concerns:** `PaymentRequest` creation (admin submits payment proof) has no server-side validation of reference format
- **Performance Concerns:** None
- **Future Improvements:** Invoice download (PDF); automated reconciliation
- **Critical Blockers:** None

### Marketing Brain
- **Completion:** 85%
- **Production Readiness:** 75%
- **Known Issues:** Uses separate Mongoose connection for `marketing_brain` DB; `console.log` in seed
- **Missing APIs:** No endpoint to list/manage CampaignExecutions; no UI for campaign history beyond `MarketingCampaign`
- **Missing UI:** `app/admin/marketing/page.tsx` exists; `app/admin/social/page.tsx` exists
- **Missing Documentation:** `docs/architecture/03-marketing-pipeline.md` exists
- **Technical Debt:** Mongoose + Prisma dual-ORM pattern adds complexity; `as unknown as` casts in CampaignOrchestratorService
- **Security Concerns:** `fbAccessToken` and `tiktokAccessToken` stored as plain text on `Cafe` model — should be encrypted at rest
- **Performance Concerns:** None
- **Future Improvements:** Encrypt social tokens at rest; unify under Prisma
- **Critical Blockers:** None

### Social / Review Gallery
- **Completion:** 70%
- **Production Readiness:** 65%
- **Known Issues:** Review gallery backend exists; moderation flow depends entirely on n8n
- **Missing APIs:** No admin endpoint to approve/reject `ReviewGallery` items from the admin panel directly (only via n8n)
- **Missing UI:** `app/admin/social/page.tsx` covers social media connection; no gallery moderation page
- **Missing Documentation:** `docs/ui/restaurant-marketplace.md` exists but no social gallery UI doc
- **Technical Debt:** Tight coupling to n8n for moderation and publication
- **Security Concerns:** `userConsentGranted` sent as plain boolean in n8n webhook — no signature verification on `requireInternal` calls
- **Performance Concerns:** None
- **Future Improvements:** In-app moderation queue; direct admin gallery view
- **Critical Blockers:** None

### Certification Engine
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** Feature flag is `comingSoon` — not yet enabled by default
- **Missing APIs:** None — full REST API at `/api/admin/certification` and `/api/superadmin/certification`
- **Missing UI:** `app/admin/certification/page.tsx` exists; `app/superadmin/certification/page.tsx` exists
- **Missing Documentation:** `docs/architecture/certification-engine.md` + `docs/ui/certification-dashboard.md` exist
- **Technical Debt:** Sequential DB fetches in `superadminCertification.ts` for cafes list (N+1 pattern — fetches latest cert result per cafe in a loop)
- **Security Concerns:** None
- **Performance Concerns:** N+1 query in superadmin certification list for large tenant counts
- **Future Improvements:** Batch cert result fetch using `IN` query; enable flag in production
- **Critical Blockers:** Feature flag defaults to `comingSoon`

### Analytics Engine
- **Completion:** 70%
- **Production Readiness:** 60%
- **Known Issues:** `AnalyticsAdapter` queries `MetricSnapshot` with fields (`type`, `cafeId`) that don't match the actual schema (`metricId`, `period`, `tenantId`). Feature flag is `comingSoon`.
- **Missing APIs:** No public REST API endpoints for analytics exposed (analytics engine is internal-only)
- **Missing UI:** No superadmin analytics page (`/superadmin/analytics` is missing)
- **Missing Documentation:** `docs/architecture/analytics-engine.md` exists
- **Technical Debt:** Mismatch between AnalyticsAdapter query fields and MetricSnapshot schema
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Expose analytics via REST API; build superadmin analytics dashboard page
- **Critical Blockers:** AnalyticsAdapter will throw at runtime (schema field mismatch); missing page

### Operations Layer
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** Backup route likely creates local-disk backups only — no remote storage
- **Missing APIs:** None — `/api/superadmin/system/health`, `/api/superadmin/ops/logs`, `/api/superadmin/ops/backups`, `/api/superadmin/runtime`, `/api/superadmin/security` all exist
- **Missing UI:** `app/superadmin/ops/` directory has all sub-pages (health, logs, backups, diagnostics, runtime, security, main)
- **Missing Documentation:** `docs/architecture/operations-layer.md` exists
- **Technical Debt:** `requireSuperAdmin` function duplicated in every ops route file (not imported from shared middleware)
- **Security Concerns:** Backup storage is local — disaster recovery risk
- **Performance Concerns:** None
- **Future Improvements:** S3 backup upload; centralized `requireSuperAdmin` middleware
- **Critical Blockers:** None

### Marketplace Engine
- **Completion:** 75%
- **Production Readiness:** 65%
- **Known Issues:** Feature flag defaults to `comingSoon`; marketplace engine seeded but not enabled
- **Missing APIs:** None — full catalog, orders, bundles, suppliers, inventory, AI recommendations API exists
- **Missing UI:** `app/admin/marketplace/` has all sub-pages; `app/superadmin/marketplace/` has all sub-pages
- **Missing Documentation:** `docs/architecture/marketplace-engine.md`, `marketplace-orders.md`, `marketplace-ai.md` all exist; `docs/ui/marketplace-admin.md` and `restaurant-marketplace.md` exist
- **Technical Debt:** `MarketplaceOrder.tenantId` is a plain `String`, not a DB-level `@db.ObjectId` reference — no Prisma relation to `Cafe`. This means referential integrity is enforced only at the application layer.
- **Security Concerns:** `authRestaurant` in `marketplaceCatalogRestaurant.ts` is a local function, not the shared `authorizeAdmin` middleware
- **Performance Concerns:** None
- **Future Improvements:** Add Prisma relation for `tenantId` → `Cafe`; enable feature flag for beta restaurants
- **Critical Blockers:** Feature flag is `comingSoon`

### AI Center
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** Claude model listed as `claude-opus-4-5` in provider metadata (non-standard model ID format)
- **Missing APIs:** None — full provider management, test, fallback chain, analytics, health APIs exist
- **Missing UI:** `app/superadmin/ai-center/page.tsx` exists
- **Missing Documentation:** None
- **Technical Debt:** `aiCenter.ts` has static `PROVIDER_META` object with hardcoded model names and pricing — will drift from actual SDK versions
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Pull model metadata from provider SDKs rather than hardcoding; add per-provider budget limits
- **Critical Blockers:** None

### Tenant Lifecycle Engine
- **Completion:** 75%
- **Production Readiness:** 70%
- **Known Issues:** `TenantProfile` and `Cafe` have overlapping lifecycle state — `Cafe.billingStatus`, `Cafe.trialEndsAt` duplicate fields in `TenantProfile`. No sync mechanism between the two.
- **Missing APIs:** Full SA API at `/api/superadmin/tenants`; restaurant self-service at `/api/restaurant/tenant/`
- **Missing UI:** No dedicated superadmin tenant management page (uses restaurants page instead)
- **Missing Documentation:** `docs/architecture/tenant-lifecycle.md` exists
- **Technical Debt:** Dual lifecycle state (Cafe + TenantProfile) with no guaranteed sync
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Unify lifecycle state into `TenantProfile` only; deprecate `Cafe.billingStatus`
- **Critical Blockers:** Sync mismatch between Cafe and TenantProfile could cause inconsistent billing/suspension decisions

### Loyalty Program
- **Completion:** 85%
- **Production Readiness:** 80%
- **Known Issues:** No automatic loyalty point earning on order completion — must be triggered externally (n8n or manually)
- **Missing APIs:** No public endpoint for customers to check their own points via QR flow
- **Missing UI:** `app/admin/loyalty/page.tsx` exists
- **Missing Documentation:** None
- **Technical Debt:** Points earning is not wired to `Order.status = COMPLETED` event in the codebase
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Wire loyalty point earning to order completion event in EventBus; add customer-facing points display in QR menu
- **Critical Blockers:** None

### Reservations
- **Completion:** 85%
- **Production Readiness:** 80%
- **Known Issues:** None critical
- **Missing APIs:** No endpoint for customers to cancel their own reservations; no availability check (overbooking possible)
- **Missing UI:** `app/admin/reservations/page.tsx` exists; reservation form in QR menu
- **Missing Documentation:** None
- **Technical Debt:** No table capacity check against concurrent reservations for the same time slot
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Availability engine (slot-based); customer cancellation link via SMS/WhatsApp
- **Critical Blockers:** None

### Inventory
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** `isSmartInventoryEnabled` flag required; gated behind superadmin approval
- **Missing APIs:** None — full stock, suppliers, purchase orders API exists
- **Missing UI:** `app/admin/inventory/` with stock, suppliers, purchase-orders sub-pages all exist
- **Missing Documentation:** `docs/n8n-inventory-workflow.json` exists
- **Technical Debt:** `deductInventoryForOrder` in `src/services/inventoryDeduction.ts` — not verified if this is actually called on every order or only wired in certain paths
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Auto-trigger deduction on all order completion paths; low-stock alert via push notification
- **Critical Blockers:** None

### Equipment & Maintenance
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** None
- **Missing APIs:** Full CRUD via `src/routes/equipment.ts`
- **Missing UI:** `app/admin/equipment/page.tsx` exists
- **Missing Documentation:** None
- **Technical Debt:** None
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Warranty expiry push notifications; scheduled maintenance reminders
- **Critical Blockers:** None

### SmartTraiteur
- **Completion:** 70%
- **Production Readiness:** 60%
- **Known Issues:** No commission calculation integration with billing engine
- **Missing APIs:** Events + guests CRUD via `src/routes/traiteur.ts`; but no webhook for n8n post-event review pipeline
- **Missing UI:** `app/admin/traiteur/` with events list + new event + event detail pages
- **Missing Documentation:** None
- **Technical Debt:** `Event.commissionAmount` is not auto-calculated based on billing tiers
- **Security Concerns:** None
- **Performance Concerns:** None
- **Future Improvements:** Wire event completion to commission billing; guest QR check-in flow
- **Critical Blockers:** None

### SuperAdmin Panel
- **Completion:** 55%
- **Production Readiness:** 45%
- **Known Issues:** 10 navigation items link to missing pages
- **Missing Pages:** `/superadmin/analytics`, `/superadmin/client-map`, `/superadmin/automation`, `/superadmin/users`, `/superadmin/activity`, `/superadmin/settings`, `/superadmin/danger-zone`, `/superadmin/demo`, `/superadmin/billing`, `/superadmin/marketing`
- **Existing Pages:** `page.tsx` (dashboard), `restaurants/page.tsx`, `ai-center/page.tsx`, `certification/page.tsx`, `marketplace/` (6 sub-pages), `ops/` (7 sub-pages), `landing/page.tsx`
- **Missing Documentation:** None critical
- **Technical Debt:** `requireSuperAdmin` is copy-pasted in 10+ route files instead of being a shared middleware
- **Security Concerns:** Static secret-based auth with no session management; no rate limiting on superadmin routes
- **Performance Concerns:** None
- **Future Improvements:** Build all missing pages; centralize auth middleware; add superadmin session tokens
- **Critical Blockers:** 10 missing pages make the superadmin panel not production-ready

### Payment Engine (Gulf + Africa + Marketplace)
- **Completion:** 80%
- **Production Readiness:** 75%
- **Known Issues:** None critical
- **Missing APIs:** None — Stripe, Moyasar, Mobile Money, and manual payment transaction APIs all exist
- **Missing UI:** `app/admin/billing/page.tsx` has payment request submission; no transaction history page for admins
- **Missing Documentation:** `docs/architecture/payment-engine.md` exists
- **Technical Debt:** Stripe SDK imported via `require()` with `eslint-disable` comments (`src/routes/payment.ts:24–26`) due to ESM/CJS mismatch — should be resolved
- **Security Concerns:** Stripe webhook correctly validates raw body + HMAC; Moyasar webhook also HMAC-verified — good
- **Performance Concerns:** None
- **Future Improvements:** Admin transaction history page; refund UI
- **Critical Blockers:** None

---

## Cross-Cutting Concerns

### Translations (AR/EN/FR/ES)
The `lib/adminI18n.ts` (666 lines) covers AR/EN/FR/ES for all major admin navigation items and common UI strings including: dashboard, menu, tables, zones, staff, financials, margins, equipment, invoices, requisitions, reservations, loyalty, certification, marketing, social, marketplace, billing, settings. Coverage is solid for the 4 core languages. German (`nameDe`) exists only on `Category` and `Product` models (schema level) but has no i18n strings in `adminI18n.ts`. The superadmin panel uses English-only hardcoded strings (`app/superadmin/layout.tsx` — no i18n system). The QR menu (customer-facing) has separate i18n via `src/lib/i18n.ts` covering AR/EN/FR/ES/DE for order flow strings.

### RTL Support
RTL is supported via `dir="rtl"` toggled by language in `app/admin/layout.tsx` and the QR menu. The admin panel checks `lang === 'ar'` and applies RTL layout. Email templates also apply RTL via `isRTL(lang)` in `src/services/email.ts`. The superadmin panel is English-only and does not support RTL.

### Dark Mode
The admin panel is dark-mode only (uses `bg-zinc-900/black` color scheme throughout `app/admin/layout.tsx`). The superadmin panel is also dark-mode only. The QR customer menu uses a light theme by default with the cafe's `accentColor`. No light/dark toggle exists anywhere. Dark mode is hardcoded, not a user preference — this is intentional for the admin/ops aesthetic but limits accessibility options.

### Responsive Design
The admin panel is responsive (mobile sidebar with hamburger menu in `app/admin/layout.tsx`). The POS, Kitchen KDS, and Waiter views are designed for tablets/mobile. The QR menu is mobile-first. The superadmin panel appears to be desktop-oriented.

### Error Handling
Error handling is solid at the Express level: `errorHandler` middleware catches all unhandled errors, sanitizes sensitive fields, logs structured JSON via pino, and returns appropriate status codes. In production, 500 errors return generic messages. Frontend error handling relies on per-component `try/catch` blocks and conditional rendering — no global error boundary pattern is consistently applied.

### Loading States
Loading states are implemented at the component level throughout the admin panel (individual `useState` for loading booleans). No global loading indicator or suspense boundary. This is standard Next.js App Router practice but results in repetitive boilerplate.

### Empty States
Empty state messages use the translation key `noData` (AR/EN/FR/ES) in most list views. Some pages may lack illustrated empty states — this is a UX polish concern, not a functional issue.

### Notification System
Two parallel notification systems exist:
1. **Real-time Socket.io** — for KDS, waiter calls, order alerts, price updates (fully functional)
2. **CoreNotification (DB)** — platform-level notifications stored in `core_notifications` collection (fully implemented but no UI to display them to admins)
3. **SystemNotification** — restaurant-level in-app alerts (low stock, PO confirmations) stored in `system_notifications` collection (model exists, routes in `inventoryAdmin.ts`)

The CoreNotification system has no API endpoint or UI — notifications are created internally but never surfaced to users.

### Audit Logging
`AuditService` (Core) writes to `core_audit_entries` collection. The service is implemented but its usage across modules is inconsistent — not all mutation operations call `AuditService.log()`. No superadmin UI to query audit logs exists (the `activity` page is missing).

### Feature Flags
`FeatureFlagService` is fully implemented with global/tenant/role scoping. Default flags are seeded at startup. The flags `certification`, `analytics`, `marketplace` all default to `comingSoon`. There is no superadmin UI to manage feature flags (the `settings` page is missing). Flag changes require direct database manipulation.

---

## Integration Audit

### Marketplace → Orders → Notifications → Analytics → Audit → AI Jobs → Operations

| Integration Point | Status | Notes |
|---|---|---|
| Marketplace Order Created → Payment Engine auto-create transaction | Connected | `initPaymentEngine` subscribes to `MarketplaceOrderApproved` event via EventBus |
| Order Completed → Loyalty Points Earn | Broken | No EventBus subscriber in loyalty module; must be done via n8n externally |
| Reservation Completed → n8n Review Pipeline | Connected via n8n | `COMPLETED` status triggers n8n webhook; no direct code event |
| Order Created → Analytics Metric Collection | Partial | Analytics engine subscribes to events but actual `OrderPlaced` event not verified as published in `src/routes/orders.ts` |
| Cafe Created → Tenant Profile Auto-provision | Connected | `initTenantEngine` subscribes to `CafeCreated` event via EventBus |
| AI Generation → AI Job Tracking | Connected | `marketingRouter` creates `AIJob` records |
| Marketing Campaign → Social Post → n8n | Connected via n8n | `n8nExecutionId` stored on `MarketingCampaign` |
| Fraud Detection → WhatsApp Alert | Connected | Nightly cron calls `sendDailyFraudReport` |
| Certification Eval → Cron → DB | Connected | `certificationEval` cron runs and stores `CertificationResult` |
| Analytics Engine → Integration Registry | Partial | `AnalyticsAdapter` registered in `IntegrationRegistry` but queries wrong schema fields |
| Feature Flag Check → Route Gating | Partial | `marketplace` flag checked in catalog route; most admin routes do not check feature flags |

---

## Database Audit

### Schema Health

The schema is well-structured overall. Key observations:

- **Indexes:** Comprehensive. All high-cardinality lookup fields are indexed. Compound indexes on `Order` (`cafeId + status`, `cafeId + createdAt`, `cafeId + isPaid`) are appropriate for the most common query patterns.
- **Naming:** Consistent `camelCase` for fields. `@@map` is used correctly to separate collection names from model names for core engine collections (e.g., `core_audit_entries`, `analytics_snapshots`, `tenant_profiles`). Restaurant module collections use Prisma default naming (model name = collection name).
- **Deprecated fields:** `Cafe.monthlyFee` and `Cafe.subscriptionTier` are marked deprecated in comments but remain active.
- **Missing index:** `MarketplaceOrder` has no index on `createdAt` — pagination queries on orders by date will do collection scans as order volume grows.
- **`@@unique([cafeId, id])`** on `SupplierInvoice` is redundant — `id` is already globally unique. This constraint adds no value.
- **`TenantProfile.tenantId`** is a `String @unique` (not `@db.ObjectId`) — there is no Prisma relation to `Cafe`. Referential integrity is application-enforced only.
- **`MarketplaceOrder.tenantId`**, **`MarketplaceOrderItem.orderId`** and **`RecommendationLog.tenantId`** are plain strings with no Prisma relations — same issue.

### Collections Inventory

| Collection | Purpose | Notes |
|---|---|---|
| Cafe | Restaurant tenant master record | Core entity |
| Table / Seat | QR layout with capacity | Well-indexed |
| Category / Product | Menu management | Includes ModifierGroups |
| Order / OrderItem | Transaction record | Full commission snapshot |
| BillRequest / WaiterCall | Real-time operations | |
| User / PasswordResetRequest | Auth | |
| RefreshToken | JWT refresh tokens | No cleanup cron |
| VerificationToken | Magic link tokens | Has expiry index |
| WaiterQRToken | Waiter QR login | |
| Staff / CashierShift / WaiterShift | POS personnel | |
| BillingTier / WalletLog | Commission billing | |
| PaymentRequest / BillingInvoice | Manual payment tracking | |
| OnlinePayment / ProcessedWebhook | Stripe/Moyasar/Mobile Money | |
| Expense / Reservation | Operations | |
| StockItem / InventorySupplier / PurchaseOrder | Inventory | |
| Equipment / MaintenanceRecord | Asset management | |
| SupplierInvoice / PurchaseRequisition | Procurement | |
| Recipe | Cost management | |
| ClientSession / ActiveSession | Dynamic QR sessions | |
| Zone | Seating zones | |
| QrScan / FraudAlert / PrinterLog | Anti-fraud | |
| Feedback / ReviewGallery | Customer voice | |
| MarketingCampaign | Video marketing | |
| CafeCustomer | WhatsApp re-engagement | |
| LoyaltyAccount | Loyalty program | |
| Event / Guest | SmartTraiteur | |
| DemoRequest / Lead | CRM | |
| AIJob / AIJobLog | AI job queue | |
| AIProviderSettings | AI Center | |
| SystemNotification | In-app alerts | No UI |
| SiteConfig | Landing page config | |
| PremiumPlan | Subscription plans | |
| AuditEntry | Platform audit log | No UI |
| CoreNotification | Platform notifications | No UI |
| StoredFile | File metadata | |
| FeatureFlag | Feature gating | No admin UI |
| CertificationResult / CertificationEvidence | Certification engine | |
| RuntimeSetting / PlatformBackup / MetricSnapshot | Ops + Analytics | |
| MarketplaceCategory / MarketplaceProduct / ProductPricing / MarketplaceSupplier / ProductInventory | Marketplace catalog | |
| MarketplaceOrder / MarketplaceOrderItem / MarketplaceBundle / RecommendationLog | Marketplace transactions | |
| PaymentTransaction | Marketplace payments | |
| TenantProfile / TenantUsageSnapshot / TenantSuspensionLog | Tenant lifecycle | |

---

## Code Quality Summary

### Dead Code
- `src/routes/posParser.ts` — imported and mounted in `server.ts` but its purpose (POS bridge receipt parser) overlaps with `antiFraud.ts` routes. Worth reviewing for redundancy.
- `Cafe.subscriptionTier` and `Cafe.monthlyFee` — deprecated but still in schema and API responses.

### Console Logs (Production)
- **Count:** 18 `console.log` / `console.error` calls in production source files
- **Severity:** Low — most are in `src/server.ts` (startup messages), `src/marketing-brain/seed/index.ts` (one-time seed), and `src/marketing-brain/providers/UsageTracker.ts` (error handler)
- **Impact:** These bypass the pino structured logger and won't appear in JSON log aggregation (Datadog, CloudWatch, etc.)

### TODOs / FIXMEs
- **Count:** 0 found in codebase via grep — no outstanding TODO/FIXME markers. Clean.

### Type Safety
- 8 `as unknown as` casts found across production code. Most are in Marketing Brain (Mongoose ODM + Prisma interop) and one in `adminStats.ts`. No `@ts-ignore` directives found — the codebase does not suppress TypeScript errors. Overall type safety is good.

---

## Documentation Audit

| Engine | Architecture Doc | UI Doc | Extension Guide | Status |
|--------|----------------|--------|----------------|--------|
| Core Foundation | `core-foundation.md` ✅ | ❌ | ❌ | Partial |
| Authentication | `05-authentication-flow.md` ✅ | ❌ | ❌ | Partial |
| Restaurant Admin | `01-high-level.md` ✅ | ❌ | ❌ | Partial |
| Billing | `04-billing-lifecycle.md` ✅ | ❌ | ❌ | Partial |
| Marketing Brain | `03-marketing-pipeline.md` ✅ | ❌ | ❌ | Partial |
| Certification Engine | `certification-engine.md` ✅ | `certification-dashboard.md` ✅ | `certification-rule-packs.md` ✅ | Complete |
| Analytics Engine | `analytics-engine.md` ✅ | ❌ | ❌ | Partial |
| Operations Layer | `operations-layer.md` ✅ | ❌ | ❌ | Partial |
| Marketplace Engine | `marketplace-engine.md` ✅ | `marketplace-admin.md` ✅ | `marketplace-ai.md` ✅ | Complete |
| Marketplace Orders | `marketplace-orders.md` ✅ | `restaurant-marketplace.md` ✅ | ❌ | Partial |
| Payment Engine | `payment-engine.md` ✅ | ❌ | ❌ | Partial |
| Tenant Lifecycle | `tenant-lifecycle.md` ✅ | ❌ | ❌ | Partial |
| AI Center | ❌ | ❌ | ❌ | Missing |
| POS / KDS | ❌ | ❌ | ❌ | Missing |
| Loyalty | ❌ | ❌ | ❌ | Missing |
| Reservations | ❌ | ❌ | ❌ | Missing |
| SmartTraiteur | ❌ | ❌ | ❌ | Missing |
| Inventory | `n8n-inventory-workflow.json` only | ❌ | ❌ | Missing |
| WhatsApp Integration | `07-external-integrations.md` partial ✅ | ❌ | ❌ | Partial |
| Anti-Fraud | ❌ | ❌ | ❌ | Missing |

---

## Recommended Next Steps

Priority order for next development epics:

1. **[P0 Security] Remove or encrypt `pinDisplay`** — Either remove the plain-text PIN display feature or encrypt it with a server-side key. This is the single highest-priority security fix.

2. **[P0 Completeness] Build the 10 missing superadmin pages** — At minimum: `/superadmin/demo` (demo request management), `/superadmin/billing` (billing overview), `/superadmin/settings` (feature flags + runtime settings), `/superadmin/activity` (audit log). The other 6 can follow.

3. **[P1 Business] Enable key feature flags** — Set `certification` and `marketplace` to `enabled` in the feature flag seed for production launch. Add a UI to manage flags.

4. **[P1 Auth] Fix email whitelist** — Expand or remove the email domain whitelist to allow business email domains.

5. **[P1 Integration] Fix AnalyticsAdapter field mismatch** — Update `src/integration/adapters/AnalyticsAdapter.ts` to query the correct `MetricSnapshot` fields (`metricId`, `period`, `tenantId`).

6. **[P1 Billing] Unify Cafe + TenantProfile lifecycle state** — Implement a sync service or migration to consolidate lifecycle into `TenantProfile` only.

7. **[P2 Quality] Centralize `requireSuperAdmin` middleware** — Create `src/middleware/requireSuperAdmin.ts` and import it in all superadmin routes.

8. **[P2 Performance] Fix certification N+1 query** — Batch-fetch `CertificationResult` for all cafes in superadmin certification list.

9. **[P2 Security] Add rate limiting to `/api/pos/shift`** — Prevent brute-force PIN attacks.

10. **[P2 Integration] Wire loyalty point earning to order completion** — Subscribe to `OrderCompleted` EventBus event in the loyalty module.

11. **[P3 Cleanup] Add RefreshToken cleanup cron** — Daily cron to delete expired refresh tokens.

12. **[P3 Docs] Write AI Center, POS, Loyalty, Reservations architecture docs.**

---

## Suggested Beta Roadmap

### Week 1–2: Security & Critical Fixes
- Remove `pinDisplay` plain-text PIN (replace with encrypted field or remove feature)
- Expand email whitelist to support business domains
- Add rate limiting to POS shift login
- Fix AnalyticsAdapter schema field mismatch

### Week 3–4: SuperAdmin Completeness
- Build `/superadmin/demo` — demo request review + trial activation
- Build `/superadmin/billing` — wallet overview, payment request review, billing history
- Build `/superadmin/settings` — feature flag management, runtime settings
- Build `/superadmin/activity` — audit log viewer

### Week 5–6: Platform Polish
- Centralize `requireSuperAdmin` middleware
- Enable `certification` and `marketplace` feature flags for beta
- Build `/superadmin/analytics` — platform revenue, order volume, cafe growth charts
- Add RefreshToken cleanup cron

### Week 7–8: Integration Hardening
- Wire loyalty point earning to order completion
- Sync Cafe + TenantProfile lifecycle state
- Test end-to-end Marketplace order flow (catalog → order → approval → payment)
- Load test POS PIN login with large staff count

### V1 Launch Criteria
- [ ] All P0 issues resolved
- [ ] All P1 issues resolved or mitigated
- [ ] SuperAdmin panel has at minimum 15/20 nav items functional
- [ ] Certification and Marketplace feature flags enabled for all tenants
- [ ] No plain-text credentials stored anywhere in DB
- [ ] Smoke test: full customer journey QR scan → order → KDS → POS checkout → billing → loyalty
