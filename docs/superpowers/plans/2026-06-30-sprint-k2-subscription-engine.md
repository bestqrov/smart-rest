# Sprint K2 — Subscription Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DB-backed, reusable subscription engine for all SmartSuite products. Replaces the existing tenant-lifecycle-based SubscriptionService with a proper `BillingSubscription` Prisma model, state machine, validation, events, notifications, 13 API endpoints, and two UI pages.

**Architecture:** New `BillingSubscription` Prisma model (separate from `TenantProfile`). State machine in `SubscriptionLifecycle.ts`. Existing `src/billing/subscriptions/SubscriptionService.ts` is **replaced** — the new one returns `BillingSubscription` objects instead of `TenantProfile`. The `BillingOrchestrator` and `billingRestaurant.ts` are updated to use the new types.

**Tech Stack:** TypeScript, Prisma 4 (MongoDB), Express 5, Next.js 13 App Router, `useSAAuth()` / JWT for auth, `AuditService` + `NotificationService` + `eventBus` from `src/core`.

**Subscription States:** `TRIAL | ACTIVE | GRACE_PERIOD | SUSPENDED | CANCELLED | EXPIRED`

---

## What Already Exists (Handle Carefully)

| What | Location | Action |
|------|----------|--------|
| Old SubscriptionService.ts (wraps tenant lifecycle, returns TenantProfile) | `src/billing/subscriptions/SubscriptionService.ts` | **Replace** with new DB-backed version |
| BillingOrchestrator (imports `* as Subscriptions from SubscriptionService`) | `src/billing/services/BillingOrchestrator.ts` | Update after replacement |
| `billing/index.ts` exports `getSubscription` from old service | `src/billing/index.ts` | Update export |
| `billingRestaurant.ts` GET `/api/billing/plan` calls `subscriptions.getSubscription` | `src/routes/billingRestaurant.ts` | Update to new API |
| `app/admin/billing/page.tsx` (commission-based billing, WalletLog) | `app/admin/billing/page.tsx` | Do NOT modify |
| `BillingPlan` model + `PlanService` from Sprint K1 | `src/billing/plans/` | Reuse planId, planCode |
| BillingEvents emitters (SubscriptionCreated, SubscriptionRenewed, SubscriptionCancelled) | `src/billing/events/BillingEvents.ts` | Reuse in SubscriptionEvents.ts |

---

## New Files

```
src/billing/subscriptions/
  SubscriptionTypes.ts          — BillingSubscription interface, CreateSubscriptionInput, etc.
  SubscriptionRepository.ts     — Prisma CRUD for BillingSubscription model
  SubscriptionLifecycle.ts      — State machine: valid transitions + transition functions
  SubscriptionValidation.ts     — Guards: one active per tenant, trial restart, terminal states
  SubscriptionEvents.ts         — 7 emitters (reuses BillingEvents + 4 new ones)
  SubscriptionNotifications.ts  — 5 notifications via NotificationService
  SubscriptionService.ts        — REPLACES existing: full facade with audit logging

src/routes/
  billingSubscriptionsSA.ts     — 10 SuperAdmin subscription endpoints

app/superadmin/billing/subscriptions/
  page.tsx                      — SA subscriptions table with actions

app/admin/billing/subscription/
  page.tsx                      — Restaurant subscription status + plan details
```

**Modified files:**
- `prisma/schema.prisma` — add `BillingSubscription` model
- `src/core/types/index.ts` — add 4 new PlatformEventNames
- `src/billing/services/BillingOrchestrator.ts` — update imports for new SubscriptionService API
- `src/billing/index.ts` — update subscription exports
- `src/routes/billingRestaurant.ts` — add 3 restaurant subscription endpoints
- `src/server.ts` — register billingSubscriptionsSA

---

## Task 1 — SubscriptionTypes + Prisma Schema + PlatformEventName

**Files:**
- Create: `src/billing/subscriptions/SubscriptionTypes.ts`
- Modify: `prisma/schema.prisma` (add BillingSubscription model)
- Modify: `src/core/types/index.ts` (add 4 new events)

- [ ] **Step 1: Create `src/billing/subscriptions/SubscriptionTypes.ts`**

```typescript
// ─── Billing Subscriptions — Types ────────────────────────────────────────

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface BillingSubscription {
  id:           string
  tenantId:     string
  planId:       string      // BillingPlan._id
  planCode:     string      // denormalized for display
  planName:     string      // denormalized for display
  status:       SubscriptionStatus
  startDate:    Date
  endDate:      Date | null
  renewalDate:  Date | null
  trialEndsAt:  Date | null
  cancelledAt:  Date | null
  graceEndsAt:  Date | null
  autoRenew:    boolean
  notes:        string | null
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateSubscriptionInput {
  tenantId:    string
  planId:      string
  planCode:    string
  planName:    string
  status:      SubscriptionStatus
  startDate:   Date
  endDate?:    Date
  renewalDate?: Date
  trialEndsAt?: Date
  autoRenew?:  boolean
  notes?:      string
}

export interface SubscriptionWithPlan extends BillingSubscription {
  plan?: {
    id:           string
    name:         string
    code:         string
    monthlyPrice: number
    currency:     string
    maxUsers:     number
    maxStorageGB: number
    aiCredits:    number
    marketplaceEnabled:   boolean
    automationEnabled:    boolean
    certificationEnabled: boolean
    apiAccess:    boolean
    supportLevel: string
  } | null
}
```

