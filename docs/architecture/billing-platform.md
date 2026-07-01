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

## Relationship to src/tenant/

`src/billing/` is a THIN LAYER on top of `src/tenant/`. It does NOT duplicate:
- Plan definitions → use `src/tenant/plans/PLAN_DEFINITIONS`
- Usage snapshots → use `src/tenant/usage/UsageService`
- Lifecycle transitions → use `src/tenant/lifecycle/LifecycleService`
- Suspension → use `src/tenant/suspension/SuspensionService`

`src/billing/` ADDS:
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
| Endpoint | Description |
|----------|-------------|
| `GET /api/superadmin/billing/plans` | List all plans with pricing |
| `GET /api/superadmin/billing/plans/:plan` | Single plan detail |
| `GET /api/superadmin/billing/subscriptions/:tenantId` | Tenant subscription state |
| `POST /api/superadmin/billing/subscriptions/:tenantId/plan` | Change tenant plan |
| `POST /api/superadmin/billing/subscriptions/:tenantId/cancel` | Cancel subscription |
| `POST /api/superadmin/billing/subscriptions/:tenantId/suspend` | Suspend subscription |
| `POST /api/superadmin/billing/subscriptions/:tenantId/reactivate` | Reactivate |
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
  SubscriptionRepository.ts    — Prisma CRUD + findActiveByTenant + findWithPlan + countByPlan
  SubscriptionValidation.ts    — SubscriptionError + assertTransition + assertOneActive
  SubscriptionLifecycle.ts     — activate, renew, suspend, resume, cancel, expire, changePlan
  SubscriptionEvents.ts        — 7 EventBus emitters
  SubscriptionNotifications.ts — 5 NotificationService calls
  SubscriptionService.ts       — Full facade with audit logging
```

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

> Note: these routes live in `src/routes/billingSubscriptionsSA.ts` and are the sole canonical implementation. Earlier tenant-scoped subscription routes (`/subscriptions/:tenantId`, `.../plan`, `.../suspend`, `.../reactivate`) documented under "Existing Billing Platform APIs" above were removed in commit `16c8c5e` (route-shadowing fix) and are superseded by this table.

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
