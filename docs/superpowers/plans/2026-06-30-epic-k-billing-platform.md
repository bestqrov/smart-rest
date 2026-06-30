# Epic K — SmartSuite Billing Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `src/billing/` platform engine that every SmartSuite product can use for subscription management, invoice generation, quota enforcement, tax abstraction, and billing notifications — without replacing existing commission-based billing.

**Architecture:** `src/billing/` is a thin financial layer on top of the existing `src/tenant/` Lifecycle Engine. It does NOT duplicate plan definitions, usage tracking, or lifecycle transitions — it wraps them and adds: platform invoices, tax calculation, quota enforcement middleware, billing events, and billing-specific APIs. A new `BillingPlatformInvoice` Prisma model (distinct from the existing commission-based `BillingInvoice`) stores subscription invoices with `tenantId` (not cafeId FK) making it reusable across Restaurant, Hotel, Clinic, Retail.

**Tech Stack:** TypeScript, Prisma 4 (MongoDB), Express 5, `src/tenant/` (PLAN_DEFINITIONS, UsageService, LifecycleService), `src/core/` (EventBus, NotificationService, AuditService), existing `PlatformEventName` union extended with 7 new billing events.

---

## What Already Exists (DO NOT REBUILD)

| What | Location | Status |
|------|----------|--------|
| Plan types: FREE/STARTER/PROFESSIONAL/ENTERPRISE/CUSTOM | `src/tenant/types/index.ts` | ✅ |
| PLAN_DEFINITIONS (modules, limits, features) | `src/tenant/plans/index.ts` | ✅ |
| TenantProfile (state, plan, trial, grace, suspended) | `prisma/schema.prisma` + `src/tenant/` | ✅ |
| TenantUsageSnapshot (aiRequests, storage, users…) | `prisma/schema.prisma` + `src/tenant/usage/UsageService.ts` | ✅ |
| LifecycleService (activate, startTrial, assignPlan…) | `src/tenant/lifecycle/LifecycleService.ts` | ✅ |
| SuspensionService | `src/tenant/suspension/SuspensionService.ts` | ✅ |
| ProvisioningService | `src/tenant/provisioning/ProvisioningService.ts` | ✅ |
| BillingInvoice model (commission-based, cafeId FK) | `prisma/schema.prisma` | ✅ keep as-is |
| PremiumPlan model (per-country pricing) | `prisma/schema.prisma` | ✅ used by PlanCatalogService |
| EventBus.publish() | `src/core/events/EventBus.ts` | ✅ |
| NotificationService.createNotification() | `src/core/notifications/NotificationService.ts` | ✅ |
| AuditService | `src/core/audit/AuditService.ts` | ✅ |
| PlatformEventName type | `src/core/types/index.ts` | ✅ extend only |

---

## New Files Created in This Plan

```
src/billing/
  types/index.ts                          — all billing-specific types
  plans/
    PlanCatalogService.ts                 — wraps PLAN_DEFINITIONS + regional pricing
  subscriptions/
    SubscriptionService.ts                — wraps lifecycle + fires billing events
  invoices/
    InvoiceNumberService.ts               — generates BIL-YYYY-NNNNN unique numbers
    InvoiceService.ts                     — create/update/list platform invoices
  quotas/
    QuotaService.ts                       — check/enforce per-plan limits
  usage/
    BillingUsageService.ts                — thin wrapper adding billing context
  taxes/
    TaxService.ts                         — provider abstraction
    providers/VATProvider.ts              — VAT implementation
    providers/SalesTaxProvider.ts         — Sales Tax implementation
  events/
    BillingEvents.ts                      — publish 7 billing events to EventBus
  notifications/
    BillingNotifications.ts               — send billing notifications via NotificationService
  services/
    BillingOrchestrator.ts                — high-level facade used by routes
  index.ts                                — public API

src/routes/
  billingSuperAdmin.ts                    — SA: plans, subscriptions, invoices, usage
  billingRestaurant.ts                    — Restaurant: plan, invoices, usage, limits

docs/architecture/billing-platform.md    — architecture documentation
```

**Prisma additions (2 new models + 1 extended type):**
- `BillingPlatformInvoice` — platform subscription invoices (tenantId, not cafeId FK)
- `BillingEventLog` — billing event audit trail
- Add `certificates Int @default(0)` to `TenantUsageSnapshot`

**`src/core/types/index.ts` additions (extend PlatformEventName union):**
- `'SubscriptionCreated'`
- `'SubscriptionRenewed'`
- `'SubscriptionCancelled'`
- `'InvoiceGenerated'`
- `'InvoicePaid'`
- `'QuotaExceeded'`
- `'TrialEnding'`

---

## Task 1 — Types, Prisma Schema, and PlatformEventName

**Files:**
- Create: `src/billing/types/index.ts`
- Modify: `prisma/schema.prisma` (add 2 models + 1 field)
- Modify: `src/core/types/index.ts` (extend PlatformEventName)

- [ ] **Step 1: Create `src/billing/types/index.ts`**

```typescript
// ─── Billing Platform — Types ──────────────────────────────────────────────

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'

export type TaxType = 'VAT' | 'SALES_TAX' | 'NONE'

export type BillingEventType =
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PAID'
  | 'QUOTA_EXCEEDED'
  | 'TRIAL_ENDING'

export interface PlatformInvoice {
  id:            string
  invoiceNumber: string
  tenantId:      string
  module:        string           // RESTAURANT | HOTEL | CLINIC | RETAIL
  plan:          string
  status:        InvoiceStatus
  subtotal:      number
  taxAmount:     number
  taxType:       TaxType
  taxRate:       number
  total:         number
  currency:      string
  periodStart:   Date
  periodEnd:     Date
  dueDate:       Date
  paidAt?:       Date
  notes?:        string
  metadata?:     Record<string, unknown>
  createdAt:     Date
  updatedAt:     Date
}

export interface TaxCalculation {
  subtotal:  number
  taxType:   TaxType
  taxRate:   number           // percentage 0–100
  taxAmount: number
  total:     number
  currency:  string
}

export interface QuotaCheckResult {
  allowed:    boolean
  field:      string
  current:    number
  limit:      number
  percentage: number          // 0–100
  message?:   string
}

export interface BillingEventPayload {
  tenantId:  string
  module:    string
  plan?:     string
  invoiceId?: string
  field?:    string           // for QuotaExceeded
  metadata?: Record<string, unknown>
}
```