- [ ] **Step 2: Add `BillingSubscription` model to `prisma/schema.prisma`**

  Read the schema file to find where `BillingPlan` model ends (around line 2195). Insert after it:

```prisma
// ─── Billing Platform — Subscriptions ────────────────────────────────────────

model BillingSubscription {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String
  planId      String
  planCode    String
  planName    String
  status      String    @default("TRIAL")
  startDate   DateTime  @default(now())
  endDate     DateTime?
  renewalDate DateTime?
  trialEndsAt DateTime?
  cancelledAt DateTime?
  graceEndsAt DateTime?
  autoRenew   Boolean   @default(true)
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([tenantId, status])
  @@index([renewalDate])
  @@map("billing_subscriptions")
}
```

- [ ] **Step 3: Add 4 new PlatformEventNames to `src/core/types/index.ts`**

  Find the `// Billing Plan Management` section (lines 222-226). After `'PlanDeactivated'`, add:

```typescript
  // Billing Subscription Engine
  | 'SubscriptionActivated'
  | 'SubscriptionSuspended'
  | 'SubscriptionExpired'
  | 'PlanChanged'
```

- [ ] **Step 4: Run `npx prisma generate`**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx prisma generate
```
Expected: `Generated Prisma Client`

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/subscriptions/SubscriptionTypes.ts prisma/schema.prisma src/core/types/index.ts && git commit -m "feat(billing-subs): SubscriptionTypes, BillingSubscription schema, 4 new PlatformEventNames"
```

---

## Task 2 — SubscriptionRepository

**Files:**
- Create: `src/billing/subscriptions/SubscriptionRepository.ts`

- [ ] **Step 1: Create `src/billing/subscriptions/SubscriptionRepository.ts`**

```typescript
// ─── Billing Subscriptions — Repository ───────────────────────────────────

import type { BillingSubscription, CreateSubscriptionInput, SubscriptionStatus, SubscriptionWithPlan } from './SubscriptionTypes'

async function db() {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingSubscription
}

function toModel(row: any): BillingSubscription {
  return {
    id: row.id, tenantId: row.tenantId, planId: row.planId,
    planCode: row.planCode, planName: row.planName,
    status: row.status as SubscriptionStatus,
    startDate:   row.startDate,
    endDate:     row.endDate   ?? null,
    renewalDate: row.renewalDate ?? null,
    trialEndsAt: row.trialEndsAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    graceEndsAt: row.graceEndsAt ?? null,
    autoRenew:   row.autoRenew,
    notes:       row.notes ?? null,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  }
}

export async function create(input: CreateSubscriptionInput): Promise<BillingSubscription> {
  const col = await db()
  const row = await col.create({
    data: {
      tenantId:    input.tenantId,
      planId:      input.planId,
      planCode:    input.planCode,
      planName:    input.planName,
      status:      input.status,
      startDate:   input.startDate,
      endDate:     input.endDate,
      renewalDate: input.renewalDate,
      trialEndsAt: input.trialEndsAt,
      autoRenew:   input.autoRenew ?? true,
      notes:       input.notes,
    },
  })
  return toModel(row)
}

export async function update(id: string, data: Partial<{
  status: SubscriptionStatus; planId: string; planCode: string; planName: string
  endDate: Date | null; renewalDate: Date | null; trialEndsAt: Date | null
  cancelledAt: Date | null; graceEndsAt: Date | null; autoRenew: boolean; notes: string | null
}>): Promise<BillingSubscription> {
  const col = await db()
  const row = await col.update({ where: { id }, data })
  return toModel(row)
}

export async function findById(id: string): Promise<BillingSubscription | null> {
  const col = await db()
  const row = await col.findUnique({ where: { id } })
  return row ? toModel(row) : null
}

// Returns the most recent non-terminal subscription for a tenant
export async function findActiveByTenant(tenantId: string): Promise<BillingSubscription | null> {
  const col = await db()
  const row = await col.findFirst({
    where: { tenantId, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'] } },
    orderBy: { createdAt: 'desc' },
  })
  return row ? toModel(row) : null
}

// Returns all subscriptions for a tenant (history)
export async function findAllByTenant(tenantId: string): Promise<BillingSubscription[]> {
  const col  = await db()
  const rows = await col.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toModel)
}

export async function findAll(filter: {
  status?:   SubscriptionStatus
  tenantId?: string
  planCode?: string
  page?:     number
  limit?:    number
}): Promise<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number }> {
  const col   = await db()
  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit
  const where: any = {}
  if (filter.status)   where.status   = filter.status
  if (filter.tenantId) where.tenantId = filter.tenantId
  if (filter.planCode) where.planCode = filter.planCode

  const [rows, total] = await Promise.all([
    col.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    col.count({ where }),
  ])
  return { subscriptions: rows.map(toModel), total, page, pages: Math.ceil(total / limit) }
}

// Returns subscription enriched with plan data
export async function findWithPlan(id: string): Promise<SubscriptionWithPlan | null> {
  const { default: prisma } = await import('../../prisma')
  const sub = await (prisma as any).billingSubscription.findUnique({ where: { id } })
  if (!sub) return null

  const plan = await (prisma as any).billingPlan.findUnique({ where: { id: sub.planId } }).catch(() => null)
  return { ...toModel(sub), plan: plan ?? null }
}

// Returns count of active subscriptions for a plan (used by plan delete guard)
export async function countByPlan(planCode: string): Promise<number> {
  const col = await db()
  return col.count({
    where: { planCode, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] } },
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/subscriptions/SubscriptionRepository"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/subscriptions/SubscriptionRepository.ts && git commit -m "feat(billing-subs): SubscriptionRepository — CRUD, findByTenant, findAll, findWithPlan, countByPlan"
```

