# Sprint 12 Final Audit Report

**Date:** 2026-08-04
**Scope:** Authentication & Tenant Isolation · Billing & Subscription Lifecycle · POS Financial Integrity · Database Safety · API Security · Deployment Readiness · Complete User Journey Validation
**Method:** Four parallel read-only code audits, each evidence-cited (file:line). No code was modified as part of this audit.

**Update 2026-08-04 (commit `affa0dc`):** P0-1 fixed — `src/middleware/requireActiveBilling.ts` added and wired into all POS/Comptoir/Waiter revenue-generating routes. Verified against the live DB (ACTIVE allows, SUSPENDED blocks with 403, QR flow's `orders.ts` has zero diff). P1-6 (Atlas backup verification) is still an open manual action item, not a code fix.

**Update 2026-08-04 (commit `46d7e5f`):** P1-1 fixed — `table_checked_out` is now emitted from `src/services/kds.ts`'s `emitOrderStatusUpdate` on COMPLETED, wired into `pos/checkout.ts` (both routes) and `checkoutBySeats.ts`, which previously emitted nothing. `pos/waiter.ts`/`orders.ts` got the fix for free since they already called the shared function. Zero business-logic lines changed (pure additive emit calls inside the existing success guard).

See [[project_sprint12_final_audit]] memory for the up-to-date status.

---

## Executive Summary

SmartRestau's core order/billing pipeline (fixed earlier this session — commission double-billing, checkout race conditions, plaintext PIN storage, WhatsApp webhook auth) is confirmed solid on re-check. This audit found **one new P0**: billing suspension only enforces on the customer QR-ordering path — the POS/Comptoir/Waiter in-house ordering path has **zero billing-status check anywhere**, so a cafe that stops paying can keep operating indefinitely via staff-facing terminals. This was independently discovered by two separate audit passes (billing-integrity review and end-to-end journey trace), which strengthens confidence it's real, not a false positive.

Security fundamentals (CORS, Helmet, JWT fail-fast, Prisma-only queries, tenant scoping via token-derived `cafeId`) are solid — no P0s found there. Database safety is generally sound (indexes present, singleton Prisma client, no unbounded deletes) with one important-but-unverifiable item: the ops "Backup" dashboard is cosmetic (fabricates a size estimate, never exports data), so real disaster recovery depends entirely on MongoDB Atlas's own backup tier — which cannot be confirmed from code and must be checked directly in the Atlas console before launch.

**One broken customer-facing link** was found in the QR live-order-tracking flow: the event the client listens for to show "your bill is paid, thank you" is never emitted by the server, so customers don't see their order complete in real time — money and data are correct, this is a UX gap, not a financial-integrity bug.

---

## P0 Blockers

### P0-1 — POS/Comptoir/Waiter ordering has no billing-suspension check at all
**Severity:** P0 — defeats the entire non-payment enforcement mechanism for any restaurant using in-house POS/Comptoir (the default staff workflow), not just customer self-order QR.

**Evidence:**
- `src/middleware/authorizePOS.ts:26-49` — validates only the staff JWT signature/claims; never loads the `Cafe` record or checks `isActive`/`billingStatus`.
- `src/routes/pos/shift.ts` (PIN login/shift-open), `src/routes/pos/orders.ts:24-60` (order creation), `src/routes/pos/checkout.ts`, `src/routes/pos/checkoutBySeats.ts`, `src/routes/pos/waiter.ts` — confirmed via repo-wide grep, **zero** references to `cafe.isActive`/`billingStatus` anywhere in this route family.
- `src/middleware/requireUnlockedShift.ts` — only checks a per-staff shift lock, unrelated to billing.
- Contrast: `src/routes/orders.ts:105-114` (customer QR order) correctly does `if (!cafe?.isActive) return res.status(403)...` — the gate exists, it's just only wired into one of the two order-creation paths.
- `src/cron/dailyDebtDetection.ts:40-95` correctly transitions overdue cafes to `PAST_DUE` → `SUSPENDED` (`isActive: false`) — the suspension mechanism itself works; nothing downstream on the POS side reads it.
- Admin UI does surface a warning (`app/admin/dashboard/page.tsx:191-198`, `app/admin/layout.tsx:433-446`), so the owner is informed — but nothing technically stops staff from continuing to ring up orders.

**Risk:** A cafe suspended for non-payment can keep taking POS/Comptoir orders indefinitely, generating commission-bearing revenue with zero enforcement — the billing model's core protection is bypassable by simply not using the QR menu.

**Recommended fix:** Add a `cafe.isActive`/`billingStatus` check — ideally as a small shared helper reused by `authorizePOS` (or called at the top of `pos/orders.ts`, `pos/checkout.ts`, `pos/checkoutBySeats.ts`, `pos/waiter.ts`'s order-mutating routes) — that rejects with a clear error once a cafe is `SUSPENDED`. Read-only routes (viewing existing orders, clocking out) probably shouldn't be blocked; scope the gate to order-creation/checkout specifically.

**Estimated effort:** Small (0.5–1 day) — one shared check, wired into ~4-5 route files; needs a decision on exact UX (hard block vs. degraded/warn-only grace window) before implementing.

---

## P1 Issues

### P1-1 — Live order tracking silently breaks on checkout: customer never sees "completed"
**Evidence:**
- Client listens for `'table_checked_out'` (`app/[subdomain]/t/[tableNumber]/page.tsx:678`) to show the completed/thank-you screen — **this event is never emitted anywhere in the server code** (confirmed via repo-wide grep).
- `completeOrderFinancials`'s callers either emit nothing (`pos/checkout.ts`) or call `emitOrderStatusUpdate(..., 'COMPLETED', ...)`, which explicitly excludes `COMPLETED` from the statuses forwarded to the customer's table room (`src/services/kds.ts:161-164`, only forwards `['PREPARING','READY','DELIVERED']`).
- Separately, the client also listens for `'order_status_update'` (`page.tsx:674`) but the server only ever emits `'order_status_updated'` (trailing "d") — a name mismatch, currently harmless since `your_order_updated` covers the same state, but dead code.
- No REST polling fallback exists on the customer page to catch a missed/never-sent event.

**Risk:** Every customer who orders via QR and pays at the table will see their screen frozen on READY/DELIVERED after the bill is closed, until they manually reload. Purely cosmetic (server-side money/data are correct) but it's the single most customer-visible flow in the product, and this WILL be noticed on day one of the pilot.

**Recommended fix:** Emit a `table_checked_out` (or reuse `your_order_updated` with `status: 'COMPLETED'`) event to the customer's table room from the checkout paths in `pos/checkout.ts` and `pos/waiter.ts`. Fix the `order_status_update`/`order_status_updated` name mismatch while touching this code (trivial, same fix).

**Estimated effort:** Small (0.5 day).

---

### P1-2 — Cancelling a COMPLETED order doesn't reverse commission, inventory, or loyalty
**Evidence:** `src/routes/orders.ts:214-281` (`PATCH /api/orders/:orderId/status`) — `validStatuses` includes both `COMPLETED` and `CANCELLED`; the only guard is `if (order.status === status)` (line 235), nothing prevents `COMPLETED → CANCELLED`. The non-COMPLETED branch (lines 262-264) is a bare status update with no wallet credit, no inventory restock (no reversal export exists in `src/services/inventoryDeduction.ts`), and no loyalty reversal.

**Risk:** Silent financial/inventory drift if any admin ever cancels a completed order — charge and stock deduction stay applied with no way to reverse them, and there's no legitimate "void" path at all.

**Recommended fix:** Either disallow `COMPLETED → CANCELLED` transitions outright (simplest, matches how most POS systems require a separate "void" permission), or build an explicit reversal path gated to an admin-only action with its own audit trail.

**Estimated effort:** Small if disallowing the transition (~1 hour); Medium if building a real reversal flow (1-2 days).

---

### P1-3 — Daily debt-detection cron has no per-cafe error isolation
**Evidence:** `src/cron/dailyDebtDetection.ts:49-65` and `:83-96` — each loop body does a bare `await prisma.cafe.update(...)` with only the outer function-level `try/catch` (`:22-27`). One cafe's DB error aborts the whole day's run for every other cafe. Contrast with `src/cron/weeklyBilling.ts:51-58` and `src/billing/lifecycle/SubscriptionLifecycleJobs.ts:59-67/81-89/115-123`, which correctly wrap each tenant's mutation in its own try/catch.

**Risk:** A single problematic cafe record silently prevents all other overdue cafes from being suspended/flagged that day, delaying debt enforcement fleet-wide with no visibility that it happened.

**Recommended fix:** Wrap each loop iteration's `cafe.update` (+ webhook call) in its own try/catch, log-and-continue, matching the already-correct pattern in `weeklyBilling.ts`.

**Estimated effort:** Small (2-3 hours).

---

### P1-4 — Superadmin auth: `billingPlansSA.ts` accepts any email, not just the configured one
**Evidence:** `src/routes/superadmin.ts:72-76` (`requireSuperAdmin`, the canonical gate) checks both the shared secret AND that the email header matches `SUPERADMIN_EMAIL`. `src/routes/billingPlansSA.ts:9-16` (`requireSA`) reimplements this gate but only checks that an `x-superadmin-email` header is *present* — never that it matches the configured value. Anyone holding the shared secret can use any email string on these routes.

**Risk:** A real (if narrow) authorization gap on billing-plan-management superadmin endpoints — reduces the effective protection to "secret alone," inconsistent with every other superadmin route.

**Recommended fix:** Replace `billingPlansSA.ts`'s local `requireSA` with the shared `requireSuperAdmin` from `superadmin.ts`, or fix the email comparison to match it.

**Estimated effort:** Small (1-2 hours) — also worth grepping for any other superadmin router that copied this same weaker pattern before closing this out.

---

### P1-5 — PIN login: brute-force amplification + missing strict rate limit
**Evidence:** `src/routes/pos/shift.ts:30-41` (`validatePin`) loops over every active staff member's hashed PIN for a guessed code — brute-forcing a 4-digit PIN against a cafe with N staff succeeds up to N× faster than targeting one account. `POST /api/pos/shift` doesn't share the `/api/auth` prefix, so it's covered only by the generic `apiLimiter` (60 req/min) rather than the strict `authLimiter` (10/15min) — confirmed via `src/server.ts:211-236`.

**Risk:** A real authentication boundary (grants POS/checkout access) with a credible brute-force path before launch, especially for restaurants with many staff and short numeric PINs.

**Recommended fix:** Add a dedicated stricter rate limiter on `/api/pos/shift` (and consider per-cafe or per-IP+cafe keying so one bad actor doesn't lock out a legitimate cafe's staff). Longer-term (already flagged in the earlier PIN-security fix's "remaining risks" list): a keyed lookup instead of looping bcrypt over all staff.

**Estimated effort:** Small (2-3 hours for the rate limiter; the lookup-mechanism redesign is a separate, larger UX change, not required for launch).

---

### P1-6 — Backup mechanism is cosmetic; real recovery posture unverified
**Evidence:** `src/ops/backup/BackupService.ts:19-44` (`collectEntityCounts`) only runs `prisma.<model>.count()` calls; `triggerBackup()` (`:47-79`) fabricates `sizeEstimate = JSON.stringify(counts).length * 100` and marks the "backup" completed — no `mongodump`, no external export, no file write anywhere in the repo (confirmed via grep of `scripts/`).

**Risk:** The ops dashboard gives false confidence that backups exist. Real recovery depends entirely on MongoDB Atlas's own backup/PITR tier, which **cannot be verified from code** — this needs a direct check of the Atlas console (cluster tier, continuous backup enabled, retention window) before launch. **If that check comes back negative (e.g. a free/shared tier with no PITR), this escalates to P0 immediately** — there would be zero recovery path from data corruption or an operator mistake.

**Recommended fix:** (1) Verify Atlas backup/PITR configuration directly — this is the urgent action, not a code change. (2) Either build a real scheduled export as defense-in-depth, or relabel the ops UI to something honest like "Collection Health Counts" so it stops implying backup coverage that doesn't exist in the app layer.

**Estimated effort:** Verification: <1 hour (Atlas console). Relabeling UI: <1 hour. Real export mechanism if needed: Medium (1-2 days).

---

### P1-7 — `prisma db push` runs unattended on every deploy with no dry-run/diff gate
**Evidence:** `package.json:6` — `"start": "prisma db push && ts-node --transpile-only src/server.ts"` runs on every production boot. The CI workflow (`.github/workflows/ci.yml:23-25`) only runs `prisma generate`, not a schema diff/dry-run check. `db push` keeps no migration history (unlike `prisma migrate`), so there's no audit trail if a schema change reshapes data unexpectedly at deploy time.

**Risk:** An incompatible field rename/retype, or a new `@@unique` constraint colliding with pre-existing duplicate data, would fail or silently reshape data at deploy time with no rollback path and no history to diagnose it after the fact.

**Recommended fix:** Add a `prisma db push --dry-run` (or `prisma migrate diff` against the live schema) step to CI before merge, so schema drift is visible in review rather than discovered at deploy.

**Estimated effort:** Small (2-4 hours).

---

### P1-8 — Single PM2 instance + in-memory rate-limiter/EventBus state — scaling landmine
**Evidence:** `ecosystem.config.js:6` — `instances: 1`, `exec_mode: 'fork'`. `express-rate-limit` uses the default in-memory store (no Redis store configured, `src/server.ts:27,196-219`). `src/core/events/EventBus.ts` is in-process.

**Risk:** Not a day-one problem (single instance is fine for a pilot), but a landmine for the first "just bump instances for capacity" change — rate limits would reset per-instance (allowing N× the intended budget) and EventBus-driven logic wouldn't propagate across instances, with no error or warning when it happens.

**Recommended fix:** Document this constraint explicitly (e.g. a comment in `ecosystem.config.js` or a DEPLOYMENT.md note) so a future scale-up isn't attempted without first moving rate-limit store and EventBus to Redis/pub-sub. No code change required before launch — this is a documentation/awareness fix given the pilot is single-restaurant.

**Estimated effort:** Small (document now, <1 hour); the actual Redis migration is Medium-Large and explicitly *not* needed before this pilot.

---

## P2 Improvements

| # | Issue | Evidence | Fix direction | Effort |
|---|---|---|---|---|
| P2-1 | `deleteCafeCascade` (tenant hard-delete) runs ~40 sequential deletes with no `$transaction` — partial failure leaves inconsistent state | `src/routes/superadmin.ts:19-66` | Wrap in `$transaction` or move to soft-delete + async cleanup | Medium (0.5-1 day) |
| P2-2 | `calculateContextualFee` can charge a fee larger than a near-zero order total | `src/services/billing.ts:255-273` | Add `if (orderTotal <= 0) return 0` guard | Small (<1 hour) |
| P2-3 | `CashierShift` close has a double-tap race (no `status:'OPEN'` guard in the update `where`) + unvalidated `countedCash` | `src/routes/pos/shift.ts:85-122` | `updateMany` guard matching the pattern already used in checkout routes; add `>=0` validation | Small (2-3 hours) |
| P2-4 | `checkoutBySeats.ts` doesn't resolve `mergedIntoTableId` before looking up orders (functional trap, not a financial bug — returns 404 rather than mis-billing) | `src/routes/pos/checkoutBySeats.ts:41-63` vs. `src/routes/orders.ts:470-472` | Resolve master table id the same way `orders.ts` does | Small (1-2 hours) |
| P2-5 | `authorizeAdmin` cross-checks `req.params.cafeId`/`req.body.cafeId` but not `req.query.cafeId` (currently unexploited — no route reads it) | `src/middleware/authorizeAdmin.ts:38,54` | Add the same check for completeness/defense-in-depth | Small (<1 hour) |
| P2-6 | 6 restaurant-facing routers reimplement JWT auth inline instead of using `authorizeAdmin` (each currently correct, but duplicated logic risks drift — see P1-4) | `billingRestaurant.ts`, `marketplaceCatalogRestaurant.ts`, `marketplaceOrdersRestaurant.ts`, `paymentsRestaurant.ts`, `tenantRestaurant.ts`, `suppliers.ts` | Consolidate onto shared middleware | Medium (0.5-1 day) |
| P2-7 | `DELETE /api/customers/optout` is unauthenticated, trusts `cafeId` from body | `src/routes/customers.ts:196-208` | Add auth or at minimum validate the phone belongs to a real customer record before mutating | Small (1-2 hours) |
| P2-8 | ~35 route catch blocks return raw `err.message` to the client, bypassing the centralized prod-redaction in `errorHandler.ts` | e.g. `src/routes/billingRestaurant.ts:29` | Route all error responses through the shared handler, or redact consistently at each site | Medium (spread across many files, 1 day) |
| P2-9 | Password-reset endpoint reveals whether an email exists (404 vs 200) | `src/routes/auth.ts:823` | Always return 200 regardless of match | Small (<1 hour) |
| P2-10 | Non-constant-time string comparison for shared secrets (`requireInternal`, `requireSuperAdmin`, WhatsApp webhook token) | `superadmin.ts:72-76`, `requireInternal.ts`, `whatsappWebhook.ts` | Use `crypto.timingSafeEqual` | Small (1-2 hours) |
| P2-11 | Demo-mode PIN bypass, scoped to designated demo cafe only | `src/routes/pos/shift.ts:174-178` | Working as intended; periodic review only | None now |
| P2-12 | Payroll approval doesn't refresh the "Reports" tab, only "Payroll" tab — stale numbers until reload | `app/admin/financials/page.tsx:270-272` | Also call `fetchReport()` after a successful approval | Small (<1 hour) |
| P2-13 | No automated test suite anywhere (reconfirmed from earlier audit) | repo-wide | Out of scope for pre-pilot launch per prior team decision; revisit post-pilot | Large |
| P2-14 | GitHub branch protection not enabled on `main` (reconfirmed) | GitHub settings, not code | Manual step, needs repo admin access this environment doesn't have | Small (<15 min, needs the user) |
| P2-15 | Payment-critical env vars (Stripe secret key etc.) aren't in the fail-fast startup check, only JWT/DB/Cloudinary/Resend/superadmin | `src/config.ts:4-15` vs. `ecosystem.config.js:19-49` | Extend required-vars list or add boot-time warnings for soft-required integrations | Small (2-3 hours) |

---

## Verified Working

- **Order → billing → inventory → loyalty pipeline** (the Sprint 10 fix): shared `completeOrderFinancials`/`awardLoyaltyBestEffort` pipeline confirmed still in use at all 5 checkout paths, atomic `updateMany` guards confirmed present, no direct `applyOrderFee` calls remain outside the pipeline.
- **WhatsApp webhook**: confirmed still fail-closed in production (`whatsappWebhook.ts:172-178`).
- **Staff PIN storage**: plaintext `pinDisplay` field fully removed; hashing goes through the shared cost-12 helper.
- **Payroll approval** (built this session): request/response shapes between frontend and backend match exactly; `PayrollApproval` unique constraint confirmed present; correctly flows into financial reporting via the `Expense` model.
- **Reservation auto-check-in**: `autoCheckInReservationForTable` confirmed wired into all three order-creation paths (customer QR, online payment, POS), idempotent, best-effort/non-blocking.
- **Tenant isolation**: 10+ admin route domains spot-checked (orders, finance, expenses, payroll, menu, inventory, equipment, invoices, requisitions, customers) — all consistently derive `cafeId` from the verified JWT, never from client-supplied body/query params. Zero cross-tenant data exposure found in the sampled routes.
- **CORS**: locked to a single explicit origin, fails closed in production if unset. No wildcard-plus-credentials misconfiguration.
- **Helmet**: applied Express-wide (not just Next.js pages) — HSTS, CSP, frame-options, etc. cover both API and page responses.
- **NoSQL injection surface**: zero raw/unsafe query construction found; all data access goes through Prisma's typed query builder.
- **JWT secret handling**: fails fast with no fallback/default anywhere in the codebase; same for `DATABASE_URL`/`FRONTEND_URL`/Cloudinary/Resend/superadmin secrets.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` handler verified to actually execute the documented sequence (crons stop → HTTP drains → sockets close → change streams close → DB disconnects), not just documented in a comment.
- **Indexes**: `Order(cafeId, createdAt)`, `Order(cafeId, status)`, `Order(cafeId, isPaid)`, `PayrollApproval(staffId, periodFrom, periodTo)` unique, `ProcessedWebhook(provider, eventId)` unique — all present and correctly scoped for the queries that use them.
- **Prisma client**: singleton pattern used correctly everywhere in the running server; the only other instantiation is the standalone seed script (not part of the running process).
- **Health/readiness endpoints**: correctly differentiated — `/health` is static liveness, `/ready` does a real `$runCommandRaw({ping:1})` DB check and returns 503 on failure. (Action item: confirm Railway's platform health check actually points at `/ready`, not the static endpoint — this is a deploy-config item, not verifiable from source.)
- **Production start command**: confirmed to serve the prebuilt `next build` output, correctly gated on `NODE_ENV=production`, not accidentally running dev mode.
- **No hardcoded secrets**: repo-wide grep for common secret patterns found nothing in production code (only a `'test-secret'` JWT fallback in standalone CLI test scripts not used by the running server).

---

## Launch Decision:

# NOT READY

One P0 blocks launch: **billing suspension has no enforcement on the POS/Comptoir/Waiter ordering path** (P0-1). This is a small, well-scoped fix (estimated 0.5–1 day) — not a redesign — but it directly undermines the commission-billing model this business depends on, so it should close before the pilot goes live.

Additionally, **P1-6 (backup posture) needs an urgent verification step** (checking MongoDB Atlas's actual backup/PITR configuration) that isn't a code fix but must happen before launch regardless — if Atlas backups turn out to be inadequate, that item becomes a second P0.

The P1 list (7 more items, all estimated Small-to-Medium effort) should be triaged and at minimum the highest-visibility one — **P1-1, the customer live-order-tracking gap** — fixed before the pilot, since it's the single most customer-visible flow in the product and will be noticed on day one even though it's not financially harmful.

Recommended sequence: fix P0-1 → verify Atlas backups (P1-6) → fix P1-1 → re-audit those three → launch. The remaining P1s and all P2s can reasonably follow in the days after the pilot starts, per the "does this reduce launch risk" framing used all sprint.