- [ ] **Step 2: Add `BillingPlatformInvoice` and `BillingEventLog` models to `prisma/schema.prisma`**

  Append after the `TenantSuspensionLog` model (around line 2115):

```prisma
// ─── Billing Platform — Platform Invoices (subscription-based, tenant-scoped) ─

model BillingPlatformInvoice {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  invoiceNumber String    @unique           // BIL-YYYY-NNNNN
  tenantId      String
  module        String    @default("RESTAURANT") // RESTAURANT | HOTEL | CLINIC | RETAIL
  plan          String                      // FREE | STARTER | PROFESSIONAL | ENTERPRISE | CUSTOM
  status        String    @default("DRAFT") // DRAFT | PENDING | PAID | OVERDUE | CANCELLED | REFUNDED
  subtotal      Float
  taxAmount     Float     @default(0)
  taxType       String    @default("NONE")  // VAT | SALES_TAX | NONE
  taxRate       Float     @default(0)
  total         Float
  currency      String    @default("MAD")
  periodStart   DateTime
  periodEnd     DateTime
  dueDate       DateTime
  paidAt        DateTime?
  notes         String?
  metadata      String?   // JSON
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([tenantId, status])
  @@index([dueDate])
  @@map("billing_platform_invoices")
}

// ─── Billing Platform — Event Log ─────────────────────────────────────────────

model BillingEventLog {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String
  type      String                        // BillingEventType
  module    String   @default("RESTAURANT")
  payload   String                        // JSON
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([type])
  @@index([createdAt])
  @@map("billing_event_logs")
}
```

  Also add `certificates Int @default(0)` to `TenantUsageSnapshot` (find the model and add after `automations`):
```prisma
  automations        Int      @default(0)
  certificates       Int      @default(0)
```

- [ ] **Step 3: Extend `PlatformEventName` in `src/core/types/index.ts`**

  Find the `PlatformEventName` type (line ~158) and add after `'TenantGracePeriodStarted'`:
  ```typescript
  // Billing Platform Engine
  | 'SubscriptionCreated'
  | 'SubscriptionRenewed'
  | 'SubscriptionCancelled'
  | 'InvoiceGenerated'
  | 'InvoicePaid'
  | 'QuotaExceeded'
  | 'TrialEnding'
  ```

- [ ] **Step 4: Run Prisma generate**

  ```bash
  cd "/Users/mac/Documents/SaaS restau" && npx prisma generate
  ```
  Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
  ```
  Expected: no output.

- [ ] **Step 6: Commit**

  ```bash
  git add src/billing/types/index.ts prisma/schema.prisma src/core/types/index.ts
  git commit -m "feat(billing): types, schema models (BillingPlatformInvoice, BillingEventLog), and 7 new PlatformEventNames"
  ```

---

## Task 2 — InvoiceNumberService + InvoiceService

**Files:**
- Create: `src/billing/invoices/InvoiceNumberService.ts`
- Create: `src/billing/invoices/InvoiceService.ts`

- [ ] **Step 1: Create `src/billing/invoices/InvoiceNumberService.ts`**

```typescript
// ─── Billing Platform — Invoice Number Generator ───────────────────────────

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export async function generateInvoiceNumber(): Promise<string> {
  const prisma = await getPrisma()
  const year   = new Date().getUTCFullYear()
  const count  = await (prisma as any).billingPlatformInvoice.count({
    where: { invoiceNumber: { startsWith: `BIL-${year}-` } },
  })
  const seq = String(count + 1).padStart(5, '0')
  return `BIL-${year}-${seq}`
}
```

- [ ] **Step 2: Create `src/billing/invoices/InvoiceService.ts`**

```typescript
// ─── Billing Platform — Invoice Service ────────────────────────────────────

import type { InvoiceStatus, PlatformInvoice } from '../types'
import { generateInvoiceNumber }               from './InvoiceNumberService'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

function toInvoice(row: any): PlatformInvoice {
  return {
    id:            row.id,
    invoiceNumber: row.invoiceNumber,
    tenantId:      row.tenantId,
    module:        row.module,
    plan:          row.plan,
    status:        row.status as InvoiceStatus,
    subtotal:      row.subtotal,
    taxAmount:     row.taxAmount,
    taxType:       row.taxType,
    taxRate:       row.taxRate,
    total:         row.total,
    currency:      row.currency,
    periodStart:   row.periodStart,
    periodEnd:     row.periodEnd,
    dueDate:       row.dueDate,
    paidAt:        row.paidAt ?? undefined,
    notes:         row.notes ?? undefined,
    metadata:      row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt:     row.createdAt,
    updatedAt:     row.updatedAt,
  }
}

export async function createInvoice(input: {
  tenantId:    string
  module:      string
  plan:        string
  subtotal:    number
  taxAmount:   number
  taxType:     string
  taxRate:     number
  total:       number
  currency:    string
  periodStart: Date
  periodEnd:   Date
  dueDate:     Date
  notes?:      string
  metadata?:   Record<string, unknown>
}): Promise<PlatformInvoice> {
  const prisma        = await getPrisma()
  const invoiceNumber = await generateInvoiceNumber()
  const row           = await (prisma as any).billingPlatformInvoice.create({
    data: {
      invoiceNumber,
      tenantId:    input.tenantId,
      module:      input.module,
      plan:        input.plan,
      status:      'DRAFT',
      subtotal:    input.subtotal,
      taxAmount:   input.taxAmount,
      taxType:     input.taxType,
      taxRate:     input.taxRate,
      total:       input.total,
      currency:    input.currency,
      periodStart: input.periodStart,
      periodEnd:   input.periodEnd,
      dueDate:     input.dueDate,
      notes:       input.notes,
      metadata:    input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  })
  return toInvoice(row)
}

export async function publishInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'PENDING' },
  })
  return toInvoice(row)
}

export async function markPaid(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'PAID', paidAt: new Date() },
  })
  return toInvoice(row)
}

export async function markOverdue(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'OVERDUE' },
  })
  return toInvoice(row)
}

export async function cancelInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'CANCELLED' },
  })
  return toInvoice(row)
}

