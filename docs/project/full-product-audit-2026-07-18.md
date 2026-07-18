# SmartRestau / Smart Ecosystem — Full Product Audit

> Date: 2026-07-18 | Auditor: Claude (Lead Software Engineer / Technical Auditor role)
> Method: 3 parallel read-only research agents + direct verification of the highest-stakes claims. No code was written, edited, or refactored to produce this report.

## Read this first — the single most important finding

**This audit covers two different codebase states, and conflating them would make every number below wrong.**

1. **`main`** — what's actually deployed. All three research agents were sandboxed into fresh git worktrees, which branch from `main`, not from the feature branch this session has been working on. Their findings (Parts 1, 2, 4 below) are an accurate picture of **production today**.
2. **`worktree-sprint-k2-subscription-engine`** — an unmerged feature branch (18+ commits) containing a substantial, tested rebuild of the Billing/Subscription system: a real `BillingSubscription` engine, an automatic lifecycle scheduler, a tenant-access-control migration (Phase 1), and a new RAG Knowledge Layer foundation. **None of this is live.** `main` has zero `BillingSubscription` model, no `src/billing/scheduler/`, no `src/intelligence/rag/` — confirmed directly (`git show main:prisma/schema.prisma | grep BillingSubscription` → 0 matches; `git ls-tree -r main | grep intelligence/rag` → empty).

Everywhere below, findings are labeled **[MAIN]** (live in production) or **[BRANCH]** (built, tested, unmerged). Where a module's real state is materially better on the branch than what's live, both are given — because "is it done" and "is it running" are different questions, and a launch-readiness audit has to answer both.

**Also discovered, not previously known to this session:** `main` already has three pre-existing PM documents this audit conflicts with / builds on:
- `docs/roadmap/MASTER_ROADMAP.md` (dated 2026-06-30) — a **different** phase/sprint numbering scheme (Phase 1–10, Sprint X.Y) from the "Kxx" scheme this session's own `docs/project/master-roadmap.md` documented. These are not reconciled with each other. **This is itself a finding**: three overlapping planning documents now exist (`docs/roadmap/MASTER_ROADMAP.md`, `docs/project/master-roadmap.md`, and this audit) with no cross-references. Recommend consolidating into one before the next planning cycle.
- `docs/platform/platform-audit-v1.md` (dated 2026-06-30) — a prior full audit, scored **67/100**, with a named P0 list. Used below as a baseline to measure delta.
- `docs/roadmap/BACKLOG.md`, `CURRENT_SPRINT.md`, `NEXT_SPRINT.md`, `RELEASE_PLAN.md`, `CHANGELOG.md` — not read in depth for this pass; flagged for the reader's awareness.

---

## PART 1 — Shared Core Platform

### 1. Authentication — [MAIN] COMPLETE (core flows), 80%
**Strengths:** bcrypt password hashing (12 rounds), refresh tokens hashed at rest with rotation (`src/routes/auth.ts:47-49,684-686`), single-use magic links, real Google OAuth (`auth.ts:892-977`), `authLimiter` 10/15min on all of `/api/auth` (`server.ts:210-233`).
**Weaknesses / Missing:** no email verification field on `User` at all — password-signup accounts are active with zero confirmation step. Google OAuth callback puts access+refresh tokens in a URL query-string redirect (`auth.ts:966-972`) — lands in browser history/referrer logs. Magic-link signup whitelists only 7 consumer email domains, blocking legit business emails.
**Technical debt:** `payload: any` for JWT claims everywhere, no typed validation.
**Production readiness:** Needs Work.

### 2. Authorization / RBAC — [MAIN] PARTIAL, 30%
**Strengths:** Tenant-scoping (cafeId match) is consistently enforced in `authorizeAdmin`.
**Weaknesses / Missing:** No real RBAC. `StaffRole` enum = `CASHIER | WAITER | SUPERVISOR` only, checked via hardcoded string comparisons per-route (`authorizeKitchen.ts:47`), not a permission system. `User` model has no role field at all — every user is implicitly full-admin of their one cafe. `src/intelligence/capabilities/` exists but is confirmed dead for human RBAC (zero references outside its own directory).
**Technical debt:** `authorizeKitchen`/`authorizePOS` duplicate JWT-verification boilerplate from `authorizeAdmin` instead of composing it.
**Production readiness:** Needs Work for single-owner cafes; **Critical** the moment any customer needs "manager can't touch billing"-style permission separation.