---

## Task 3 — SubscriptionValidation + SubscriptionEvents + SubscriptionNotifications

**Files:**
- Create: `src/billing/subscriptions/SubscriptionValidation.ts`
- Create: `src/billing/subscriptions/SubscriptionEvents.ts`
- Create: `src/billing/subscriptions/SubscriptionNotifications.ts`

- [ ] **Step 1: Create `src/billing/subscriptions/SubscriptionValidation.ts`**

```typescript
// ─── Billing Subscriptions — Validation ───────────────────────────────────

import { findActiveByTenant } from './SubscriptionRepository'
import type { BillingSubscription, SubscriptionStatus } from './SubscriptionTypes'

export class SubscriptionError extends Error {
  constructor(message: string) { super(message); this.name = 'SubscriptionError' }
}

// Valid state transitions
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL:        ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  ACTIVE:       ['GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED:    ['ACTIVE', 'CANCELLED'],
  CANCELLED:    [],
  EXPIRED:      [],
}

export function assertTransition(current: SubscriptionStatus, next: SubscriptionStatus): void {
  const allowed = VALID_TRANSITIONS[current] ?? []
  if (!allowed.includes(next)) {
    throw new SubscriptionError(
      `Invalid transition: ${current} → ${next}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`
    )
  }
}

export async function assertOneActivePerTenant(tenantId: string, excludeId?: string): Promise<void> {
  const existing = await findActiveByTenant(tenantId)
  if (existing && existing.id !== excludeId) {
    throw new SubscriptionError(
      `Tenant ${tenantId} already has an active subscription (${existing.status})`
    )
  }
}

export function assertNotTerminal(sub: BillingSubscription): void {
  if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
    throw new SubscriptionError(
      `Cannot modify a ${sub.status} subscription`
    )
  }
}

export function assertTrialNotRestarted(sub: BillingSubscription, targetStatus: SubscriptionStatus): void {
  if (targetStatus === 'TRIAL' && sub.status !== 'TRIAL') {
    throw new SubscriptionError('Trial cannot be restarted on an existing subscription')
  }
}
```

- [ ] **Step 2: Create `src/billing/subscriptions/SubscriptionEvents.ts`**

  First read `src/core/index.ts` to confirm `eventBus` export and `publish` signature.

```typescript
// ─── Billing Subscriptions — Events ───────────────────────────────────────

import { eventBus } from '../../core'
import type { BillingSubscription } from './SubscriptionTypes'

function payload(sub: BillingSubscription, extra?: Record<string, unknown>) {
  return { subscriptionId: sub.id, tenantId: sub.tenantId, planCode: sub.planCode, status: sub.status, ...extra }
}

export function emitSubscriptionCreated(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionCreated', payload(sub), 'subscription-engine')
}

export function emitSubscriptionActivated(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionActivated', payload(sub), 'subscription-engine')
}

export function emitSubscriptionRenewed(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionRenewed', payload(sub), 'subscription-engine')
}

export function emitSubscriptionSuspended(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionSuspended', payload(sub), 'subscription-engine')
}

export function emitSubscriptionCancelled(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionCancelled', payload(sub), 'subscription-engine')
}

export function emitSubscriptionExpired(sub: BillingSubscription): void {
  eventBus.publish('SubscriptionExpired', payload(sub), 'subscription-engine')
}

export function emitPlanChanged(sub: BillingSubscription, previousPlanCode: string): void {
  eventBus.publish('PlanChanged', payload(sub, { previousPlanCode }), 'subscription-engine')
}
```

- [ ] **Step 3: Create `src/billing/subscriptions/SubscriptionNotifications.ts`**

  First read `src/core/notifications/NotificationService.ts` briefly to confirm `createNotification` fields.

```typescript
// ─── Billing Subscriptions — Notifications ────────────────────────────────

import { NotificationService } from '../../core'

export async function notifyTrialEnding(tenantId: string, daysLeft: number): Promise<void> {
  await NotificationService.createNotification({
    level:    'WARNING',
    title:    daysLeft <= 1 ? 'تنتهي فترة التجربة غداً' : `تنتهي فترة التجربة خلال ${daysLeft} أيام`,
    message:  'قم بترقية خطتك لمواصلة الاستخدام دون انقطاع.',
    module:   'BILLING',
    targetId: tenantId,
  })
}

export async function notifyActivated(tenantId: string, planName: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تفعيل الاشتراك',
    message:  `مرحباً! تم تفعيل اشتراكك في خطة ${planName} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { planName },
  })
}