export async function refundInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'REFUNDED' },
  })
  return toInvoice(row)
}

export async function getInvoice(id: string): Promise<PlatformInvoice | null> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.findUnique({ where: { id } })
  return row ? toInvoice(row) : null
}

export async function listInvoices(filter: {
  tenantId?:  string
  status?:    InvoiceStatus
  module?:    string
  page?:      number
  limit?:     number
}): Promise<{ invoices: PlatformInvoice[]; total: number; page: number; pages: number }> {
  const prisma = await getPrisma()
  const page   = Math.max(1, filter.page  ?? 1)
  const limit  = Math.min(100, filter.limit ?? 20)
  const skip   = (page - 1) * limit
  const where: Record<string, unknown> = {}
  if (filter.tenantId) where.tenantId = filter.tenantId
  if (filter.status)   where.status   = filter.status
  if (filter.module)   where.module   = filter.module

  const [rows, total] = await Promise.all([
    (prisma as any).billingPlatformInvoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    (prisma as any).billingPlatformInvoice.count({ where }),
  ])
  return { invoices: rows.map(toInvoice), total, page, pages: Math.ceil(total / limit) }
}

// Mark all PENDING invoices past dueDate as OVERDUE (called by cron)
export async function markOverdueInvoices(): Promise<number> {
  const prisma = await getPrisma()
  const result = await (prisma as any).billingPlatformInvoice.updateMany({
    where: { status: 'PENDING', dueDate: { lt: new Date() } },
    data:  { status: 'OVERDUE' },
  })
  return result.count
}
```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/invoices"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/billing/invoices/
  git commit -m "feat(billing): InvoiceNumberService + InvoiceService (BIL-YYYY-NNNNN, full lifecycle)"
  ```

---

## Task 3 — PlanCatalogService

Wraps `src/tenant/plans/` and enriches with regional pricing from the `PremiumPlan` collection.

**Files:**
- Create: `src/billing/plans/PlanCatalogService.ts`

- [ ] **Step 1: Create `src/billing/plans/PlanCatalogService.ts`**

```typescript
// ─── Billing Platform — Plan Catalog Service ───────────────────────────────
// Wraps src/tenant/plans + adds per-region pricing from PremiumPlan collection.

import { PLAN_DEFINITIONS, getPlan, listPlans } from '../../tenant/plans'
import type { Plan, PlanDefinition }             from '../../tenant/types'

export type { Plan, PlanDefinition }

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export interface PlanWithPricing extends PlanDefinition {
  pricing: Record<string, { price: number; currency: string }>  // country → price
}

export async function getPlanWithPricing(plan: Plan): Promise<PlanWithPricing> {
  const prisma = await getPrisma()
  const def    = getPlan(plan)

  const premiumRows = await (prisma as any).premiumPlan.findMany({})
  const pricing: Record<string, { price: number; currency: string }> = {}
  for (const row of premiumRows) {
    pricing[row.country] = { price: row.monthlyPrice, currency: row.currency }
  }

  return { ...def, pricing }
}

export async function listPlansWithPricing(): Promise<PlanWithPricing[]> {
  const plans = listPlans()
  return Promise.all(plans.map(p => getPlanWithPricing(p.name)))
}

export async function getPriceForTenant(
  plan: Plan,
  country: string,
): Promise<{ price: number; currency: string } | null> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).premiumPlan.findUnique({ where: { country } })
  if (!row) return null
  // FREE plan is always 0
  if (plan === 'FREE') return { price: 0, currency: row.currency }
  return { price: row.monthlyPrice, currency: row.currency }
}

// Re-export tenant plan helpers for convenience
export { getPlan, listPlans, PLAN_DEFINITIONS }
```

- [ ] **Step 2: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/plans"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/billing/plans/
  git commit -m "feat(billing): PlanCatalogService — wraps tenant plans with regional pricing"
  ```

---

## Task 4 — TaxService + Providers

**Files:**
- Create: `src/billing/taxes/providers/VATProvider.ts`
- Create: `src/billing/taxes/providers/SalesTaxProvider.ts`
- Create: `src/billing/taxes/TaxService.ts`

- [ ] **Step 1: Create `src/billing/taxes/providers/VATProvider.ts`**

```typescript
// ─── Billing Platform — VAT Provider ──────────────────────────────────────

// Standard VAT rates by country code (ISO 3166-1 alpha-2)
const VAT_RATES: Record<string, number> = {
  MA: 20,   // Morocco
  SA: 15,   // Saudi Arabia
  AE: 5,    // UAE
  SN: 18,   // Senegal
  FR: 20,   // France
  DE: 19,   // Germany
  GB: 20,   // UK
  DEFAULT: 0,
}

export function getVATRate(country: string): number {
  return VAT_RATES[country.toUpperCase()] ?? VAT_RATES.DEFAULT
}

export function calculateVAT(subtotal: number, country: string): {
  taxRate: number; taxAmount: number; total: number
} {
  const taxRate   = getVATRate(country)
  const taxAmount = +(subtotal * taxRate / 100).toFixed(2)
  return { taxRate, taxAmount, total: +(subtotal + taxAmount).toFixed(2) }
}
```

- [ ] **Step 2: Create `src/billing/taxes/providers/SalesTaxProvider.ts`**

```typescript
// ─── Billing Platform — Sales Tax Provider ────────────────────────────────

const SALES_TAX_RATES: Record<string, number> = {
  US_CA: 8.25,
  US_NY: 8.875,
  US_TX: 6.25,
  DEFAULT: 0,
}

export function getSalesTaxRate(state: string): number {
  return SALES_TAX_RATES[state.toUpperCase()] ?? SALES_TAX_RATES.DEFAULT
}

export function calculateSalesTax(subtotal: number, state: string): {
  taxRate: number; taxAmount: number; total: number
} {
  const taxRate   = getSalesTaxRate(state)
  const taxAmount = +(subtotal * taxRate / 100).toFixed(2)
  return { taxRate, taxAmount, total: +(subtotal + taxAmount).toFixed(2) }
}
```

- [ ] **Step 3: Create `src/billing/taxes/TaxService.ts`**

```typescript
// ─── Billing Platform — Tax Service ──────────────────────────────────────
// Provider abstraction for VAT, Sales Tax, and future regional taxes.

