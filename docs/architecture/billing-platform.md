# Billing Platform — Architecture

## Purpose

A reusable billing engine for all SmartSuite products. Every SaaS module (Restaurant, Hotel, Clinic, Retail) uses the same billing infrastructure for subscription management, invoice generation, quota enforcement, and tax calculation.

**Explicit non-goals:** No payment gateway integration (no Stripe, Moyasar, etc.). No UI. No commission calculations (that remains in the existing `BillingInvoice` commission model).

---

## Module Location

```
src/billing/
  types/index.ts              — all billing types (InvoiceStatus, TaxType, etc.)
  plans/
    PlanCatalogService.ts     — wraps src/tenant/plans + per-region pricing
  subscriptions/
    SubscriptionService.ts    — wraps lifecycle transitions + fires billing events
  invoices/
    InvoiceNumberService.ts   — generates BIL-YYYY-NNNNN unique numbers
    InvoiceService.ts         — create/update/list platform invoices
  quotas/
    QuotaService.ts           — check/enforce per-plan limits
  usage/
    BillingUsageService.ts    — usage tracking with quota enforcement
  taxes/
    TaxService.ts             — provider abstraction
    providers/VATProvider.ts  — VAT rates by country
    providers/SalesTaxProvider.ts — US Sales Tax by state
  events/
    BillingEvents.ts          — publish to EventBus + write BillingEventLog
  notifications/
    BillingNotifications.ts   — send via NotificationService
  services/
    BillingOrchestrator.ts    — high-level facade
  index.ts                    — public API
```

---

## Relationship to src/tenant/ (historical — superseded by Sprint K2 + Tenant Access Migration)

Originally (Sprint K1), `src/billing/` was a thin layer on top of `src/tenant/`,
reusing `src/tenant/lifecycle/LifecycleService` and
`src/tenant/suspension/SuspensionService` for subscription lifecycle and
suspension. **This is no longer true.** Since Sprint K2, subscription
lifecycle lives entirely in `src/billing/subscriptions/` against the
`BillingSubscription` model — it does not call into `src/tenant/` at all.