export async function notifySuspended(tenantId: string, reason: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'ERROR',
    title:    'تم تعليق اشتراكك',
    message:  `تم تعليق اشتراكك. السبب: ${reason}. تواصل مع الدعم لإعادة التفعيل.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { reason },
  })
}

export async function notifyRenewed(tenantId: string, planName: string, renewalDate: Date | null): Promise<void> {
  await NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تجديد الاشتراك',
    message:  `تم تجديد اشتراكك في خطة ${planName} بنجاح.`,
    module:   'BILLING',
    targetId: tenantId,
    metadata: { planName, renewalDate },
  })
}

export async function notifyCancelled(tenantId: string): Promise<void> {
  await NotificationService.createNotification({
    level:    'INFO',
    title:    'تم إلغاء الاشتراك',
    message:  'تم إلغاء اشتراكك. يمكنك إعادة الاشتراك في أي وقت.',
    module:   'BILLING',
    targetId: tenantId,
  })
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/subscriptions/Subscription"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/subscriptions/SubscriptionValidation.ts src/billing/subscriptions/SubscriptionEvents.ts src/billing/subscriptions/SubscriptionNotifications.ts && git commit -m "feat(billing-subs): SubscriptionValidation (state machine guards) + SubscriptionEvents (7 emitters) + SubscriptionNotifications (5)"
```

---

## Task 4 — SubscriptionLifecycle

**Files:**
- Create: `src/billing/subscriptions/SubscriptionLifecycle.ts`

- [ ] **Step 1: Create `src/billing/subscriptions/SubscriptionLifecycle.ts`**

```typescript
// ─── Billing Subscriptions — Lifecycle State Machine ──────────────────────

import * as Repo       from './SubscriptionRepository'
import * as Validation from './SubscriptionValidation'
import * as Events     from './SubscriptionEvents'
import type { BillingSubscription, SubscriptionStatus } from './SubscriptionTypes'

// Helper: add months to a date
function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export async function activate(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'ACTIVE')
  const renewalDate = addMonths(new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status: 'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionActivated(updated)
  return updated
}

export async function renew(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertNotTerminal(sub)
  const renewalDate = addMonths(sub.renewalDate ?? new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status:      'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionRenewed(updated)
  return updated
}

export async function enterGracePeriod(sub: BillingSubscription, graceDays = 7): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'GRACE_PERIOD')
  const graceEndsAt = new Date()
  graceEndsAt.setDate(graceEndsAt.getDate() + graceDays)
  const updated = await Repo.update(sub.id, { status: 'GRACE_PERIOD', graceEndsAt })
  return updated
}

export async function suspend(sub: BillingSubscription, reason: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'SUSPENDED')
  const updated = await Repo.update(sub.id, { status: 'SUSPENDED' })
  Events.emitSubscriptionSuspended(updated)
  return updated
}

export async function resume(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'ACTIVE')
  const renewalDate = addMonths(new Date(), 1)
  const updated = await Repo.update(sub.id, {
    status: 'ACTIVE',
    renewalDate,
    graceEndsAt: null,
  })
  Events.emitSubscriptionActivated(updated)
  return updated
}

export async function cancel(sub: BillingSubscription, by: string): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'CANCELLED')
  const updated = await Repo.update(sub.id, {
    status:      'CANCELLED',
    cancelledAt: new Date(),
  })
  Events.emitSubscriptionCancelled(updated)
  return updated
}

export async function expire(sub: BillingSubscription): Promise<BillingSubscription> {
  Validation.assertTransition(sub.status, 'EXPIRED')
  const updated = await Repo.update(sub.id, {
    status:     'EXPIRED',
    cancelledAt: new Date(),
  })
  Events.emitSubscriptionExpired(updated)
  return updated
}

export async function changePlan(
  sub:         BillingSubscription,
  newPlanId:   string,
  newPlanCode: string,
  newPlanName: string,
  by:          string,
): Promise<BillingSubscription> {
  Validation.assertNotTerminal(sub)
  const previousCode = sub.planCode
  const updated = await Repo.update(sub.id, {
    planId:   newPlanId,
    planCode: newPlanCode,
    planName: newPlanName,
  })
  Events.emitPlanChanged(updated, previousCode)
  return updated
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/subscriptions/SubscriptionLifecycle"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/subscriptions/SubscriptionLifecycle.ts && git commit -m "feat(billing-subs): SubscriptionLifecycle state machine (activate, renew, suspend, resume, cancel, expire, changePlan)"
```

---

## Task 5 — Replace SubscriptionService.ts

**Files:**
- Replace: `src/billing/subscriptions/SubscriptionService.ts` (overwrite, do NOT keep old content)

- [ ] **Step 1: Overwrite `src/billing/subscriptions/SubscriptionService.ts`**

```typescript
// ─── Billing Subscriptions — Service (Sprint K2: DB-backed) ──────────────

import * as Repo       from './SubscriptionRepository'
import * as Lifecycle  from './SubscriptionLifecycle'
import * as Validation from './SubscriptionValidation'
import * as Events     from './SubscriptionEvents'
import * as Notifs     from './SubscriptionNotifications'
import { AuditService } from '../../core'
import type { BillingSubscription, SubscriptionWithPlan, SubscriptionStatus } from './SubscriptionTypes'

async function getPlan(planId: string) {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingPlan.findUnique({ where: { id: planId } }).catch(() => null)
}

async function audit(action: string, entityId: string, by: string, meta?: Record<string, unknown>) {
  await AuditService.createAudit({
    module:      'BILLING_SUBSCRIPTIONS',
    entity:      'BillingSubscription',
    entityId,
    action,
    performedBy: by,
    metadata:    meta,
  }).catch(() => undefined)
}

// ─── Create (starts as TRIAL by default) ─────────────────────────────────────

export async function createTrialSubscription(
  tenantId: string,
  planId:   string,
  by:       string,
  opts?: { trialDays?: number; autoRenew?: boolean; notes?: string },
): Promise<BillingSubscription> {
  await Validation.assertOneActivePerTenant(tenantId)
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')

  const now        = new Date()
  const trialDays  = opts?.trialDays ?? 14
  const trialEndsAt = new Date(now)
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

  const sub = await Repo.create({
    tenantId, planId, planCode: plan.code, planName: plan.name,
    status:      'TRIAL',
    startDate:   now,
    trialEndsAt,
    autoRenew:   opts?.autoRenew ?? true,
    notes:       opts?.notes,
  })
  Events.emitSubscriptionCreated(sub)
  await audit('CREATE_TRIAL', sub.id, by, { planCode: plan.code, trialDays })
  return sub
}

export async function createActiveSubscription(
  tenantId: string,
  planId:   string,
  by:       string,
  opts?: { autoRenew?: boolean; notes?: string },
): Promise<BillingSubscription> {
  await Validation.assertOneActivePerTenant(tenantId)
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')

  const now         = new Date()
  const renewalDate = new Date(now)
  renewalDate.setMonth(renewalDate.getMonth() + 1)

  const sub = await Repo.create({
    tenantId, planId, planCode: plan.code, planName: plan.name,
    status:      'ACTIVE',
    startDate:   now,
    renewalDate,
    autoRenew:   opts?.autoRenew ?? true,
    notes:       opts?.notes,
  })
  Events.emitSubscriptionCreated(sub)
  Events.emitSubscriptionActivated(sub)
  await Notifs.notifyActivated(tenantId, plan.name).catch(() => undefined)
  await audit('CREATE_ACTIVE', sub.id, by, { planCode: plan.code })
  return sub
}

// ─── Lifecycle transitions ────────────────────────────────────────────────────

export async function activate(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.activate(sub, by)
  await Notifs.notifyActivated(sub.tenantId, sub.planName).catch(() => undefined)
  await audit('ACTIVATE', id, by)
  return updated
}

export async function renew(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.renew(sub, by)
  await Notifs.notifyRenewed(sub.tenantId, sub.planName, updated.renewalDate).catch(() => undefined)
  await audit('RENEW', id, by)
  return updated
}

export async function suspend(id: string, reason: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.suspend(sub, reason)
  await Notifs.notifySuspended(sub.tenantId, reason).catch(() => undefined)
  await audit('SUSPEND', id, by, { reason })
  return updated
}

export async function resume(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.resume(sub, by)
  await audit('RESUME', id, by)
  return updated
}

export async function cancel(id: string, by: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.cancel(sub, by)
  await Notifs.notifyCancelled(sub.tenantId).catch(() => undefined)
  await audit('CANCEL', id, by)
  return updated
}

export async function expire(id: string): Promise<BillingSubscription> {
  const sub = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const updated = await Lifecycle.expire(sub)
  await audit('EXPIRE', id, 'system')
  return updated
}

export async function changePlan(
  id:      string,
  planId:  string,
  by:      string,
): Promise<BillingSubscription> {
  const sub  = await Repo.findById(id)
  if (!sub) throw new Validation.SubscriptionError('Subscription not found')
  const plan = await getPlan(planId)
  if (!plan) throw new Validation.SubscriptionError('Plan not found')
  const updated = await Lifecycle.changePlan(sub, plan.id, plan.code, plan.name, by)
  await audit('CHANGE_PLAN', id, by, { newPlanCode: plan.code, previousPlanCode: sub.planCode })
  return updated
}

export async function updateNotes(id: string, notes: string | null, by: string): Promise<BillingSubscription> {
  const updated = await Repo.update(id, { notes })
  await audit('UPDATE_NOTES', id, by)
  return updated
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSubscription(id: string): Promise<BillingSubscription | null> {
  return Repo.findById(id)
}

export async function getSubscriptionByTenant(tenantId: string): Promise<BillingSubscription | null> {
  return Repo.findActiveByTenant(tenantId)
}

export async function getSubscriptionWithPlan(tenantId: string): Promise<SubscriptionWithPlan | null> {
  const sub = await Repo.findActiveByTenant(tenantId)
  if (!sub) return null
  return Repo.findWithPlan(sub.id)
}

export async function getHistory(tenantId: string): Promise<BillingSubscription[]> {
  return Repo.findAllByTenant(tenantId)
}

export async function listSubscriptions(filter: {
  status?:   SubscriptionStatus
  tenantId?: string
  planCode?: string
  page?:     number
  limit?:    number
}): Promise<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number }> {
  return Repo.findAll(filter)
}
```

- [ ] **Step 2: TypeScript check (full)**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: errors ONLY in files that import from old SubscriptionService and use TenantProfile return type. Note them — they'll be fixed in Task 6.

- [ ] **Step 3: Fix BillingOrchestrator.ts**

  Read `src/billing/services/BillingOrchestrator.ts`. The line `export const subscriptions = Subscriptions` re-exports everything. After the replacement, the exported API changed. Update if needed — the key is that the file imports compile without errors.

  If there are TS errors related to `BillingOrchestrator.ts`, simplify the subscriptions export to only what's needed, or update the import to use the new API.

- [ ] **Step 4: Fix billing/index.ts**

  Read `src/billing/index.ts`. Find the line:
  ```typescript
  export { getSubscription } from './subscriptions/SubscriptionService'
  ```
  The new `getSubscription(id)` takes an ID not a tenantId. Add a new export:
  ```typescript
  export { getSubscription, getSubscriptionByTenant } from './subscriptions/SubscriptionService'
  ```

- [ ] **Step 5: Fix billingRestaurant.ts**

  Read `src/routes/billingRestaurant.ts`. Find the GET `/api/billing/plan` route which calls `subscriptions.getSubscription(auth.cafeId)`. The new service's `getSubscription(id)` takes a MongoDB subscription ID. Update this route to call `getSubscriptionByTenant(cafeId)` instead:

  Change:
  ```typescript
  const sub = await subscriptions.getSubscription(auth.cafeId)
  ```
  To:
  ```typescript
  const { getSubscriptionByTenant } = await import('../billing/subscriptions/SubscriptionService')
  const sub = await getSubscriptionByTenant(auth.cafeId)
  ```
  
  Or better — import at the top of the file instead of dynamically.

- [ ] **Step 6: Full TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/subscriptions/SubscriptionService.ts src/billing/services/BillingOrchestrator.ts src/billing/index.ts src/routes/billingRestaurant.ts && git commit -m "feat(billing-subs): replace SubscriptionService with DB-backed engine + update orchestrator, index, restaurant route"
```

---

## Task 6 — API Routes

**Files:**
- Create: `src/routes/billingSubscriptionsSA.ts`
- Modify: `src/routes/billingRestaurant.ts` (add 3 subscription endpoints)
- Modify: `src/server.ts` (register new SA router)

- [ ] **Step 1: Create `src/routes/billingSubscriptionsSA.ts`**

```typescript
// ─── Billing Subscriptions — SuperAdmin Routes ─────────────────────────────

import { Router } from 'express'
import * as SubscriptionService from '../billing/subscriptions/SubscriptionService'
import { SubscriptionError }    from '../billing/subscriptions/SubscriptionValidation'
import type { SubscriptionStatus } from '../billing/subscriptions/SubscriptionTypes'

const router = Router()

function requireSA(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false
  }
  if (!req.headers['x-superadmin-email']) {
    res.status(401).json({ error: 'Unauthorized' }); return false
  }
  return true
}