import { calculateVAT }       from './providers/VATProvider'
import { calculateSalesTax }  from './providers/SalesTaxProvider'
import type { TaxCalculation, TaxType } from '../types'

export function calculateTax(
  subtotal: number,
  currency: string,
  country:  string,
  taxType:  TaxType = 'VAT',
): TaxCalculation {
  if (taxType === 'NONE') {
    return { subtotal, taxType: 'NONE', taxRate: 0, taxAmount: 0, total: subtotal, currency }
  }

  if (taxType === 'SALES_TAX') {
    const { taxRate, taxAmount, total } = calculateSalesTax(subtotal, country)
    return { subtotal, taxType, taxRate, taxAmount, total, currency }
  }

  // Default: VAT
  const { taxRate, taxAmount, total } = calculateVAT(subtotal, country)
  return { subtotal, taxType: 'VAT', taxRate, taxAmount, total, currency }
}

export function detectTaxType(country: string): TaxType {
  const US_STATES = ['US_CA', 'US_NY', 'US_TX']
  if (US_STATES.includes(country)) return 'SALES_TAX'
  // Most countries use VAT; extend as needed
  return 'VAT'
}
```

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/tax"
  ```
  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/billing/taxes/
  git commit -m "feat(billing): TaxService + VAT and SalesTax providers"
  ```

---

## Task 5 — QuotaService

**Files:**
- Create: `src/billing/quotas/QuotaService.ts`

- [ ] **Step 1: Create `src/billing/quotas/QuotaService.ts`**

```typescript
// ─── Billing Platform — Quota Service ────────────────────────────────────
// Checks and enforces per-plan usage limits using TenantUsageSnapshot.

import { getUsageSummary }     from '../../tenant/usage/UsageService'
import { getProfile }          from '../../tenant/provisioning/ProvisioningService'
import { getPlan }             from '../../tenant/plans'
import type { QuotaCheckResult } from '../types'
import type { Plan, UsageField }  from '../../tenant/types'

// Map UsageField → limit key in PlanLimits
const FIELD_TO_LIMIT: Record<string, keyof import('../../tenant/types').PlanLimits> = {
  aiRequests:       'aiRequestsPerMonth',
  reservations:     'reservationsPerMonth',
  marketplaceOrders:'marketplaceOrdersPerMonth',
  automations:      'automationExecutionsPerMonth',
  userCount:        'users',
  storageBytes:     'storageGb',   // converted below
}

export async function checkQuota(
  tenantId: string,
  field:    UsageField,
): Promise<QuotaCheckResult> {
  const summary = await getUsageSummary(tenantId)
  const profile = await getProfile(tenantId)
  const plan    = getPlan((profile?.plan ?? 'FREE') as Plan)
  const limits  = { ...plan.limits, ...(profile?.customLimits ?? {}) }

  const limitKey = FIELD_TO_LIMIT[field]
  if (!limitKey) return { allowed: true, field, current: 0, limit: -1, percentage: 0 }

  let current = (summary.usage as any)[field] ?? 0
  let limit   = (limits as any)[limitKey] as number

  // storageBytes uses GB limit — convert
  if (field === 'storageBytes') {
    limit = limit * 1024 * 1024 * 1024
  }

  if (limit <= 0) return { allowed: true, field, current, limit: -1, percentage: 0 }  // unlimited

  const percentage = Math.round((current / limit) * 100)
  const allowed    = current < limit

  return {
    allowed,
    field,
    current,
    limit,
    percentage: Math.min(100, percentage),
    message: allowed ? undefined : `${field} quota exceeded (${current}/${limit})`,
  }
}

export async function checkAllQuotas(
  tenantId: string,
): Promise<Record<string, QuotaCheckResult>> {
  const fields: UsageField[] = [
    'aiRequests', 'reservations', 'marketplaceOrders',
    'automations', 'userCount', 'storageBytes',
  ]
  const results = await Promise.all(
    fields.map(async f => [f, await checkQuota(tenantId, f)] as const),
  )
  return Object.fromEntries(results)
}

export async function isAllowed(
  tenantId: string,
  field:    UsageField,
): Promise<boolean> {
  const result = await checkQuota(tenantId, field)
  return result.allowed
}
```

- [ ] **Step 2: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/quotas"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/billing/quotas/
  git commit -m "feat(billing): QuotaService — per-plan limit enforcement using TenantUsageSnapshot"
  ```

---

## Task 6 — BillingEvents + BillingNotifications

**Files:**
- Create: `src/billing/events/BillingEvents.ts`
- Create: `src/billing/notifications/BillingNotifications.ts`

- [ ] **Step 1: Create `src/billing/events/BillingEvents.ts`**

```typescript
// ─── Billing Platform — Event Publishers ──────────────────────────────────

import { eventBus }             from '../../core'
import type { BillingEventPayload } from '../types'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

async function log(type: string, tenantId: string, module: string, payload: unknown) {
  const prisma = await getPrisma()
  await (prisma as any).billingEventLog.create({
    data: { tenantId, type, module, payload: JSON.stringify(payload) },
  }).catch(() => undefined)  // non-blocking
}

export async function emitSubscriptionCreated(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionCreated', p, 'billing')
  await log('SUBSCRIPTION_CREATED', p.tenantId, p.module, p)
}

export async function emitSubscriptionRenewed(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionRenewed', p, 'billing')
  await log('SUBSCRIPTION_RENEWED', p.tenantId, p.module, p)
}

export async function emitSubscriptionCancelled(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionCancelled', p, 'billing')
  await log('SUBSCRIPTION_CANCELLED', p.tenantId, p.module, p)
}

export async function emitInvoiceGenerated(p: BillingEventPayload): Promise<void> {
  eventBus.publish('InvoiceGenerated', p, 'billing')
  await log('INVOICE_GENERATED', p.tenantId, p.module, p)
}

export async function emitInvoicePaid(p: BillingEventPayload): Promise<void> {
  eventBus.publish('InvoicePaid', p, 'billing')
  await log('INVOICE_PAID', p.tenantId, p.module, p)
}

export async function emitQuotaExceeded(p: BillingEventPayload): Promise<void> {
  eventBus.publish('QuotaExceeded', p, 'billing')
  await log('QUOTA_EXCEEDED', p.tenantId, p.module, p)
}

export async function emitTrialEnding(p: BillingEventPayload): Promise<void> {
  eventBus.publish('TrialEnding', p, 'billing')
  await log('TRIAL_ENDING', p.tenantId, p.module, p)
}
```