`src/tenant/` (`TenantProfile`) still exists as a separate, general-purpose
tenant-provisioning module (see § Access Control below for why it was never
actually the platform's access-control authority), but its lifecycle
automation (nightly `expireTrials`/`expireGracePeriods` sweep) was removed as
part of the Tenant Access Migration (Phase 1) — see § Access Control (Phase 1).

`src/billing/` still ADDS, independently of `src/tenant/`:
- Financial invoices (`BillingPlatformInvoice` — tenant-scoped, not cafeId-scoped)
- Tax calculation (VAT, Sales Tax)
- Quota enforcement (check + notify + emit event)
- Billing-specific events (SubscriptionCreated, InvoiceGenerated, etc.)
- Billing notifications (trial ending, invoice due, quota exceeded)

---

## Data Models

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `BillingPlatformInvoice` | `billing_platform_invoices` | tenantId, invoiceNumber (BIL-YYYY-NNNNN), status (DRAFT→PENDING→PAID), total, tax, dueDate |
| `BillingEventLog` | `billing_event_logs` | tenantId, type (BillingEventType), payload JSON |
| `TenantUsageSnapshot` | `tenant_usage_snapshots` | existing, extended with `certificates` field |

---

## Plan Management (Sprint K1)

### Overview

`BillingPlan` is a database-backed, SuperAdmin-managed plan entity stored in MongoDB (`billing_plans` collection). It is the commercial source of truth for what plans are sold, at what prices, and with what feature entitlements.

Note: The hardcoded `PLAN_DEFINITIONS` in `src/tenant/plans/index.ts` define module access for the Tenant Lifecycle Engine. `BillingPlan` is the commercial counterpart — richer, editable, and directly managed by SuperAdmin.

### Plan Schema

| Field | Type | Description |
|-------|------|-------------|
| `code` | String (unique) | Slug identifier, e.g. FREE, STARTER, PROFESSIONAL |
| `name` | String | Display name |
| `description` | String? | Optional description |
| `monthlyPrice` | Float | Monthly subscription price |
| `yearlyPrice` | Float | Yearly subscription price |
| `currency` | String | ISO currency code (MAD, USD, EUR…) |
| `isActive` | Boolean | Whether the plan is available for sale |
| `isDefault` | Boolean | Exactly one plan is the default for new signups |
| `displayOrder` | Int | Sort order in plan selector UI |
| `maxUsers` | Int | Max staff accounts allowed |
| `maxStorageGB` | Float | Max storage in GB |
| `aiCredits` | Int | AI requests per month |
| `marketplaceEnabled` | Boolean | Access to B2B Marketplace |
| `automationEnabled` | Boolean | Access to Automation Engine |
| `certificationEnabled` | Boolean | Access to Certification Engine |
| `apiAccess` | Boolean | Access to REST API |
| `supportLevel` | String | COMMUNITY / EMAIL / PRIORITY / DEDICATED |

### Plan Lifecycle

```
CREATED ──► ACTIVE ──► DEFAULT (only one at a time)
               │
               ▼
           INACTIVE
```

**Rules enforced by PlanValidation:**
- `code` must be unique across all plans
- Exactly one plan can be `isDefault = true` at any time (setting a new default automatically unsets the previous)
- Cannot delete the default plan
- Cannot delete a plan with active tenant subscriptions (ACTIVE / TRIAL / GRACE_PERIOD states)
- Duplicated plans start as `isActive = false` and receive a timestamped code suffix
- Cannot deactivate the default plan

### Plan Events (5 new PlatformEventNames)

| Event | When |
|-------|------|
| `PlanCreated` | New plan created or duplicated |
| `PlanUpdated` | Any field changed |
| `PlanDeleted` | Plan permanently removed |
| `PlanActivated` | Plan made available for sale |
| `PlanDeactivated` | Plan removed from sale |

### Plan Architecture

```
src/billing/plans/
  PlanTypes.ts        — BillingPlan interface, CreatePlanInput, UpdatePlanInput, SupportLevel
  PlanRepository.ts   — Prisma CRUD (findAll, findById, findByCode, create, update, remove...)
  PlanValidation.ts   — PlanValidationError + validateCreate/Update/Delete
  PlanEvents.ts       — 5 EventBus emitters
  PlanService.ts      — Business logic facade with audit logging
  PlanCatalogService.ts — (unchanged) wraps hardcoded PLAN_DEFINITIONS for tenant lifecycle
```

### SuperAdmin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/superadmin/billing/plans` | GET | List all plans (filter: `?isActive=true`) |
| `/api/superadmin/billing/plans/:id` | GET | Get plan by ID |
| `/api/superadmin/billing/plans` | POST | Create plan |
| `/api/superadmin/billing/plans/:id` | PATCH | Update plan |
| `/api/superadmin/billing/plans/:id` | DELETE | Delete plan (with guards) |
| `/api/superadmin/billing/plans/:id/duplicate` | POST | Duplicate plan |
| `/api/superadmin/billing/plans/:id/activate` | POST | Activate plan |
| `/api/superadmin/billing/plans/:id/deactivate` | POST | Deactivate plan |
| `/api/superadmin/billing/plans/:id/set-default` | POST | Set as default |

**Note:** The old `/api/superadmin/billing/plans` routes (listing hardcoded PLAN_DEFINITIONS) were renamed to `/api/superadmin/billing/plan-catalog`.

### SuperAdmin UI

Route: `/superadmin/billing/plans`

Features:
- Table view: Name, Code, Monthly Price, Feature badges (MP/AUTO/CERT/API), Status, Default badge, Actions
- Actions per row: Edit, Duplicate, Activate/Deactivate, Set Default, Delete
- Create/Edit modal with full form (18 fields)
- Client-side search by name or code
- Arabic default UI, RTL-aware

### Future: Subscription Integration (Sprint K2)

In Sprint K2, `BillingSubscription` will link tenants to `BillingPlan.code`. The QuotaService will then read limits from `BillingPlan` (DB) instead of PLAN_DEFINITIONS (hardcoded). A tenant's feature access will be resolved from their active BillingSubscription → BillingPlan → feature flags.

---

## Invoice Lifecycle

```
DRAFT ──► PENDING ──► PAID
   │           │
   ▼           ▼
CANCELLED   OVERDUE ──► CANCELLED
                │
                ▼
             REFUNDED
```

Invoice numbers: `BIL-YYYY-NNNNN` (sequential per year).

---

## Subscription Lifecycle

Delegated entirely to `src/tenant/lifecycle/LifecycleService`:
```
PENDING → TRIAL → ACTIVE → GRACE_PERIOD → SUSPENDED → CANCELLED → ARCHIVED
```

`SubscriptionService` adds billing events + notifications on each transition.

---

## Tax Providers

| Provider | Countries | Rate Source |
|----------|-----------|-------------|
| `VATProvider` | MA(20%), SA(15%), AE(5%), SN(18%), FR(20%), DE(19%), GB(20%) | Hardcoded — update as needed |
| `SalesTaxProvider` | US states (CA, NY, TX) | Hardcoded — extend for new states |

To add a new tax regime: add a provider in `src/billing/taxes/providers/` and register it in `TaxService.ts`.

---

## Quota Enforcement

`QuotaService.checkQuota(tenantId, field)` returns:
- `allowed: boolean`
- `current: number`
- `limit: number`
- `percentage: number` (0–100)

When a quota is exceeded:
1. Event emitted: `QuotaExceeded` on EventBus
2. Entry written to `BillingEventLog`
3. Notification sent via `NotificationService` to tenant

---

## Billing Events (7 new PlatformEventNames)

| Event | Trigger |
|-------|---------|
| `SubscriptionCreated` | New subscription or trial start |
| `SubscriptionRenewed` | Renewal or plan upgrade |
| `SubscriptionCancelled` | Cancel action |
| `InvoiceGenerated` | Invoice published (PENDING status) |
| `InvoicePaid` | Payment recorded |
| `QuotaExceeded` | Usage exceeds plan limit |
| `TrialEnding` | Trial period ending soon (cron-triggered) |

---

## APIs

### SuperAdmin

_Subscription endpoints moved to their own table under [Subscription Engine → SuperAdmin API](#superadmin-api) (Sprint K2) — the old tenant-scoped `/subscriptions/:tenantId/*` routes below were removed._

| Endpoint | Description |
|----------|-------------|
| `GET /api/superadmin/billing/plans` | List all plans with pricing |
| `GET /api/superadmin/billing/plans/:plan` | Single plan detail |
| `GET /api/superadmin/billing/invoices` | List invoices (filterable) |
| `GET /api/superadmin/billing/invoices/:id` | Invoice detail |
| `POST /api/superadmin/billing/invoices/generate` | Generate + publish invoice |
| `POST /api/superadmin/billing/invoices/:id/pay` | Record payment |
| `POST /api/superadmin/billing/invoices/:id/cancel` | Cancel invoice |
| `POST /api/superadmin/billing/invoices/mark-overdue` | Mark expired PENDING as OVERDUE |
| `GET /api/superadmin/billing/usage/:tenantId` | Usage summary |
| `GET /api/superadmin/billing/quotas/:tenantId` | All quota statuses |

### Restaurant Admin
| Endpoint | Description |
|----------|-------------|
| `GET /api/billing/plan` | Current subscription + plan features |
| `GET /api/billing/invoices` | Own invoices |
| `GET /api/billing/invoices/:id` | Invoice detail (tenantId guard) |
| `GET /api/billing/usage` | Current period usage |
| `GET /api/billing/limits` | All quota statuses |

---

## Subscription Engine (Sprint K2)

### Overview

`BillingSubscription` is the DB-backed subscription record linking a tenant to a `BillingPlan`. It tracks lifecycle state (TRIAL → ACTIVE → etc.) independently from `TenantProfile` (which tracks platform-level access). The two will be linked in a future sprint.

### Subscription Schema

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | String | The tenant (restaurant/hotel/etc.) identifier |
| `planId` | String | `BillingPlan._id` |
| `planCode` | String | Denormalized plan code (FREE, STARTER…) |
| `planName` | String | Denormalized plan name |
| `status` | String | TRIAL / ACTIVE / GRACE_PERIOD / SUSPENDED / CANCELLED / EXPIRED |
| `startDate` | DateTime | When subscription started |
| `endDate` | DateTime? | Scheduled end date |
| `renewalDate` | DateTime? | Next auto-renewal date |
| `trialEndsAt` | DateTime? | Trial expiry |
| `cancelledAt` | DateTime? | Cancellation timestamp |
| `graceEndsAt` | DateTime? | Grace period end |
| `autoRenew` | Boolean | Auto-renew flag |
| `notes` | String? | Admin notes |

### Subscription Lifecycle

```
TRIAL ──────────────► ACTIVE ──────► GRACE_PERIOD ──► ACTIVE
  │                     │                 │
  │                     ▼                 ▼
  ├──► CANCELLED     SUSPENDED ──────► CANCELLED
  │       (terminal)     │
  └──► EXPIRED           └──► CANCELLED
          (terminal)
```

Valid transitions enforced by `SubscriptionValidation.assertTransition()`:
- `TRIAL` → ACTIVE, CANCELLED, EXPIRED
- `ACTIVE` → GRACE_PERIOD, SUSPENDED, CANCELLED, EXPIRED
- `GRACE_PERIOD` → ACTIVE, SUSPENDED, CANCELLED
- `SUSPENDED` → ACTIVE, CANCELLED
- `CANCELLED`, `EXPIRED` — terminal (no further transitions)

**Business rules:**
- One active subscription per tenant (TRIAL/ACTIVE/GRACE_PERIOD/SUSPENDED)
- Trial cannot be restarted on an existing subscription
- Cannot modify a CANCELLED or EXPIRED subscription
- Plan change allowed in any non-terminal state

### Subscription Architecture

```
src/billing/subscriptions/
  SubscriptionTypes.ts         — BillingSubscription, SubscriptionStatus, SubscriptionWithPlan
  SubscriptionRepository.ts    — Prisma CRUD + findActiveByTenant + findLatestByTenant +
                                  findWithPlan + countByPlan + scheduler finders
                                  (findTrialsEndingWithin/findExpiredTrials/findLapsedActive/
                                  findExpiredGracePeriods)
  SubscriptionValidation.ts    — SubscriptionError + assertTransition + assertOneActive
  SubscriptionLifecycle.ts     — activate, renew, suspend, resume, cancel, expire,
                                  enterGracePeriod, changePlan
  SubscriptionEvents.ts        — 8 EventBus emitters (adds emitTrialEnding)
  SubscriptionService.ts       — Full facade with audit logging, plus
                                  isAccessAllowed/isCafeAccessAllowed (Access Control, Phase 1)
src/billing/scheduler/
  SubscriptionScheduler.ts     — K48: the real automatic-lifecycle sweep (see below)
```

Notifications are **not** sent from `src/billing/subscriptions/*` directly. Every
lifecycle transition emits an event via `SubscriptionEvents.ts`, and
`BillingEventNotificationHub.ts` (`src/billing/notifications/`) is the single
subscriber that turns those events into `NotificationService` calls. This keeps
exactly one notification per event — do not add a second notification call
alongside an event emit.

### Subscription Events (4 new + reuses 3 from Epic K)

| Event | When |
|-------|------|
| `SubscriptionCreated` | New subscription created (trial or active) |
| `SubscriptionActivated` | Transition to ACTIVE state |
| `SubscriptionRenewed` | Renewal processed |
| `SubscriptionSuspended` | Suspended by SuperAdmin |
| `SubscriptionCancelled` | Cancelled by tenant or SA |
| `SubscriptionExpired` | Auto-expired (cron job) |
| `PlanChanged` | Plan upgraded or downgraded |

### SuperAdmin API

These routes live in `src/routes/billingSubscriptionsSA.ts` and are the sole canonical implementation (the old tenant-scoped subscription routes were removed from `billingSuperAdmin.ts`).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/superadmin/billing/subscriptions` | GET | List subscriptions (filter: status, tenantId, planCode) |
| `/api/superadmin/billing/subscriptions/:id` | GET | Subscription detail |
| `/api/superadmin/billing/subscriptions` | POST | Create trial or active subscription |
| `/api/superadmin/billing/subscriptions/:id` | PATCH | Update notes |
| `/api/superadmin/billing/subscriptions/:id/activate` | POST | Activate |
| `/api/superadmin/billing/subscriptions/:id/suspend` | POST | Suspend |
| `/api/superadmin/billing/subscriptions/:id/resume` | POST | Resume |
| `/api/superadmin/billing/subscriptions/:id/cancel` | POST | Cancel |
| `/api/superadmin/billing/subscriptions/:id/renew` | POST | Renew |
| `/api/superadmin/billing/subscriptions/:id/change-plan` | POST | Change plan (body: planId) |

### Restaurant API

| Endpoint | Description |
|----------|-------------|
| `GET /api/billing/subscription` | Current subscription with plan details |
| `GET /api/billing/subscription/status` | Quick status check |
| `GET /api/billing/subscription/history` | Full subscription history |

### Automatic Lifecycle Scheduling (K48 Scheduler — built)

`SubscriptionLifecycleJobs.ts` (the old TenantProfile-era cron module) and
`src/cron/subscriptionLifecycle.ts` were **deleted outright** — not resurrected
— per the K48 decision to build a real scheduler rather than reuse the old
shape. The real scheduler is:

- **`src/billing/scheduler/SubscriptionScheduler.ts`** — 4 sweep functions,
  each calling real `SubscriptionService`/`SubscriptionLifecycle` transitions
  (which already fire their own event/audit/notification via
  `BillingEventNotificationHub` — nothing new to wire):
  1. `runTrialEndingReminders(warnDays=3)` — `SubscriptionRepository.findTrialsEndingWithin` → `SubscriptionEvents.emitTrialEnding` (reuses the pre-existing `'TrialEnding'` event/payload shape the hub already subscribes to).
  2. `runTrialExpirationCheck()` — `findExpiredTrials` → `SubscriptionService.enterGracePeriod` (TRIAL → GRACE_PERIOD).
  3. `runActiveLapseCheck()` — `findLapsedActive` (ACTIVE subscriptions whose `renewalDate` has passed) → `SubscriptionService.enterGracePeriod` (ACTIVE → GRACE_PERIOD).
  4. `runGracePeriodExpirationCheck()` — `findExpiredGracePeriods` → `SubscriptionService.suspend(id, 'Grace period expired', 'system:scheduler')`.
  - `runSubscriptionLifecycleSweep()` orchestrates all 4, returns `{ remindersSent, enteredGrace, suspended }`.
- **`src/cron/subscriptionSchedulerCron.ts`** — registers the sweep on `'0 3 * * *'` (same daily 03:00 slot the old disabled cron used), wired into `src/server.ts`'s `cronTasks` array as `startSubscriptionSchedulerCron()`.

**Phase 1 scope only — not yet automatic:**
- No auto-`cancel()`/auto-`expire()` (terminal states) — a subscription that
  lapses through `GRACE_PERIOD` currently stops at `SUSPENDED` and needs a
  manual SA action to reach `CANCELLED`/`EXPIRED`.
- No payment-triggered auto-renew — `BillingPaymentService`
  (`src/billing/payments/`) already links payments to subscriptions, but
  isn't wired into this sweep yet.

Both remain manually available via the SuperAdmin API
(`/api/superadmin/billing/subscriptions/:id/{activate,suspend,resume,cancel,
renew,change-plan}`).

### Access Control (Phase 1) — Tenant Access Migration

`BillingSubscription` is becoming the platform's access-control authority,
replacing the historical `Cafe.isActive`/`Cafe.billingStatus` wallet/debt
system (see § Relationship to src/tenant/ above — `TenantProfile.state` was
never actually the real gate; `Cafe.isActive` was). This is an **additive,
fail-open** first phase, not a cutover.

**The gate** (`src/billing/subscriptions/SubscriptionService.ts`):
```ts
export async function isAccessAllowed(tenantId: string): Promise<boolean>
export async function isCafeAccessAllowed(cafeId: string, cafeIsActive: boolean): Promise<boolean>
```
- Allowed statuses: `TRIAL`, `ACTIVE`, `GRACE_PERIOD`. Blocked: `SUSPENDED`,
  `CANCELLED`, `EXPIRED`.
- **Fail-open by design**: a tenant with no `BillingSubscription` row at all
  (pre-backfill, or a race right after `CafeCreated`) is allowed, not blocked.
  Uses `SubscriptionRepository.findLatestByTenant` (sees terminal rows too),
  not `findActiveByTenant` (which would make a genuinely `CANCELLED` tenant
  indistinguishable from a never-provisioned one).
- `isCafeAccessAllowed` combines the new gate with the existing
  `Cafe.isActive` check (AND — blocked if either says blocked) and requires
  `cafeIsActive` as an explicit argument so call sites can't accidentally drop
  the existing check. **Before backfill has run for a tenant, this degrades to
  today's exact behavior** (`cafe.isActive` alone).

**Wired (7 call sites across 4 files — the confirmed-real access gates):**
`src/middleware/validateSeatQR.ts` (1), `src/routes/publicCafe.ts` (2),
`src/routes/clientMenu.ts` (2), `src/routes/customers.ts` (2).

**Auto-provisioning:** every new `Cafe` now gets a `BillingSubscription`
automatically via the `CafeCreated` event handler in `src/tenant/index.ts`
(mirrors the pre-existing `TenantProfile` auto-provisioning there), starting
`TRIAL` against `PlanRepository.findDefault()`'s plan.

**Nightly `TenantProfile` lifecycle sweep removed:** `src/cron/nightly.ts`'s
`notifyExpiringTrials`/`expireTrials`/`expireGracePeriods`/
`cleanupExpiredPromotions` block was deleted (confirmed zero other callers,
near-zero real enforcement — see the "Relationship to src/tenant/" note
above). Automatic lifecycle processing now flows through the K48 Scheduler
above instead.

### Backfill

`scripts/backfillBillingSubscriptions.ts` creates a `BillingSubscription` for
every existing `Cafe` that doesn't have one yet (checked via
`findLatestByTenant`, so cafes with a terminal row are correctly skipped, not
double-created).

| Cafe.isActive | Cafe.billingStatus | → BillingSubscription.status |
|---|---|---|
| true | GRACE_PERIOD | TRIAL |
| true | COLLECTING_DEBT | ACTIVE |
| true | PAST_DUE | GRACE_PERIOD |
| false | any | SUSPENDED |

- `planId`/`planCode`/`planName` = `PlanRepository.findDefault()`'s plan for
  every backfilled row — Phase 1 has no source to map `Cafe.packageType` to a
  real plan code (Phase 2).
- Defaults to `--dry-run` (reads + logs the proposed mapping, writes nothing).
  Requires an explicit `--commit` flag to actually create rows.
- Aborts loudly if no default `BillingPlan` exists — both this script and the
  `CafeCreated` auto-provisioning hook depend on one.
- Deliberately does **not** emit `SubscriptionCreated` events for backfilled
  rows (would spam every real tenant's dashboard with a synthetic
  notification) — logs a summary locally instead.
- Never run automatically (not in server boot, cron, or CI). Run via
  `npm run backfill:billing-subscriptions -- --commit` only after manual
  review of a `--dry-run` pass.

### Phase 2 (not yet built)

Explicitly deferred from the Tenant Access Migration, to keep Phase 1 bounded
and reviewable on a shared demo/staging database with no isolated dev DB:

- **11 `Cafe.isActive`/`billingStatus` write sites** — 3 signup flows in
  `src/routes/auth.ts`, `src/routes/demoRequests.ts` (demo conversion),
  3 self-service endpoints in `src/routes/finance.ts`, 4 manual SA endpoints
  in `src/routes/superadmin.ts`. These still write the wallet/debt fields
  independently of `BillingSubscription` — not yet unified.
- **~6 additional read sites** that may also gate on `Cafe.isActive`:
  `src/routes/payment.ts`, `src/routes/traiteur.ts`,
  `src/routes/whatsappWebhook.ts`, `src/routes/tables.ts`,
  `src/routes/orders.ts`, `src/routes/antiFraud.ts`. Each needs its own
  read-through before wiring — not a blind copy of the Phase 1 pattern (some
  of these may be display-only, not actually blocking).
- Retiring `Cafe.walletBalance`/`billingStatus`/`gracePeriodEndsAt`/
  `suspendedAt`/`trialEndsAt`/`hasExtendedTrial` once all writers/readers are
  migrated.
- Disabling/deleting `src/cron/dailyDebtDetection.ts` (still the only thing
  keeping `Cafe.isActive` correct for the write/read sites not yet migrated —
  do not remove before they are).
- Unifying `/api/superadmin/tenants/:id/suspend` (`TenantProfile`-based) with
  `billingSubscriptionsSA.ts`'s BillingSubscription-based suspend into one
  SuperAdmin action.
- Mapping `Cafe.packageType` ('Free'/'6-Month'/'Annual') to real `BillingPlan`
  codes for a more accurate backfill than "everyone gets the default plan".

### Future: Invoice Integration (Sprint K3)

In Sprint K3, subscription renewals will automatically trigger invoice generation via `BillingOrchestrator.generateInvoice()`. The `renewalDate` field will be used by a cron job to generate invoices 3 days before renewal.

---

## Extension Guide

### Add a new tax provider

1. Create `src/billing/taxes/providers/NewTaxProvider.ts`
2. Export `calculateNewTax(subtotal, region): { taxRate, taxAmount, total }`
3. Add a new `TaxType` variant in `src/billing/types/index.ts`
4. Register in `TaxService.calculateTax()` switch

### Add a new billing event

1. Add to `BillingEventType` in `src/billing/types/index.ts`
2. Add to `PlatformEventName` in `src/core/types/index.ts`
3. Add `emit*()` function in `src/billing/events/BillingEvents.ts`

### Integrate billing in a new SaaS module (e.g. Hotel)

```typescript
import { subscriptions, generateInvoice, quotas } from 'src/billing'

// On hotel creation:
await subscriptions.startTrialSubscription(hotelId, 'HOTEL', 'STARTER')

// On AI usage:
await usage.trackUsage(hotelId, 'HOTEL', 'aiRequests')

// Check quota before expensive operation:
const ok = await quotas.isAllowed(hotelId, 'aiRequests')
if (!ok) return res.status(429).json({ error: 'AI quota exceeded' })
```
