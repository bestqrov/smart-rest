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