- [ ] **Step 2: Create `src/billing/notifications/BillingNotifications.ts`**

```typescript
// ─── Billing Platform — Billing Notifications ─────────────────────────────
// Uses NotificationService from src/core. AR-first, bilingual.

import { NotificationService } from '../../core'

export async function notifyTrialEnding(tenantId: string, daysLeft: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'WARNING',
    title:    daysLeft <= 1 ? 'تنتهي فترة التجربة غداً' : `تنتهي فترة التجربة خلال ${daysLeft} أيام`,
    message:  'قم بترقية خطتك لمواصلة استخدام SmartSuite OS بدون انقطاع.',
    module:   'BILLING',
    targetId: tenantId,
  })
}

export async function notifyInvoiceGenerated(tenantId: string, invoiceNumber: string, total: number, currency: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'INFO',
    title:    `فاتورة جديدة: ${invoiceNumber}`,
    message:  `تم إنشاء فاتورة بمبلغ ${total.toLocaleString()} ${currency}. يرجى المراجعة والدفع قبل تاريخ الاستحقاق.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber, total, currency },
  })
}

export async function notifyInvoicePaid(tenantId: string, invoiceNumber: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    `تم استلام الدفع — ${invoiceNumber}`,
    message:  'شكراً! تم تأكيد دفع الفاتورة بنجاح.',
    module:   'BILLING',
    targetId: tenantId,
    metadata: { invoiceNumber },
  })
}

export async function notifyQuotaExceeded(tenantId: string, field: string, current: number, limit: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    `تجاوزت الحد المسموح: ${field}`,
    message:  `الاستخدام الحالي (${current}) تجاوز الحد المحدد في خطتك (${limit}). قم بالترقية أو تخفيض الاستهلاك.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { field, current, limit },
  })
}

export async function notifySubscriptionSuspended(tenantId: string, reason: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    'تم تعليق الاشتراك',
    message:  `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { reason },
  })
}