### 3. Organizations / Tenants — [MAIN] PARTIAL, 40%. [BRANCH] partially addressed, see note.
**Strengths:** `Cafe.isActive` gating is simple and consistently applied where it matters for ordering.
**Weaknesses / Missing:** No true multi-org (`User.cafeId` is a required singular FK, no membership/join table — one user, one cafe, forever). The long-known **architectural split** is confirmed still live on `main`: `TenantProfile.state` (a full lifecycle state machine) is bookkeeping only — not consulted by any request-time gate; `Cafe.isActive` (a plain boolean, checked ad hoc in 30+ route files) is the real enforcement. These can drift out of sync.
**[BRANCH] note:** this session's unmerged work (Tenant Access Migration Phase 1) adds `BillingSubscription.status` as a second, additive, fail-open gate alongside `Cafe.isActive` — a step toward reconciling this split, but it doesn't touch `TenantProfile` and isn't live.
**Production readiness:** Needs Work.

### 4. Billing — [MAIN] PARTIAL, 55%. [BRANCH] materially more complete.
**[MAIN]:** `src/billing/` (plans/invoices/quotas/taxes/events/audit/notifications) is real — invoice numbering, tax calculators, quota checks all work. But quota checks are **display-only**: `grep` for `checkQuota`/`isAllowed` call-sites across all routes → zero results. No route actually blocks an over-quota action. No `BillingSubscription` model exists on `main` — subscription state still lives on `TenantProfile.plan`/`state`.
**[BRANCH]:** the missing subscription layer is exactly what this session built — real `BillingSubscription` schema/state-machine/service, a working K71 scheduler, tenant-access gating. Unmerged.
**Production readiness:** [MAIN] Needs Work. [BRANCH] Needs Work→Ready pending merge + the still-open Phase 2 write-site migration (see `docs/architecture/billing-platform.md` § Phase 2 on the branch).

### 5. Subscriptions — [MAIN] PARTIAL, 35% (thin wrapper). [BRANCH] COMPLETE, ~85%.
**[MAIN]:** `SubscriptionService.ts` is a pass-through wrapper over `src/tenant/lifecycle/LifecycleService` — no independent subscription entity, no independent state machine.
**[BRANCH]:** real `BillingSubscription` model + state machine (`TRIAL/ACTIVE/GRACE_PERIOD/SUSPENDED/CANCELLED/EXPIRED`), a real automatic scheduler (trial-ending reminders, expiry, grace-period, suspension — all via reused event/audit/notification paths), backfilled against live data (5/5 real cafes verified to have a correct subscription), auto-provisioning wired into `CafeCreated`. This is genuinely the most mature piece of unshipped work in the whole audit.
**Gap even on branch:** no auto-cancel, no payment-triggered auto-renew yet (documented as Phase 2).
**Production readiness:** [MAIN] Needs Work. [BRANCH] Ready, pending merge.

### 6. Payments — [MAIN/BRANCH same] PARTIAL, 45%
**Strengths:** Legacy wallet/debt system (`src/routes/finance.ts`, `src/cron/dailyDebtDetection.ts`) is fully live and cron-driven — this is what's actually enforcing suspensions today. Real Stripe Checkout for Gulf markets and Mobile-Money-QR+WhatsApp fallback for Africa are live in the QR-menu payment flow (`src/routes/payment.ts`).
**Weaknesses:** Card/online payment *providers* for the newer BillingSubscription-linked payment system are confirmed stubs (`StripeProvider.ts`, PayPal, Payzone, CMI all `throw new Error('...not yet enabled')`) — honestly labeled, not silently broken, but not live. Two payment concepts (`Cafe.walletBalance` debt vs. `BillingPlatformInvoice`) are not reconciled with each other.
**Production readiness:** Ready (wallet/debt, what's actually running) / Critical (if "online subscription payment" is assumed live anywhere — it isn't).

### 7. Notifications — PARTIAL, 50%
**Strengths:** Core in-app notification store is real and has 14 callers. WhatsApp/Email/Social are three independent, real, cron-driven engines (not dead code).
**Weaknesses:** No unifying dispatcher across channels — four separate systems, no "notify this user via their preferred channel" abstraction. Billing notifications hardcode Arabic strings directly rather than routing through the project's own `T[lang]` i18n convention — a known recurring bug class per project history.
**Production readiness:** Needs Work.

### 8. Scheduler — [MAIN] 9 crons, all live. [BRANCH] adds a 10th (real).
**[MAIN]:** all 9 registered crons confirmed live, none disabled/commented: daily debt detection (02:00), weekly billing (Mon 23:59), nightly (23:00), certification (monthly), subscription-lifecycle-via-TenantProfile-wrapper (03:00), WhatsApp/Email/Social schedulers (every 5min), shift-overtime-lock (every 5min). Graceful shutdown confirmed.
**[BRANCH]:** replaces the old TenantProfile-wrapper scheduler with the real `BillingSubscription` K71 scheduler at the same 03:00 slot; also removes a dead nightly `TenantProfile` lifecycle sweep that had near-zero real enforcement.
**Production readiness:** Ready (mechanically); Critical caveat — see Scalability (Part 4) for why this can't safely run on >1 instance today regardless of branch.