function saEmail(req: any): string {
  return String(req.headers['x-superadmin-email'] ?? 'sa@system')
}

function handleError(res: any, err: unknown) {
  if (err instanceof SubscriptionError) return res.status(400).json({ error: err.message })
  return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
}

// GET /api/superadmin/billing/subscriptions
router.get('/api/superadmin/billing/subscriptions', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { status, tenantId, planCode, page, limit } = req.query
    const result = await SubscriptionService.listSubscriptions({
      status:   status   as SubscriptionStatus | undefined,
      tenantId: tenantId as string | undefined,
      planCode: planCode as string | undefined,
      page:     page     ? Number(page)  : undefined,
      limit:    limit    ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/subscriptions/:id
router.get('/api/superadmin/billing/subscriptions/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.getSubscription(req.params.id)
    if (!sub) return res.status(404).json({ error: 'Subscription not found' })
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions
router.post('/api/superadmin/billing/subscriptions', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { tenantId, planId, type = 'trial', trialDays, autoRenew, notes } = req.body
    if (!tenantId || !planId) return res.status(400).json({ error: 'tenantId and planId are required' })
    const sub = type === 'active'
      ? await SubscriptionService.createActiveSubscription(tenantId, planId, saEmail(req), { autoRenew, notes })
      : await SubscriptionService.createTrialSubscription(tenantId, planId, saEmail(req), { trialDays, autoRenew, notes })
    res.status(201).json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// PATCH /api/superadmin/billing/subscriptions/:id
router.patch('/api/superadmin/billing/subscriptions/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { notes } = req.body
    const sub = await SubscriptionService.updateNotes(req.params.id, notes ?? null, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/activate
router.post('/api/superadmin/billing/subscriptions/:id/activate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.activate(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/suspend
router.post('/api/superadmin/billing/subscriptions/:id/suspend', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { reason = 'Manual suspension by SuperAdmin' } = req.body
    const sub = await SubscriptionService.suspend(req.params.id, reason, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/resume
router.post('/api/superadmin/billing/subscriptions/:id/resume', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.resume(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/cancel
router.post('/api/superadmin/billing/subscriptions/:id/cancel', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.cancel(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/renew
router.post('/api/superadmin/billing/subscriptions/:id/renew', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.renew(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/change-plan
router.post('/api/superadmin/billing/subscriptions/:id/change-plan', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { planId } = req.body
    if (!planId) return res.status(400).json({ error: 'planId is required' })
    const sub = await SubscriptionService.changePlan(req.params.id, planId, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

export default router
```

- [ ] **Step 2: Add 3 restaurant subscription endpoints to `src/routes/billingRestaurant.ts`**

  Read the file, then add these 3 routes after the existing last route (`GET /api/billing/limits`):

```typescript
// GET /api/billing/subscription — current subscription with plan details
router.get('/api/billing/subscription', async (req: any, res: any) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const { getSubscriptionWithPlan } = await import('../billing/subscriptions/SubscriptionService')
    const sub = await getSubscriptionWithPlan(auth.cafeId)
    res.json({ subscription: sub })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/subscription/status — simple status check
router.get('/api/billing/subscription/status', async (req: any, res: any) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const { getSubscriptionByTenant } = await import('../billing/subscriptions/SubscriptionService')
    const sub = await getSubscriptionByTenant(auth.cafeId)
    res.json({ status: sub?.status ?? 'NONE', planCode: sub?.planCode ?? null, trialEndsAt: sub?.trialEndsAt ?? null })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/billing/subscription/history — all subscriptions for tenant
router.get('/api/billing/subscription/history', async (req: any, res: any) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const { getHistory } = await import('../billing/subscriptions/SubscriptionService')
    const history = await getHistory(auth.cafeId)
    res.json({ history })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})
```

  **Important:** The route `GET /api/billing/subscription/status` must be registered BEFORE `GET /api/billing/subscription` if they share the same router — actually since one has `/status` suffix it's fine. But ensure `/status` and `/history` routes come before any `:id` wildcard routes.

- [ ] **Step 3: Register in `src/server.ts`**

  Add import:
  ```typescript
  import billingSubscriptionsSARouter from './routes/billingSubscriptionsSA'
  ```
  Add registration:
  ```typescript
  app.use(billingSubscriptionsSARouter)
  ```

- [ ] **Step 4: Full TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/routes/billingSubscriptionsSA.ts src/routes/billingRestaurant.ts src/server.ts && git commit -m "feat(billing-subs): 10 SA subscription routes + 3 restaurant subscription endpoints + register router"
```

---

## Task 7 — SuperAdmin Subscriptions UI

**Files:**
- Create: `app/superadmin/billing/subscriptions/page.tsx`

- [ ] **Step 1: Read reference page**

  Read `app/superadmin/billing/plans/page.tsx` to understand the exact UI patterns used in Sprint K1 (T.ar/T.en, useSAAuth, table, action buttons).

- [ ] **Step 2: Create `app/superadmin/billing/subscriptions/page.tsx`**

  SA subscriptions management page. Follow the same patterns as billing/plans/page.tsx.

  **Import path for context:** `import { useSAAuth } from '../../context'` (billing/subscriptions is 2 levels from superadmin/)

  **BillingSubscription interface** (copy from SubscriptionTypes.ts):
  ```typescript
  interface BillingSubscription {
    id: string; tenantId: string; planId: string; planCode: string; planName: string
    status: string; startDate: string; endDate: string | null; renewalDate: string | null
    trialEndsAt: string | null; cancelledAt: string | null; graceEndsAt: string | null
    autoRenew: boolean; notes: string | null; createdAt: string; updatedAt: string
  }
  ```

  **i18n T.ar:**
  ```typescript
  ar: {
    title: 'الاشتراكات', subtitle: 'إدارة اشتراكات المستأجرين',
    search: 'بحث بمعرف المستأجر...', refresh: 'تحديث',
    tenantId: 'معرف المستأجر', plan: 'الخطة', status: 'الحالة',
    renewalDate: 'تاريخ التجديد', trialEndsAt: 'نهاية التجربة',
    actions: 'إجراءات', activate: 'تفعيل', suspend: 'تعليق',
    resume: 'استئناف', cancel: 'إلغاء', renew: 'تجديد',
    changePlan: 'تغيير الخطة', loading: 'جاري التحميل...',
    noSubs: 'لا توجد اشتراكات', confirmCancel: 'هل أنت متأكد من الإلغاء؟',
    confirmSuspend: 'هل أنت متأكد من التعليق؟',
    allStatus: 'كل الحالات', newSub: 'اشتراك جديد',
    STATUS: {
      TRIAL: 'تجريبي', ACTIVE: 'نشط', GRACE_PERIOD: 'فترة سماح',
      SUSPENDED: 'موقوف', CANCELLED: 'ملغى', EXPIRED: 'منتهي الصلاحية',
    } as Record<string, string>,
    prev: 'السابق', next: 'التالي', of: 'من',
  },
  ```

  **T.en:** equivalent English.

  **Status badge colors:**
  ```typescript
  const STATUS_COLOR: Record<string, string> = {
    TRIAL:        'bg-blue-900 text-blue-300',
    ACTIVE:       'bg-green-900 text-green-300',
    GRACE_PERIOD: 'bg-amber-900 text-amber-300',
    SUSPENDED:    'bg-orange-900 text-orange-300',
    CANCELLED:    'bg-red-900 text-red-400',
    EXPIRED:      'bg-zinc-700 text-zinc-400',
  }
  ```

  **Load function:**
  ```typescript
  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (search) params.set('tenantId', search)
      if (statusFilter) params.set('status', statusFilter)
      const res  = await fetch(`/api/superadmin/billing/subscriptions?${params}`, { headers: header() })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }, [header, page, search, statusFilter])
  ```

  **Table columns:** Tenant ID, Plan, Status, Trial/Renewal Date, Auto-Renew, Actions

  **Action buttons per row (icon buttons with title tooltip):**
  - Activate (power): POST `/:id/activate` — show only if status is TRIAL or SUSPENDED (actually only TRIAL/GRACE_PERIOD)
  - Suspend (pause): POST `/:id/suspend` + confirm — show if ACTIVE or GRACE_PERIOD
  - Resume (play): POST `/:id/resume` — show if SUSPENDED
  - Renew (refresh): POST `/:id/renew` — show if ACTIVE or GRACE_PERIOD
  - Cancel (X): POST `/:id/cancel` + confirm — show if not terminal
  - Change Plan (swap icon): opens a small modal asking for new plan ID

  **Change Plan Modal:** simple modal with a plan selector (fetch `/api/superadmin/billing/plans` to list plans, show as select dropdown). On submit: POST `/:id/change-plan` with `{ planId }`.

  **State:**
  ```typescript
  const [data, setData]           = useState<{ subscriptions: BillingSubscription[]; total: number; page: number; pages: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]           = useState(1)
  const [changePlanSub, setChangePlanSub] = useState<string | null>(null)  // subscriptionId
  const [plans, setPlans]         = useState<{ id: string; name: string; code: string }[]>([])
  const [newPlanId, setNewPlanId] = useState('')
  ```

- [ ] **Step 3: Also update `app/superadmin/billing/page.tsx`**

  The billing hub has "Subscriptions" tile as disabled (coming soon). Now enable it:
  Change the Subscriptions tile from disabled to active, linking to `/superadmin/billing/subscriptions`.

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "superadmin/billing/subscriptions"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/superadmin/billing/subscriptions/ app/superadmin/billing/page.tsx && git commit -m "feat(billing-subs): SA Subscriptions page (table, status badges, actions, change-plan modal) + enable hub tile"
```

---

## Task 8 — Restaurant Subscription Page

**Files:**
- Create: `app/admin/billing/subscription/page.tsx`

- [ ] **Step 1: Read `app/admin/billing/page.tsx`** to understand admin theme (light/dark, RTL, auth pattern).

- [ ] **Step 2: Check admin auth pattern**

  Read `app/admin/layout.tsx` or a nearby page (like `app/admin/dashboard/page.tsx`) to see how JWT auth is handled in the restaurant admin frontend (typically from `localStorage` or a cookie, or a React context).

- [ ] **Step 3: Create `app/admin/billing/subscription/page.tsx`**

  Restaurant subscription status page displaying:
  - Current Plan name + code
  - Status with colored badge
  - Renewal Date / Trial Ends Date
  - Trial Remaining (countdown if in TRIAL)
  - Plan feature list: maxUsers, maxStorageGB, aiCredits, feature flags
  - Change Plan: placeholder button showing "قريباً" / "Coming Soon"
  - Link back to billing overview

  Use the `useLang()` hook from `app/admin/lang-context.tsx` for `{ lang, isRTL }` if available. Otherwise inline lang state.

  Fetch from `/api/billing/subscription` (authenticated with JWT Bearer token from localStorage `token` key — check how other admin pages fetch).

  **i18n T.ar:**
  ```typescript
  ar: {
    title: 'الاشتراك', subtitle: 'تفاصيل خطة اشتراكك الحالية',
    currentPlan: 'الخطة الحالية', status: 'حالة الاشتراك',
    renewalDate: 'تاريخ التجديد', trialEndsAt: 'نهاية فترة التجربة',
    trialRemaining: 'الأيام المتبقية في التجربة', noSubscription: 'لا يوجد اشتراك نشط',
    changePlan: 'تغيير الخطة', comingSoon: 'قريباً',
    features: 'مميزات الخطة', maxUsers: 'أقصى مستخدمين', storage: 'التخزين',
    aiCredits: 'رصيد AI', marketplace: 'المارکت‌بليس', automation: 'الأتمتة',
    certification: 'الشهادات', apiAccess: 'وصول API', support: 'الدعم',
    included: 'مشمول', notIncluded: 'غير مشمول', loading: 'جاري التحميل...',
    STATUS: {
      TRIAL: 'فترة تجريبية', ACTIVE: 'نشط', GRACE_PERIOD: 'فترة سماح',
      SUSPENDED: 'موقوف', CANCELLED: 'ملغى', EXPIRED: 'منتهي',
    } as Record<string, string>,
  },
  ```

  **T.en:** equivalent English.

  Fetch: `GET /api/billing/subscription` with `Authorization: Bearer <token>` where token is from `localStorage.getItem('token')`.

  The response has `{ subscription: SubscriptionWithPlan | null }`.

  Show plan feature cards in a grid. Show trial countdown if `status === 'TRIAL'` and `trialEndsAt` is set.

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "admin/billing/subscription"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/admin/billing/subscription/ && git commit -m "feat(billing-subs): Restaurant subscription page — plan details, status, trial countdown, features"
```

---

## Task 9 — Documentation Update

**Files:**
- Modify: `docs/architecture/billing-platform.md`

- [ ] **Step 1: Read `docs/architecture/billing-platform.md`** to find where to insert new content (after the Plan Management section added in Sprint K1).

- [ ] **Step 2: Append Subscription Engine section**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add docs/architecture/billing-platform.md && git commit -m "docs(billing-subs): Subscription Engine section — lifecycle diagram, schema, events, APIs"
```

---

## Task 10 — Final Verification + Push

- [ ] **Step 1: Verify all subscription files**

```bash
cd "/Users/mac/Documents/SaaS restau" && find src/billing/subscriptions -name "*.ts" | sort && find app/superadmin/billing/subscriptions app/admin/billing/subscription -name "*.tsx" | sort
```

Expected:
```
src/billing/subscriptions/SubscriptionEvents.ts
src/billing/subscriptions/SubscriptionLifecycle.ts
src/billing/subscriptions/SubscriptionNotifications.ts
src/billing/subscriptions/SubscriptionRepository.ts
src/billing/subscriptions/SubscriptionService.ts
src/billing/subscriptions/SubscriptionTypes.ts
src/billing/subscriptions/SubscriptionValidation.ts
app/superadmin/billing/subscriptions/page.tsx
app/admin/billing/subscription/page.tsx
```

- [ ] **Step 2: Verify routes registered**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "billingSubscriptionsSA\|billing/subscription" src/server.ts
```

Expected: import + app.use lines.

- [ ] **Step 3: Verify Prisma model**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "model BillingSubscription" prisma/schema.prisma
```

- [ ] **Step 4: Verify new events**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "SubscriptionActivated\|SubscriptionSuspended\|SubscriptionExpired\|PlanChanged" src/core/types/index.ts
```

Expected: 4 lines.

- [ ] **Step 5: Full TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 6: Push**

```bash
cd "/Users/mac/Documents/SaaS restau" && git push
```