export async function notifySubscriptionRenewed(tenantId: string, plan: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تجديد الاشتراك',
    message:  `تم تجديد اشتراكك في خطة ${plan} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { plan },
  })
}
```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/events\|billing/notif"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/billing/events/ src/billing/notifications/
  git commit -m "feat(billing): BillingEvents (EventBus + BillingEventLog) + BillingNotifications"
  ```

---

## Task 7 — SubscriptionService + BillingUsageService

**Files:**
- Create: `src/billing/subscriptions/SubscriptionService.ts`
- Create: `src/billing/usage/BillingUsageService.ts`

- [ ] **Step 1: Create `src/billing/subscriptions/SubscriptionService.ts`**

```typescript
// ─── Billing Platform — Subscription Service ──────────────────────────────
// Wraps src/tenant lifecycle transitions + fires billing events.

import { getProfile, ensureProfile } from '../../tenant/provisioning/ProvisioningService'
import {
  activate, startTrial, assignPlan,
  enterGracePeriod, cancel, archive,
}                                    from '../../tenant/lifecycle/LifecycleService'
import { suspend, reactivate }       from '../../tenant/suspension/SuspensionService'
import {
  emitSubscriptionCreated, emitSubscriptionRenewed,
  emitSubscriptionCancelled,
}                                    from '../events/BillingEvents'
import {
  notifySubscriptionSuspended, notifySubscriptionRenewed,
}                                    from '../notifications/BillingNotifications'
import type { Plan }                 from '../../tenant/types'

export async function createSubscription(
  tenantId: string,
  module:   string,
  plan:     Plan,
): Promise<void> {
  await ensureProfile(tenantId, 'RESTAURANT')
  await assignPlan(tenantId, plan)
  await activate(tenantId)
  await emitSubscriptionCreated({ tenantId, module, plan })
}

export async function startTrialSubscription(
  tenantId: string,
  module:   string,
  plan:     Plan,
): Promise<void> {
  await ensureProfile(tenantId, 'RESTAURANT')
  await assignPlan(tenantId, plan)
  await startTrial(tenantId)
  await emitSubscriptionCreated({ tenantId, module, plan, metadata: { trial: true } })
}

export async function renewSubscription(
  tenantId: string,
  module:   string,
): Promise<void> {
  const profile = await getProfile(tenantId)
  if (!profile) throw new Error(`Tenant ${tenantId} not found`)
  await activate(tenantId)
  await emitSubscriptionRenewed({ tenantId, module, plan: profile.plan })
  await notifySubscriptionRenewed(tenantId, profile.plan)
}

export async function cancelSubscription(
  tenantId: string,
  module:   string,
): Promise<void> {
  const profile = await getProfile(tenantId)
  if (!profile) throw new Error(`Tenant ${tenantId} not found`)
  await cancel(tenantId)
  await emitSubscriptionCancelled({ tenantId, module, plan: profile.plan })
}

export async function suspendSubscription(
  tenantId: string,
  module:   string,
  reason:   string,
  by:       string,
): Promise<void> {
  await suspend(tenantId, 'BILLING', reason, by)
  await notifySubscriptionSuspended(tenantId, reason)
}

export async function reactivateSubscription(
  tenantId: string,
  by:       string,
): Promise<void> {
  await reactivate(tenantId, by)
}

export async function changePlan(
  tenantId: string,
  module:   string,
  newPlan:  Plan,
): Promise<void> {
  await assignPlan(tenantId, newPlan)
  await emitSubscriptionRenewed({ tenantId, module, plan: newPlan, metadata: { planChange: true } })
}

export async function getSubscription(tenantId: string) {
  return getProfile(tenantId)
}
```

- [ ] **Step 2: Create `src/billing/usage/BillingUsageService.ts`**

```typescript
// ─── Billing Platform — Billing Usage Service ─────────────────────────────
// Thin wrapper over src/tenant/usage adding billing context (quota checks + events).

import { increment, syncCounts, getUsageSummary } from '../../tenant/usage/UsageService'
import { checkQuota }                             from '../quotas/QuotaService'
import { emitQuotaExceeded }                      from '../events/BillingEvents'
import { notifyQuotaExceeded }                    from '../notifications/BillingNotifications'
import type { UsageField }                         from '../../tenant/types'

export { getUsageSummary }

export async function trackUsage(
  tenantId: string,
  module:   string,
  field:    UsageField,
  amount    = 1,
): Promise<{ allowed: boolean }> {
  await increment(tenantId, field, amount)

  const quota = await checkQuota(tenantId, field)
  if (!quota.allowed) {
    await emitQuotaExceeded({ tenantId, module, field, metadata: { current: quota.current, limit: quota.limit } }).catch(() => undefined)
    await notifyQuotaExceeded(tenantId, field, quota.current, quota.limit).catch(() => undefined)
    return { allowed: false }
  }
  return { allowed: true }
}

export async function syncAbsoluteCounts(
  tenantId: string,
  counts:   Parameters<typeof syncCounts>[1],
): Promise<void> {
  await syncCounts(tenantId, counts)
}
```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/subscriptions\|billing/usage"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/billing/subscriptions/ src/billing/usage/
  git commit -m "feat(billing): SubscriptionService (wraps lifecycle + events) + BillingUsageService"
  ```

---

## Task 8 — BillingOrchestrator + index.ts

**Files:**
- Create: `src/billing/services/BillingOrchestrator.ts`
- Create: `src/billing/index.ts`

- [ ] **Step 1: Create `src/billing/services/BillingOrchestrator.ts`**

```typescript
// ─── Billing Platform — Billing Orchestrator ──────────────────────────────
// High-level facade. Routes import from here — never from sub-services directly.

import * as PlanCatalog     from '../plans/PlanCatalogService'
import * as Subscriptions   from '../subscriptions/SubscriptionService'
import * as Invoices        from '../invoices/InvoiceService'
import * as Quotas          from '../quotas/QuotaService'
import * as Usage           from '../usage/BillingUsageService'
import * as Taxes           from '../taxes/TaxService'
import * as Events          from '../events/BillingEvents'
import * as Notifications   from '../notifications/BillingNotifications'
import { emitInvoiceGenerated, emitInvoicePaid } from '../events/BillingEvents'
import { notifyInvoiceGenerated, notifyInvoicePaid } from '../notifications/BillingNotifications'
import type { Plan }        from '../../tenant/types'

// ─── Plan operations ──────────────────────────────────────────────────────────

export const plans = PlanCatalog

// ─── Subscription operations ──────────────────────────────────────────────────

export const subscriptions = Subscriptions

// ─── Invoice lifecycle ────────────────────────────────────────────────────────

export const invoices = Invoices

// ─── Generate and publish an invoice in one step ──────────────────────────────

export async function generateInvoice(input: {
  tenantId:    string
  module:      string
  plan:        Plan
  country:     string
  periodStart: Date
  periodEnd:   Date
  dueDate:     Date
  notes?:      string
}): Promise<import('../types').PlatformInvoice> {
  const pricing = await PlanCatalog.getPriceForTenant(input.plan, input.country)
  const subtotal = pricing?.price ?? 0
  const currency = pricing?.currency ?? 'MAD'
  const taxType  = Taxes.detectTaxType(input.country)
  const tax      = Taxes.calculateTax(subtotal, currency, input.country, taxType)

  const invoice = await Invoices.createInvoice({
    tenantId:    input.tenantId,
    module:      input.module,
    plan:        input.plan,
    subtotal:    tax.subtotal,
    taxAmount:   tax.taxAmount,
    taxType:     tax.taxType,
    taxRate:     tax.taxRate,
    total:       tax.total,
    currency,
    periodStart: input.periodStart,
    periodEnd:   input.periodEnd,
    dueDate:     input.dueDate,
    notes:       input.notes,
  })

  const published = await Invoices.publishInvoice(invoice.id)

  await emitInvoiceGenerated({ tenantId: input.tenantId, module: input.module, invoiceId: published.id, plan: input.plan }).catch(() => undefined)
  await notifyInvoiceGenerated(input.tenantId, published.invoiceNumber, published.total, currency).catch(() => undefined)

  return published
}

// ─── Record invoice payment ───────────────────────────────────────────────────

export async function recordPayment(invoiceId: string, tenantId: string, module: string): Promise<import('../types').PlatformInvoice> {
  const paid = await Invoices.markPaid(invoiceId)
  await emitInvoicePaid({ tenantId, module, invoiceId }).catch(() => undefined)
  await notifyInvoicePaid(tenantId, paid.invoiceNumber).catch(() => undefined)
  return paid
}

// ─── Quota check ─────────────────────────────────────────────────────────────

export const quotas = Quotas

// ─── Usage tracking ───────────────────────────────────────────────────────────

export const usage = Usage

// ─── Tax calculation ──────────────────────────────────────────────────────────

export const taxes = Taxes
```

- [ ] **Step 2: Create `src/billing/index.ts`**

```typescript
// ─── Billing Platform — Public API ────────────────────────────────────────
// Import from 'src/billing' in any SmartSuite route or service.
// Never import sub-paths directly — always go through this index.

// Orchestrator (main facade)
export * from './services/BillingOrchestrator'

// Types
export type {
  InvoiceStatus, TaxType, BillingEventType,
  PlatformInvoice, TaxCalculation, QuotaCheckResult, BillingEventPayload,
} from './types'

// Plan catalog
export { getPlanWithPricing, listPlansWithPricing, getPriceForTenant } from './plans/PlanCatalogService'

// Invoice service (direct access for cron jobs)
export { markOverdueInvoices } from './invoices/InvoiceService'

// Quota service (direct access for middleware)
export { checkQuota, checkAllQuotas, isAllowed } from './quotas/QuotaService'

// Notifications (direct access for cron jobs)
export { notifyTrialEnding } from './notifications/BillingNotifications'
```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billing/"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/billing/services/ src/billing/index.ts
  git commit -m "feat(billing): BillingOrchestrator facade + public index.ts"
  ```

---

## Task 9 — SuperAdmin Billing Routes

**Files:**
- Create: `src/routes/billingSuperAdmin.ts`

- [ ] **Step 1: Create `src/routes/billingSuperAdmin.ts`**

```typescript
// ─── Billing Platform — SuperAdmin Routes ─────────────────────────────────

import { Router, Request, Response } from 'express'
import {
  listPlansWithPricing, getPlanWithPricing,
  subscriptions, invoices, quotas, usage,
  generateInvoice, recordPayment,
}                                    from '../billing'
import { markOverdueInvoices }       from '../billing/invoices/InvoiceService'
import type { Plan }                 from '../tenant/types'
import type { InvoiceStatus }        from '../billing/types'

const router = Router()

function requireSA(req: Request, res: Response): boolean {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (secret !== process.env.SUPERADMIN_SECRET || !email) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// ─── Plans ───────────────────────────────────────────────────────────────────

// GET /api/superadmin/billing/plans
router.get('/api/superadmin/billing/plans', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const plans = await listPlansWithPricing()
    res.json({ plans })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/superadmin/billing/plans/:plan
router.get('/api/superadmin/billing/plans/:plan', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await getPlanWithPricing(String(req.params.plan).toUpperCase() as Plan)
    res.json({ plan })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Subscriptions ────────────────────────────────────────────────────────────

// GET /api/superadmin/billing/subscriptions/:tenantId
router.get('/api/superadmin/billing/subscriptions/:tenantId', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await subscriptions.getSubscription(String(req.params.tenantId))
    if (!sub) return res.status(404).json({ error: 'Tenant not found' }) as any
    res.json({ subscription: sub })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST /api/superadmin/billing/subscriptions/:tenantId/plan
router.post('/api/superadmin/billing/subscriptions/:tenantId/plan', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { plan, module = 'RESTAURANT' } = req.body
    if (!plan) return res.status(400).json({ error: 'plan is required' }) as any
    await subscriptions.changePlan(String(req.params.tenantId), module, plan as Plan)
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/subscriptions/:tenantId/cancel
router.post('/api/superadmin/billing/subscriptions/:tenantId/cancel', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { module = 'RESTAURANT' } = req.body
    await subscriptions.cancelSubscription(String(req.params.tenantId), module)
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/subscriptions/:tenantId/suspend
router.post('/api/superadmin/billing/subscriptions/:tenantId/suspend', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { reason = 'Manual suspension', module = 'RESTAURANT' } = req.body
    const by = String(req.headers['x-superadmin-email'])
    await subscriptions.suspendSubscription(String(req.params.tenantId), module, reason, by)
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/subscriptions/:tenantId/reactivate
router.post('/api/superadmin/billing/subscriptions/:tenantId/reactivate', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const by = String(req.headers['x-superadmin-email'])
    await subscriptions.reactivateSubscription(String(req.params.tenantId), by)
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Invoices ─────────────────────────────────────────────────────────────────

// GET /api/superadmin/billing/invoices
router.get('/api/superadmin/billing/invoices', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { tenantId, status, module, page, limit } = req.query
    const result = await invoices.listInvoices({
      tenantId: tenantId as string | undefined,
      status:   status   as InvoiceStatus | undefined,
      module:   module   as string | undefined,
      page:     page     ? Number(page)  : undefined,
      limit:    limit    ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/superadmin/billing/invoices/:id
router.get('/api/superadmin/billing/invoices/:id', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const invoice = await invoices.getInvoice(String(req.params.id))
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' }) as any
    res.json({ invoice })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST /api/superadmin/billing/invoices/generate
router.post('/api/superadmin/billing/invoices/generate', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { tenantId, module = 'RESTAURANT', plan, country, periodStart, periodEnd, dueDate, notes } = req.body
    if (!tenantId || !plan || !country || !periodStart || !periodEnd || !dueDate) {
      return res.status(400).json({ error: 'tenantId, plan, country, periodStart, periodEnd, dueDate are required' }) as any
    }
    const invoice = await generateInvoice({
      tenantId, module, plan, country,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      dueDate:     new Date(dueDate),
      notes,
    })
    res.status(201).json({ invoice })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/invoices/:id/pay
router.post('/api/superadmin/billing/invoices/:id/pay', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { tenantId, module = 'RESTAURANT' } = req.body
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' }) as any
    const invoice = await recordPayment(String(req.params.id), tenantId, module)
    res.json({ invoice })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/invoices/:id/cancel
router.post('/api/superadmin/billing/invoices/:id/cancel', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const invoice = await invoices.cancelInvoice(String(req.params.id))
    res.json({ invoice })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/billing/invoices/mark-overdue (for cron or manual trigger)
router.post('/api/superadmin/billing/invoices/mark-overdue', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const count = await markOverdueInvoices()
    res.json({ marked: count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Usage ───────────────────────────────────────────────────────────────────

// GET /api/superadmin/billing/usage/:tenantId
router.get('/api/superadmin/billing/usage/:tenantId', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const { period } = req.query
    const summary = await usage.getUsageSummary(String(req.params.tenantId), period as string | undefined)
    res.json({ usage: summary })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/superadmin/billing/quotas/:tenantId
router.get('/api/superadmin/billing/quotas/:tenantId', async (req: Request, res: Response) => {
  if (!requireSA(req, res)) return
  try {
    const result = await quotas.checkAllQuotas(String(req.params.tenantId))
    res.json({ quotas: result })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
```

- [ ] **Step 2: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billingSuperAdmin"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/billingSuperAdmin.ts
  git commit -m "feat(billing): SuperAdmin billing routes — plans, subscriptions, invoices, usage, quotas"
  ```

---

## Task 10 — Restaurant Billing Routes

**Files:**
- Create: `src/routes/billingRestaurant.ts`

- [ ] **Step 1: Create `src/routes/billingRestaurant.ts`**

```typescript
// ─── Billing Platform — Restaurant Routes ─────────────────────────────────

import { Router, Request, Response } from 'express'
import jwt                           from 'jsonwebtoken'
import {
  subscriptions, invoices, quotas, usage,
}                                    from '../billing'
import type { InvoiceStatus }        from '../billing/types'

const router = Router()

function requireAuth(req: Request, res: Response): { cafeId: string } | null {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as any
    return { cafeId: String(p.cafeId) }
  } catch { res.status(401).json({ error: 'Invalid token' }); return null }
}

// GET /api/billing/plan — current plan + features
router.get('/api/billing/plan', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const sub = await subscriptions.getSubscription(auth.cafeId)
    res.json({ subscription: sub })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/invoices — list own invoices
router.get('/api/billing/invoices', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const { status, page, limit } = req.query
    const result = await invoices.listInvoices({
      tenantId: auth.cafeId,
      status:   status as InvoiceStatus | undefined,
      page:     page  ? Number(page)  : undefined,
      limit:    limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/invoices/:id — single invoice
router.get('/api/billing/invoices/:id', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const invoice = await invoices.getInvoice(String(req.params.id))
    if (!invoice || invoice.tenantId !== auth.cafeId) {
      return res.status(404).json({ error: 'Invoice not found' }) as any
    }
    res.json({ invoice })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/usage — current period usage
router.get('/api/billing/usage', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const summary = await usage.getUsageSummary(auth.cafeId)
    res.json({ usage: summary })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/limits — quota status for all fields
router.get('/api/billing/limits', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const result = await quotas.checkAllQuotas(auth.cafeId)
    res.json({ limits: result })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
```

- [ ] **Step 2: TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "billingRestaurant"
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/billingRestaurant.ts
  git commit -m "feat(billing): Restaurant billing routes — plan, invoices, usage, limits"
  ```

---

## Task 11 — Register Routes in server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Read `src/server.ts` and find the import block for routes**

  The import block is around lines 60–85. Find the last marketplace route import.

- [ ] **Step 2: Add the two new imports after the existing marketplace route imports**

  ```typescript
  import billingSuperAdminRouter from './routes/billingSuperAdmin'
  import billingRestaurantRouter from './routes/billingRestaurant'
  ```

- [ ] **Step 3: Register the routes**

  Find where `app.use(marketplaceInventorySARouter)` is called (around line 259) and add after it:

  ```typescript
  app.use(billingSuperAdminRouter)
  app.use(billingRestaurantRouter)
  ```

- [ ] **Step 4: Full TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
  ```
  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/server.ts
  git commit -m "feat(billing): register billing routes in server.ts"
  ```

---

## Task 12 — Documentation

**Files:**
- Create: `docs/architecture/billing-platform.md`

- [ ] **Step 1: Create `docs/architecture/billing-platform.md`**

```markdown
# Billing Platform — Architecture

## Purpose

A reusable billing engine for all SmartSuite products. Every SaaS module (Restaurant, Hotel, Clinic, Retail) uses the same billing infrastructure for subscription management, invoice generation, quota enforcement, and tax calculation.

**Explicit non-goals:** No payment gateway integration (no Stripe, Moyasar, etc.). No UI. No commission calculations (that remains in the existing `BillingInvoice` commission model).

---

## Module Location

\`\`\`
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
\`\`\`

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

\`\`\`
DRAFT ──► PENDING ──► PAID
   │           │
   ▼           ▼
CANCELLED   OVERDUE ──► CANCELLED
                │
                ▼
             REFUNDED
\`\`\`

Invoice numbers: `BIL-YYYY-NNNNN` (sequential per year).

---

## Subscription Lifecycle

Delegated entirely to `src/tenant/lifecycle/LifecycleService`:
\`\`\`
PENDING → TRIAL → ACTIVE → GRACE_PERIOD → SUSPENDED → CANCELLED → ARCHIVED
\`\`\`

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

\`\`\`typescript
import { subscriptions, generateInvoice, quotas } from 'src/billing'

// On hotel creation:
await subscriptions.startTrialSubscription(hotelId, 'HOTEL', 'STARTER')

// On AI usage:
await usage.trackUsage(hotelId, 'HOTEL', 'aiRequests')

// Check quota before expensive operation:
const ok = await quotas.isAllowed(hotelId, 'aiRequests')
if (!ok) return res.status(429).json({ error: 'AI quota exceeded' })
\`\`\`
```

- [ ] **Step 2: Commit**

  ```bash
  git add docs/architecture/billing-platform.md
  git commit -m "docs(billing): architecture document for Billing Platform engine"
  ```

---

## Task 13 — Final Verification and Push

- [ ] **Step 1: Verify all billing files exist**

  ```bash
  find src/billing -name "*.ts" | sort
  ```
  Expected: 14 files across all subdirectories.

- [ ] **Step 2: Verify routes registered**

  ```bash
  grep -n "billingSuperAdmin\|billingRestaurant" src/server.ts
  ```
  Expected: 2 import lines + 2 `app.use` lines.

- [ ] **Step 3: Verify Prisma models**

  ```bash
  grep -n "BillingPlatformInvoice\|BillingEventLog\|certificates" prisma/schema.prisma
  ```
  Expected: model definitions + certificates field.

- [ ] **Step 4: Verify PlatformEventName extended**

  ```bash
  grep -n "SubscriptionCreated\|InvoiceGenerated\|QuotaExceeded\|TrialEnding" src/core/types/index.ts
  ```
  Expected: 4+ hits.

- [ ] **Step 5: Full TypeScript check**

  ```bash
  npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
  ```
  Expected: no output.

- [ ] **Step 6: Push**

  ```bash
  git push
  ```

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `src/billing/types/index.ts` | All billing types |
| `src/billing/plans/PlanCatalogService.ts` | Plan catalog + regional pricing |
| `src/billing/subscriptions/SubscriptionService.ts` | Subscription lifecycle + events |
| `src/billing/invoices/InvoiceNumberService.ts` | BIL-YYYY-NNNNN generator |
| `src/billing/invoices/InvoiceService.ts` | Invoice CRUD + lifecycle |
| `src/billing/quotas/QuotaService.ts` | Per-plan quota enforcement |
| `src/billing/usage/BillingUsageService.ts` | Usage tracking + quota check |
| `src/billing/taxes/TaxService.ts` | Tax abstraction |
| `src/billing/taxes/providers/VATProvider.ts` | VAT rates by country |
| `src/billing/taxes/providers/SalesTaxProvider.ts` | US Sales Tax by state |
| `src/billing/events/BillingEvents.ts` | 7 billing event publishers |
| `src/billing/notifications/BillingNotifications.ts` | Billing notifications |
| `src/billing/services/BillingOrchestrator.ts` | High-level facade |
| `src/billing/index.ts` | Public API |
| `src/routes/billingSuperAdmin.ts` | 15 SuperAdmin billing endpoints |
| `src/routes/billingRestaurant.ts` | 5 Restaurant billing endpoints |
| `docs/architecture/billing-platform.md` | Architecture doc |