### 9. AI Core — PARTIAL, 45%
**Strengths:** Real, well-built provider-abstraction layer (registry, selector/failover, usage tracking bridged to the event bus). Gemini is a genuinely live, working LLM integration (`GeminiAdapter.ts:79,148,273` — real API key, real endpoint, `isActive = true`).
**Weaknesses:** Claude, OpenAI, Groq, OpenRouter are all explicit `isActive = false` disabled placeholders that throw `DisabledProviderError`. Despite ~30 advisor/agent directories under `src/intelligence/`, there is exactly **one** live LLM provider — single point of failure, no real failover today.
**Production readiness:** Needs Work.

### 10. Knowledge / RAG — split finding, read carefully.
**Knowledge Engine [MAIN, live]:** COMPLETE, 75%. Real versioned fact store (`(tenantId, key)`, append-only history + `isCurrent` flag), genuinely wired to the Data Hub as a source. This is **not** RAG and never claimed to be.
**RAG Layer [BRANCH only, unmerged]:** exists as of this session — `src/intelligence/rag/`: Repository/Document/Chunk storage, keyword-overlap search (no embeddings, no AI provider — by explicit design), retrieval + context assembly, permission-aware queries, REST API, audit logging, self-cleaning integration test (26/26 passing against live data). Explicitly RAG-ready, not RAG-complete. **Zero of this exists on `main`.**
**Production readiness:** Knowledge Engine: Ready. RAG: N/A on main (doesn't exist there); on branch, Ready as a foundation, but has no embedding provider — cannot actually do semantic retrieval yet, only keyword overlap.

### 11. Audit Logs — PARTIAL, 35%
**Strengths:** `AuditService` is a real, working, generic service, called from 25 files.
**Weaknesses:** Zero HTTP route handlers call it directly (`grep -l "AuditService" src/routes/*.ts` → empty) — adoption is concentrated in newer subsystems (billing, marketplace, certification, AI copilot), essentially absent from the older high-traffic modules (menu, staff, tables, POS). **No audit-log viewer UI exists anywhere** in either `app/admin/` or `app/superadmin/`.
**Production readiness:** Critical for any compliance/support use case ("who changed this price") — the data isn't being written for most mutations, and what is written can't be viewed.

### 12. CRM Core — PARTIAL, 40%
Real backend (`CustomerService.ts`: search, profile, tags, notes, favorites) fully wired to `/api/admin/customers/*`, but **zero consuming frontend** — no `app/admin/customers` page exists anywhere, not in the sidebar nav. Loyalty has its own smaller customer list and does have a UI. Fully built, invisible feature.
**Production readiness:** Needs Work (functionally fine, unusable without a UI).

### 13. Files / Uploads — PARTIAL, 60%
Real Cloudinary-backed uploads (landing hero image, menu import file) with size limits, but MIME-type validation is client-supplied-header only (trivially spoofable) and there is **no virus/malware scanning anywhere**. `Cafe.logoUrl` isn't a real upload at all — a plain string field set from an arbitrary URL with no validation that it's even an image.
**Production readiness:** Needs Work.

### 14. Settings — N/A as a generic system by design; no audit trail, real gap
No `Settings`/`TenantSettings` model exists — the `Cafe` model itself is ~178 lines of flat fields (branding, payment config, feature toggles, loyalty thresholds, review links...). This is a legitimate design choice for a single-tenant-config app, but settings changes go through `menuAdmin.ts` handlers that **never call `AuditService`** — changes to core business configuration are silent and unlogged.
**Production readiness:** Needs Work.

### 15. Feature Flags — PARTIAL, 35%
A real, DB-backed, scope-aware (`global`/`tenant`/`role`) flag service exists (`FeatureFlagService.ts`) but is called from only 4 non-service call sites total. Meanwhile, the actual per-restaurant capability toggles that most need this kind of governance (`smartWifiEnabled`, `cashierPosEnabled`, `isSmartInventoryEnabled`, etc.) are plain booleans directly on `Cafe`, entirely bypassing the flag service. Two systems solving overlapping problems, not integrated.
**Production readiness:** Needs Work.

### 16. API — PARTIAL, 50%
81 route files. Only 3 are versioned under `/api/v1/`; the other ~78 are unversioned inline paths. No consistent success-response envelope — 88 occurrences of ad hoc `{ ok: ... }`/`{ success: ... }`/raw-object patterns across the codebase, versus one clean `normalizeSuccess()` helper that exists but was never propagated beyond the Intelligence Gateway. Error responses are somewhat more consistent (`res.status(500).json({ error })` in ~70 of 81 files) but still no error-code taxonomy.
**Production readiness:** Needs Work — fine internally, real friction for any external API consumer.

### 17. Security — Needs Work (full detail folded into Part 4.1)
Strong perimeter (helmet with real CSP/HSTS, CORS that hard-fails on missing `FRONTEND_URL` in prod, 3-tier rate limiting, zero raw-query injection surface, secrets not committed, PIN hashing confirmed fixed since the June 30 audit). Specific unresolved gaps: POS PIN login shares the general 60/min limiter rather than a tight brute-force-specific one (a 4-8 digit PIN is far more guessable at that rate than a password); **`Staff.pinDisplay` still stores the PIN in plaintext alongside the bcrypt hash** — this is the exact P0 flagged in the June 30 audit, confirmed **still unfixed** 19 days later; PII (email/phone, not secrets) logged unredacted in several places.

### 18. Monitoring — Needs Work (full detail folded into Part 4.6)
No external APM/error-tracking (zero Sentry/DataDog/etc. in `package.json`). Real internal health checks (`/health`, `/ready`) exist and are load-balancer-usable. The June 30 audit flagged Sentry as a Phase 7 "not started" item — still not started.

### 19. Logging — Ready operationally, Needs Work for compliance
Pino, structured, `LOG_LEVEL`-configurable, sensible secret-redaction (password/token/pinCode), adopted in 107 of 110 relevant files. Production output is **local files only** (PM2 `error.log`/`out.log`) — no shipping to an external aggregator, no retention policy, and the redact list covers credentials but not PII (plaintext emails/phones are logged routinely).

---

## PART 2 — SmartRestau (Business Modules)

All findings below are **[MAIN]** (live) unless noted. Format: Completion % / Missing / Blocking / Sellable today? / Priority.

### Core modules

| Module | % | Sellable today? | Blocking issue | Priority |
|---|---|---|---|---|
| Dashboard | 90% | **Yes** | Minor unguarded token-parse edge case | — |
| QR Menu | 90% | **Yes** — strongest module in the whole audit | None material | — |
| POS | 80% | Partially | **Checkout never deducts inventory or awards loyalty points** (`pos/checkout.ts`, `checkoutBySeats.ts` — confirmed by direct grep, unlike `orders.ts` which does both correctly) | **P1** |
| Orders | 85% live path | Yes (live path) | `src/orders/OrderCoreService.ts` (K11) is fully dead code — zero imports anywhere, confirmed | P2 (cleanup) |
| Kitchen | 85% live path | Yes (live path) | `src/kitchen/KitchenTicketService.ts` (K12) is booted at server start but never fed events — fully orphaned, confirmed | P2 (cleanup) |
| Waiters | 85% | Partially | **Same root-cause bug as POS** — order-served endpoint skips inventory/loyalty | P1 (same fix as POS) |
| Reservations | 95% | **Yes** | No recurring reservations, no reminder automation | — |
| Loyalty | 95% | Yes, but undermined | Module itself is done and hardened; broken by the POS/Waiter completion-path bug (points never awarded on those paths) | — (see P1 above) |
| Customers | Backend 85% / UI 0% | **No** — invisible feature | Zero admin page exists; not in sidebar nav | P1 (cheap — backend sunk cost) |
| Inventory | 90% | Yes, premium add-on | Shares the POS/Waiter deduction bug | — (dependent on P1) |
| Suppliers | 90% (procurement) / partial (marketplace finder) | Mostly yes | Marketplace B2B supplier finder relies on a fragile scraping fallback | P2 |
| Purchases | 90% | Yes | None material | — |
| Expenses | 90% | Yes | No receipt upload, no recurring expenses | — |
| Reports | 75% (reports) / 50% (payroll) | Partially | **"Approve Payment" button in payroll is pure client-side state — no backend endpoint exists (confirmed: only GET and PATCH /rate routes exist). Clicking it does nothing persistent; a restaurant owner would believe money was disbursed when it wasn't.** | **P0** |
| Analytics / AI Advisors | Backend substantial, tenant UI 0% | **No** | 11 advisor modules exist but the only HTTP surface is SuperAdmin-only, secret-header-gated, never reachable by tenant admins, not surfaced anywhere in `app/admin/` | P2/P3 — flag for sales honesty now, build later |
| Marketing | ~50% | Partially | Video-campaign generation is real and live. WhatsApp/Email/Social automation engines are fully functional on the backend with **zero admin UI** — confirmed unreachable from any frontend | **P1** (cheap win — expose already-working backends) |
| CRM | Same gap as Customers | No | No distinct UI beyond what Customers lacks | P1 (same fix) |
| Multi-Branch | ~10% | **No**, not as a real feature | `grep "branchId"` across the entire codebase → **zero hits**. "Branch" = a second fully independent Cafe row with no shared menu/inventory/staff and no cross-branch operations anywhere in POS/Orders/Inventory | P3 |
| Multi-Language | 4 languages defined (ar/en/fr/es) | Partially | **Confirmed repeat of a known bug class**: `app/admin/inventory/page.tsx` defines only 3 of 4 languages in its local translation dicts — Spanish-language tenants silently see English on the entire Inventory page | **P1** (quick fix, but sweep other pages too — this bug class has recurred before per project memory) |
| Billing integration | ~40% of what tenant self-service implies | Partially | The visible `app/admin/billing` page is wallet/debt UI, not subscription management. The real plan/invoice/usage backend (`billingRestaurant.ts`) has **zero frontend consumers** on `main`. **[BRANCH note: this is exactly the gap the unmerged BillingSubscription work is building toward, but its own tenant-facing UI hasn't been built either — the branch adds backend correctness, not the missing page.]** | P1 |

### Cross-cutting, highest-leverage finding in Part 2

**One inconsistent order-completion pattern breaks three modules at once.** `orders.ts` correctly deducts inventory and awards loyalty points on completion; `pos/checkout.ts`, `pos/checkoutBySeats.ts`, and `pos/waiter.ts` do neither, despite a correct, already-written `PosOrderService.closeOrder` existing and simply never being imported by any route. **A single shared completion function, reused by all four call sites, fixes POS, Waiter, Inventory, and Loyalty consistency simultaneously.** This is the single highest-leverage fix in the entire audit — one root cause, four modules affected, all silent (no errors surfaced to the merchant).

### Business Type Variants

`Cafe.tier`, `Cafe.accountMode`, and `Cafe.packageType` exist; there is **no persistent `businessType` field on `Cafe` at all** post-signup (it only exists transiently at onboarding / on `DemoRequest`).

| Variant | Completion | Reality |
|---|---|---|
| **Restaurant** | 100% | The implicit default — nearly the entire codebase is written generically for this, with no type branching needed |
| **Cafe** | ~15-20% | Real but thin: paywalls manual menu creation, different onboarding copy. Zero presence in POS/orders/inventory/reservations |
| **Hotel** | ~5% | `FeatureFlagService.ts` self-documents `hotel_module` as `status: 'comingSoon'`. Effectively **not started** |
| **Traiteur** | ~40% | Most substantial variant — real 644-line commission-bracket route file — **but the `accountMode` flag is never actually checked inside those routes** (0 hits), so any cafe of any type can hit them. The feature exists; the gating that names it doesn't |
| **Fast Food** | 0% | Not even a valid enum value in the onboarding business-type union |
| **Bakery** | ~5% | Onboarding starter catalog only, zero operational code |
| **Food Truck** | ~5% | Onboarding starter catalog only, zero operational code |

**Bottom line:** if the sales pitch implies "built for hotels/bakeries/food trucks," that claim is materially overstated versus what the code actually does differently for them (a different onboarding product list is the entire extent of it).

---

## PART 3 — Smart Ecosystem Readiness

Evaluating what's reusable for future products (SmartMarketing, ArwaEduc, Jam3iyati, SmartPark, others) based on Part 1's findings.

**Genuinely product-agnostic and reusable today [MAIN]:**
- `src/core/` — EventBus, AuditService, NotificationService, StandardEvent. Already documented as "platform-wide, no restaurant logic" and proven reused across Billing/Intelligence/Marketplace.
- `src/tenant/` — TenantProfile provisioning/lifecycle. Same caveat as noted in Part 1 #3: it's real but not the actual enforcement layer today, so a new product reusing it inherits that gap, not a solved problem.
- `src/billing/` (plans/invoices/tax/quota infrastructure) — reusable in shape, though quota enforcement is display-only everywhere, including for a hypothetical second product.
- `src/core/feature-flags/FeatureFlagService.ts` — genuinely generic, underused rather than broken.
- `src/intelligence/` platform (agents/rules/prompts/AI-provider/gateway) — the most deliberately product-agnostic part of the codebase by design (every module's own header comments state "platform-wide," "no Restaurant logic"). This is real reusable infrastructure, gated mainly by the AI Core single-provider limitation (Part 1 #9).

**Reusable in principle, not yet proven [BRANCH, unmerged]:**
- The new `BillingSubscription` engine + scheduler is a much cleaner "one subscription model, any product" primitive than what's on `main` — but it's unmerged, unproven outside SmartRestau, and Phase 2 (retiring the restaurant-specific wallet/debt system) isn't done even for SmartRestau itself yet.
- RAG Knowledge Layer (`src/intelligence/rag/`) is explicitly built product-agnostic (tenantId-scoped, no restaurant-specific logic) — a legitimate head start for any future product needing document Q&A, but has no embedding provider wired yet, so "RAG-ready" is accurate, "RAG-capable" is not.

**Not reusable / restaurant-specific, would need a real abstraction layer first:**
- POS, Orders, Kitchen, Reservations, Inventory, Loyalty — all restaurant-domain models, tightly coupled to `Cafe`. A second vertical product (SmartPark, ArwaEduc) would not reuse these directly; they'd reuse the shared core underneath them, not these modules themselves.
- Multi-branch/multi-org support doesn't exist in a generic form (Part 1 #3, Part 2's Multi-Branch finding) — this would block any future product that assumes real multi-location or multi-tenant-per-user from day one, since the primitive isn't there to inherit.

**Recommendation:** the Shared Core is more genuinely reusable than the roadmap's own Phase framing gives it credit for — but "reusable" here means "architecturally separated," not "battle-tested outside SmartRestau." No second product has actually been built against it yet, so treat every item above as a credible starting point, not a proven platform.

---

## PART 4 — Production Readiness

| Area | Rating | Evidence |
|---|---|---|
| **Security** | Needs Work | Strong perimeter (helmet/CORS/rate-limit/no-injection-surface); unresolved: `Staff.pinDisplay` plaintext PIN (unfixed since June 30 audit), POS PIN brute-force gap, PII-in-logs |
| **Performance** | Needs Work | 255 `@@index` declarations across 100 models — reasonably systematic. But 28 route files call `findMany` with no `take:` limit, including two live-order polling endpoints (`kitchen.ts`, `pos/orders.ts`) — real unbounded-growth risk as order volume increases |
| **Scalability** | **Critical** | `ecosystem.config.js` is hardcoded `instances: 1`. Confirmed in-process, non-shared state that would silently diverge across instances: the core `EventBus` (plain in-memory `Map`), the Intelligence `DataCache` (in-memory TTL, explicitly commented as "future Redis swap-in" that never happened), the Agent Runtime's `ConcurrencyController`, the `AgentRegistry`. **Running a 2nd instance today would not crash — it would silently corrupt event delivery and cache consistency.** This is masked only because production currently runs exactly 1 instance. |
| **Database** | Needs Work | MongoDB via Prisma, no migration system (Mongo has none) — `prisma db push` runs unconditionally on every server start AND on every push to `main` via the one GitHub Action, directly against the shared production Atlas cluster, with no staging gate, no schema-change review, no rollback path beyond manual intervention |
| **Caching** | Needs Work | The one caching abstraction that exists (`DataCache`) is explicitly designed for a future Redis swap that has never happened — zero Redis usage anywhere in the codebase despite the interface being ready for it |
| **Monitoring** | Needs Work | No external APM/error-tracking (confirmed zero Sentry/DataDog/etc.). Internal health checks are real and load-balancer-ready, but that's the ceiling — no exception tracking, no latency percentiles, no alerting |
| **Logging** | Ready (operational) / Needs Work (compliance) | Pino, structured, well-redacted for secrets, near-total adoption — but file-only output (no aggregation/shipping), PII not covered by the redact list |
| **Backups** | Needs Work | Real strategy exists (Atlas Continuous/Scheduled Backup + documented manual `mongodump` runbook) but **lives entirely outside the app**, unverified by any code. Worse: **the in-app "Backups" superadmin dashboard is cosmetic — `BackupService.triggerBackup()` just runs `prisma.*.count()` across 8 models and reports a fabricated size estimate (`JSON.stringify(counts).length * 100`). No actual data export or snapshot ever happens.** Anyone trusting that dashboard believes their data is protected when it isn't; real protection depends entirely on an unverified Atlas tier setting. |
| **Deployment** | Needs Work | No Dockerfile; deploys via `nixpacks.toml` targeting a Railway/Render/Fly.io-style platform, manual sequence documented in `DEPLOY.md`. No explicit CD workflow in-repo. |
| **CI/CD** | **Critical** | The only GitHub Action (`seed.yml`) runs `prisma db push` + seed against production on every push to `main` — it does not build, lint, or test anything. **A broken build can reach `main` with zero automated gate catching it.** |
| **Testing** | **Critical** | Confirmed zero automated tests (no jest/mocha/vitest/playwright in `package.json`, zero `.test.ts`/`.spec.ts` files anywhere). Verification is entirely manual `scripts/controlTest*.ts`/`scripts/smoke*.ts` scripts, hand-run against the live shared database, covering a handful of flows (loyalty, comptoir, achats) — no regression protection for ~95% of the codebase. This session's own Billing/RAG work followed the same pattern (self-cleaning scripts against live data) because no better option exists in this repo today. |

---

## PART 5 — Launch Readiness

### Can SmartRestau be sold today?

**Partially — as a cash-focused, single-branch, Arabic/French/English restaurant point-of-sale-and-ordering product, to a merchant who won't ask about compliance, audit trails, or horizontal scaling.** The QR Menu, Dashboard, and Reservations modules are genuinely strong and sellable as-is. Everything else has at least one real gap between "looks done" and "safe to charge money for."

The honest blocker is not any single missing feature — it's that the **P0 items below are all silent-failure trust issues**: money that appears disbursed but isn't, inventory/loyalty that silently stops updating depending on which screen closed the order, a backup dashboard that reports success while doing nothing. These are worse than a visibly missing feature because the merchant has no way to discover them before it's too late.

### Critical (blocks any commercial launch)
1. **Payroll "Approve Payment" button does nothing** — pure client-side state, no backend endpoint exists. Fix or remove before any beta that has payroll enabled.
2. **POS/Waiter order completion silently skips inventory deduction and loyalty point awarding** — the single highest-leverage fix in this audit; breaks 2 paid add-ons (Inventory, Loyalty) for any merchant not using the plain Orders flow exclusively.
3. **`Staff.pinDisplay` plaintext PIN storage** — flagged in the prior audit 19 days ago, still present. If the DB is ever exfiltrated, every staff PIN is exposed in cleartext.
4. **In-app Backup dashboard is fake** — reports a fabricated size and does no actual data export. Either wire it to something real or remove it — a merchant relying on it believes they're protected when they're not.
5. **No CI gate on `main`** — the one GitHub Action pushes schema + seeds production data on every push, with zero build/lint/test check. A broken deploy can happen with no automated warning.
6. **No automated tests** — for a codebase this size, this is a launch-blocking risk multiplier on every other item, not its own line item.

### Important (should fix before first paying customer, but wouldn't stop a beta)
- CRM/Customers page doesn't exist despite a complete backend — cheap to close, real gap if "CRM" is part of the pitch.
- WhatsApp/Email/Social marketing engines work but have no admin UI — same "cheap, real gap" shape.
- Tenant-facing subscription/invoice self-service page doesn't exist (the wallet/debt UI that does exist is a different thing).
- Multi-language: confirmed 3-of-4-language bug on the Inventory page, likely repeated elsewhere (known recurring bug class).
- Single AI provider (Gemini) live, no fallback, despite multi-provider infrastructure existing.
- No email verification on password signup.
- OAuth tokens in a redirect URL.
- POS PIN login shares a rate limiter that's too loose for a 4-8 digit code.
- Multi-branch is a label, not a feature — don't market it as one yet.

### Nice to Have (post-launch)
- Business-type differentiation beyond a different onboarding product list (Hotel/Bakery/Food Truck/Fast Food are effectively unbuilt).
- Analytics/AI Advisor modules — 11 real backend modules with zero tenant-facing surface; a genuine differentiator once exposed.
- API versioning/response-envelope consistency across all 81 route files.
- External APM, log aggregation, Redis caching, real horizontal scaling.
- Unifying the fragmented notification dispatch and the fragmented feature-flag/ad-hoc-boolean split.

---

## PART 6 — Priority Matrix

**P0 — must finish before Beta**
- Fix or remove the fake payroll approval button
- Unify order-completion (fix POS/Waiter inventory + loyalty gap)
- Remove/fix the plaintext `pinDisplay` field
- Fix or remove the fake in-app backup dashboard
- Add a real CI gate (build + lint, minimum) before any push to `main` auto-applies schema changes to production
- Stand up at least a minimal automated test suite for the highest-risk flows (order completion, payments, subscriptions)

**P1 — must finish before first paying customer**
- Build the missing Customers/CRM admin page (backend already done)
- Build the missing WhatsApp/Email/Social marketing admin UI (backends already done)
- Build a tenant-facing subscription/invoice page
- Sweep the 4-language bug pattern across admin pages (found once, likely elsewhere)
- Decide and disclose: is Traiteur properly gated, or should the `accountMode` check be added
- Merge and finish the unmerged Billing/Subscription branch (K2/K71/K72), including its own documented Phase 2
- Tighten POS PIN rate limiting
- Add email verification to password signup
- Stop putting tokens in OAuth redirect URLs

**P2 — can wait until after launch**
- Delete or wire the two dead-code modules (`OrderCoreService`, `KitchenTicketService`)
- Harden or disclose the marketplace supplier-finder's scraping fallback
- Reconcile the feature-flag system with the ad hoc `Cafe.*Enabled` booleans
- API response-envelope/versioning consistency pass
- Consolidate the now-3 overlapping roadmap/audit documents into one

**P3 — future improvements**
- Real multi-branch support (shared menu/inventory/staff across locations)
- Real RBAC beyond 3 hardcoded staff roles
- Expose the Analytics/AI Advisor backend to tenants
- Real business-type differentiation for Hotel/Bakery/Food Truck/Fast Food
- Redis caching, external APM, log aggregation, multi-instance scalability
- Multi-provider AI failover (enable Claude/OpenAI/Groq/OpenRouter for real)
- Real RAG (embeddings + vector search provider) on top of this session's RAG foundation

---

## PART 7 — Final Score

| Area | Score | Basis |
|---|---|---|
| Architecture | 70% | Genuinely clean separation in newer modules (Billing, Intelligence, RAG); undermined by the TenantProfile/Cafe.isActive split and the fragmented notification/feature-flag systems |
| Backend | 75% | Deep, real functionality across almost every module audited; the honest-stub pattern (payment providers, AI adapters) is good practice, not a weakness |
| Frontend | 55% | Several fully-built backends have zero UI (CRM, WhatsApp/Email/Social admin, subscription self-service, Analytics/AI Advisors) — this is the single biggest gap between "built" and "sellable" |
| UX | 60% | Where UI exists it's generally solid (QR Menu, Dashboard, Reservations); the fake payroll-approval button is a serious trust-breaking UX failure |
| Security | 60% | Strong perimeter controls offset by one unfixed prior-audit P0 (plaintext PIN) and PII-in-logs |
| Testing | 10% | Zero automated tests, confirmed; manual scripts provide narrow, non-regression-protected coverage |
| Performance | 60% | Reasonable indexing discipline; real unbounded-query risk on high-frequency endpoints |
| Documentation | 55% | Individually excellent (billing-platform.md, this session's docs are thorough) but now **fragmented across 3+ overlapping planning documents** with no cross-references |
| Shared Core | 60% (main) / 75% (incl. unmerged branch) | Genuinely reusable infrastructure exists; quota/permission/audit enforcement is largely display-only rather than gate-enforced |
| SmartRestau | 65% | Core restaurant loop (QR→Order→Kitchen→POS→Billing) is strong; undermined by the cross-cutting completion-path bug and several invisible-but-built features |
| **Overall** | **~58%** | Weighted toward Testing/CI-CD/Scalability being genuinely Critical, not just "Needs Work" — a strong backend without a safety net or a way to catch regressions before they reach production |

*(Overall score dropped from the prior audit's 67/100 not because the platform regressed — most individual modules improved or stayed flat — but because this audit weighted Testing, CI/CD, and Scalability more heavily as explicit Critical items, and looked harder for silent-failure UX issues like the fake payroll button and fake backup dashboard, which the June 30 audit didn't surface.)*

---

## PART 8 — Executive Summary

**1. Where are we today?**
A functionally deep restaurant SaaS with a genuinely strong core loop (QR ordering → kitchen → POS → billing) and an ambitious, mostly-real Shared Core / Smart Intelligence platform underneath it. But there are two different "todays": what's live on `main` (missing the entire rebuilt Billing/Subscription engine and the new RAG layer), and what's sitting finished-but-unmerged on this session's feature branch. Neither alone is the full picture.

**2. What is production-ready?**
QR Menu, Dashboard, Reservations, Loyalty (module itself), core Orders flow, the security perimeter (helmet/CORS/rate-limiting), structured logging, and the 9 live cron jobs. The unmerged Billing/Subscription rebuild is also genuinely ready pending merge and its own documented Phase 2.

**3. What is missing?**
Not features so much as *connections*: complete backends with no frontend (CRM, marketing-channel admin UI, tenant subscription self-service, AI Advisors), one root-cause bug silently breaking three modules together (order completion), a safety net (zero tests, no CI gate), and horizontal-scale readiness (hardcoded single-instance, multiple in-memory-only subsystems).

**4. What should be built NEXT?**
In order: (1) the P0 silent-failure fixes — they're each small, isolated, and disproportionately risky to leave; (2) a minimal CI gate before any more schema changes auto-push to production; (3) close the backend-with-no-frontend gaps in Part 2's P1 list, since those are the cheapest wins in the whole audit; (4) merge the Billing/Subscription branch, since it's already done and tested.

**5. Estimated time to Beta:**
2–3 weeks for a focused P0 pass (6 items, all narrow and well-understood) plus a minimal test/CI safety net for the order-completion and payment paths specifically.

**6. Estimated time to first paying customer:**
Add 3–5 weeks on top of Beta for the P1 list (mostly UI work against already-working backends, plus merging and completing the Billing branch) — call it 6–8 weeks total from today, assuming no new scope is added.

**7. Biggest risks:**
- **Silent-failure UX** (fake approve button, fake backup, silently-skipped inventory/loyalty) — these erode trust in a way a visibly-missing feature never does, and they're the kind of thing a demo won't catch.
- **Zero regression protection** on a codebase this large — every fix carries real risk of an undetected break elsewhere.
- **Single-instance-only architecture** — fine today, a hard wall the moment real traffic requires scaling out.
- **Documentation fragmentation** — three overlapping roadmap/audit documents already, with no single source of truth; this will get worse, not better, without a consolidation decision.
- **The unmerged branch itself** — real, tested work that provides zero value until merged, and risks drifting further from `main` the longer it sits.

**8. Recommended roadmap:**
Beta → fix the 6 P0 items + minimal CI/test safety net → merge the Billing/Subscription branch → close the P1 frontend-for-existing-backend gaps → first paying customer → then, and only then, invest in P2/P3 (multi-branch, real RBAC, AI Advisor exposure, real RAG, horizontal scaling). Resist the temptation to build new features before the P0 list is closed — every item on it is a trust problem, not a capability gap, and trust problems compound with every new customer who hits one.
