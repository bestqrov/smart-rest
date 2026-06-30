# Sprint K1 — Billing Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a database-backed Plan Management system for SmartSuite OS — CRUD, validation, events, audit, and SuperAdmin UI.

**Architecture:** New `BillingPlan` Prisma model (separate from the hardcoded `PLAN_DEFINITIONS` in `src/tenant/plans/`). New files inside `src/billing/plans/`: PlanTypes, PlanRepository, PlanValidation, PlanEvents, PlanService. New routes in `src/routes/billingPlansSA.ts`. New SA pages at `app/superadmin/billing/`.

**Tech Stack:** TypeScript, Prisma 4 (MongoDB), Express 5, Next.js 13 App Router, `useSAAuth()` for SA auth, `AuditService` from `src/core`, `eventBus` from `src/core`.

**Route conflict resolution:** Existing `billingSuperAdmin.ts` has `GET/GET /api/superadmin/billing/plans` (for hardcoded PLAN_DEFINITIONS). These must be renamed to `/api/superadmin/billing/plan-catalog` before the new DB-backed plan routes are registered.

---

## What Already Exists (DO NOT REBUILD)

| What | Location |
|------|----------|
| BillingPlatformInvoice, BillingEventLog Prisma models | `prisma/schema.prisma` |
| PlanCatalogService (wraps hardcoded PLAN_DEFINITIONS) | `src/billing/plans/PlanCatalogService.ts` |
| billingSuperAdmin routes (plan-catalog, subscriptions, invoices…) | `src/routes/billingSuperAdmin.ts` |
| SA auth pattern: `useSAAuth()` | `app/superadmin/context.tsx` |
| SA page pattern: inline T.ar/T.en, dark zinc-950 | `app/superadmin/marketplace/products/page.tsx` |
| EventBus, AuditService, NotificationService | `src/core/index.ts` |
| BillingEvents emitters | `src/billing/events/BillingEvents.ts` |

---

## New Files

```
src/billing/plans/
  PlanTypes.ts          — BillingPlan interface + CreatePlanInput + UpdatePlanInput
  PlanRepository.ts     — Prisma CRUD for BillingPlan model
  PlanValidation.ts     — duplicate code, single default, delete guards
  PlanEvents.ts         — PlanCreated, PlanUpdated, PlanDeleted, PlanActivated, PlanDeactivated
  PlanService.ts        — business logic facade: create, update, delete, duplicate, activate, deactivate, setDefault

src/routes/
  billingPlansSA.ts     — 9 SuperAdmin plan endpoints

app/superadmin/billing/
  page.tsx              — Billing hub (links to Plans, future Subscriptions, Invoices)
  plans/
    page.tsx            — Plans table: search, sort, pagination, CRUD modal, activate/deactivate/set-default actions
```

**Modified files:**
- `prisma/schema.prisma` — add `BillingPlan` model
- `src/core/types/index.ts` — add 5 new PlatformEventNames
- `src/routes/billingSuperAdmin.ts` — rename `/plans` routes to `/plan-catalog`
- `src/server.ts` — register `billingPlansSA.ts`
- `docs/architecture/billing-platform.md` — update with Plan lifecycle + schema

---

## Task 1 — PlanTypes + Prisma Schema + PlatformEventName

**Files:**
- Create: `src/billing/plans/PlanTypes.ts`
- Modify: `prisma/schema.prisma` (add BillingPlan model)
- Modify: `src/core/types/index.ts` (extend PlatformEventName)

- [ ] **Step 1: Create `src/billing/plans/PlanTypes.ts`**

```typescript
// ─── Billing Plans — Types ─────────────────────────────────────────────────

export type SupportLevel = 'COMMUNITY' | 'EMAIL' | 'PRIORITY' | 'DEDICATED'

export interface BillingPlan {
  id:                   string
  name:                 string
  code:                 string           // unique slug, e.g. FREE | STARTER | PROFESSIONAL
  description:          string | null
  monthlyPrice:         number
  yearlyPrice:          number
  currency:             string
  isActive:             boolean
  isDefault:            boolean
  displayOrder:         number
  // Feature configuration
  maxUsers:             number
  maxStorageGB:         number
  aiCredits:            number
  marketplaceEnabled:   boolean
  automationEnabled:    boolean
  certificationEnabled: boolean
  apiAccess:            boolean
  supportLevel:         SupportLevel
  createdAt:            Date
  updatedAt:            Date
}

export interface CreatePlanInput {
  name:                 string
  code:                 string
  description?:         string
  monthlyPrice:         number
  yearlyPrice?:         number
  currency?:            string
  isActive?:            boolean
  isDefault?:           boolean
  displayOrder?:        number
  maxUsers?:            number
  maxStorageGB?:        number
  aiCredits?:           number
  marketplaceEnabled?:  boolean
  automationEnabled?:   boolean
  certificationEnabled?: boolean
  apiAccess?:           boolean
  supportLevel?:        SupportLevel
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, 'code'>> & {
  code?: string
}
```

- [ ] **Step 2: Add `BillingPlan` model to `prisma/schema.prisma`**

  Read the schema file to find a good insertion point (after `BillingEventLog` model). Insert:

```prisma
// ─── Billing Platform — Plans (DB-backed, managed by SuperAdmin) ───────────────

model BillingPlan {
  id                   String   @id @default(auto()) @map("_id") @db.ObjectId
  name                 String
  code                 String   @unique
  description          String?
  monthlyPrice         Float    @default(0)
  yearlyPrice          Float    @default(0)
  currency             String   @default("MAD")
  isActive             Boolean  @default(true)
  isDefault            Boolean  @default(false)
  displayOrder         Int      @default(0)
  // Feature configuration
  maxUsers             Int      @default(5)
  maxStorageGB         Float    @default(10)
  aiCredits            Int      @default(0)
  marketplaceEnabled   Boolean  @default(false)
  automationEnabled    Boolean  @default(false)
  certificationEnabled Boolean  @default(false)
  apiAccess            Boolean  @default(false)
  supportLevel         String   @default("COMMUNITY")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([isActive])
  @@index([code])
  @@index([displayOrder])
  @@map("billing_plans")
}
```

- [ ] **Step 3: Extend `PlatformEventName` in `src/core/types/index.ts`**

  Find the last entry in the PlatformEventName union (should be `'TrialEnding'` from Epic K). Add after it:

```typescript
  // Billing Plan Management
  | 'PlanCreated'
  | 'PlanUpdated'
  | 'PlanDeleted'
  | 'PlanActivated'
  | 'PlanDeactivated'
```

- [ ] **Step 4: Run Prisma generate**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx prisma generate
```
Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/plans/PlanTypes.ts prisma/schema.prisma src/core/types/index.ts && git commit -m "feat(billing-plans): PlanTypes, BillingPlan schema model, 5 new PlatformEventNames"
```

---

## Task 2 — PlanRepository

**Files:**
- Create: `src/billing/plans/PlanRepository.ts`

- [ ] **Step 1: Create `src/billing/plans/PlanRepository.ts`**

```typescript
// ─── Billing Plans — Repository ────────────────────────────────────────────

import type { BillingPlan, CreatePlanInput, UpdatePlanInput } from './PlanTypes'

async function db() {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).billingPlan
}

function toModel(row: any): BillingPlan {
  return {
    id: row.id, name: row.name, code: row.code,
    description: row.description ?? null,
    monthlyPrice: row.monthlyPrice, yearlyPrice: row.yearlyPrice,
    currency: row.currency, isActive: row.isActive, isDefault: row.isDefault,
    displayOrder: row.displayOrder, maxUsers: row.maxUsers,
    maxStorageGB: row.maxStorageGB, aiCredits: row.aiCredits,
    marketplaceEnabled: row.marketplaceEnabled, automationEnabled: row.automationEnabled,
    certificationEnabled: row.certificationEnabled, apiAccess: row.apiAccess,
    supportLevel: row.supportLevel, createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

export async function findAll(filter?: { isActive?: boolean }): Promise<BillingPlan[]> {
  const col   = await db()
  const where: any = {}
  if (filter?.isActive !== undefined) where.isActive = filter.isActive
  const rows  = await col.findMany({ where, orderBy: { displayOrder: 'asc' } })
  return rows.map(toModel)
}

export async function findById(id: string): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findUnique({ where: { id } })
  return row ? toModel(row) : null
}

export async function findByCode(code: string): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findUnique({ where: { code } })
  return row ? toModel(row) : null
}

export async function findDefault(): Promise<BillingPlan | null> {
  const col = await db()
  const row = await col.findFirst({ where: { isDefault: true } })
  return row ? toModel(row) : null
}

export async function create(input: CreatePlanInput): Promise<BillingPlan> {
  const col = await db()
  const row = await col.create({
    data: {
      name: input.name, code: input.code.toUpperCase(),
      description: input.description,
      monthlyPrice: input.monthlyPrice, yearlyPrice: input.yearlyPrice ?? 0,
      currency: input.currency ?? 'MAD',
      isActive: input.isActive ?? true, isDefault: input.isDefault ?? false,
      displayOrder: input.displayOrder ?? 0,
      maxUsers: input.maxUsers ?? 5, maxStorageGB: input.maxStorageGB ?? 10,
      aiCredits: input.aiCredits ?? 0,
      marketplaceEnabled: input.marketplaceEnabled ?? false,
      automationEnabled: input.automationEnabled ?? false,
      certificationEnabled: input.certificationEnabled ?? false,
      apiAccess: input.apiAccess ?? false,
      supportLevel: input.supportLevel ?? 'COMMUNITY',
    },
  })
  return toModel(row)
}

export async function update(id: string, input: UpdatePlanInput): Promise<BillingPlan> {
  const col = await db()
  const data: any = { ...input }
  if (data.code) data.code = data.code.toUpperCase()
  const row = await col.update({ where: { id }, data })
  return toModel(row)
}

export async function remove(id: string): Promise<void> {
  const col = await db()
  await col.delete({ where: { id } })
}

export async function unsetAllDefaults(): Promise<void> {
  const col = await db()
  await col.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
}

export async function countActiveSubscriptions(planCode: string): Promise<number> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).tenantProfile.count({
    where: { plan: planCode, state: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'] } },
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/plans/PlanRepository"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/plans/PlanRepository.ts && git commit -m "feat(billing-plans): PlanRepository — CRUD + countActiveSubscriptions"
```

---

## Task 3 — PlanValidation + PlanEvents

**Files:**
- Create: `src/billing/plans/PlanValidation.ts`
- Create: `src/billing/plans/PlanEvents.ts`

- [ ] **Step 1: Create `src/billing/plans/PlanValidation.ts`**

```typescript
// ─── Billing Plans — Validation ────────────────────────────────────────────

import { findByCode, findById, findDefault, countActiveSubscriptions } from './PlanRepository'
import type { CreatePlanInput, UpdatePlanInput } from './PlanTypes'

export class PlanValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PlanValidationError' }
}

export async function validateCreate(input: CreatePlanInput): Promise<void> {
  if (!input.name?.trim())  throw new PlanValidationError('Name is required')
  if (!input.code?.trim())  throw new PlanValidationError('Code is required')
  if (input.monthlyPrice < 0) throw new PlanValidationError('Monthly price cannot be negative')

  const existing = await findByCode(input.code.toUpperCase())
  if (existing) throw new PlanValidationError(`Plan with code "${input.code}" already exists`)
}

export async function validateUpdate(id: string, input: UpdatePlanInput): Promise<void> {
  const plan = await findById(id)
  if (!plan) throw new PlanValidationError('Plan not found')

  if (input.monthlyPrice !== undefined && input.monthlyPrice < 0) {
    throw new PlanValidationError('Monthly price cannot be negative')
  }

  if (input.code) {
    const existing = await findByCode(input.code.toUpperCase())
    if (existing && existing.id !== id) {
      throw new PlanValidationError(`Plan with code "${input.code}" already exists`)
    }
  }
}

export async function validateDelete(id: string): Promise<void> {
  const plan = await findById(id)
  if (!plan) throw new PlanValidationError('Plan not found')

  if (plan.isDefault) throw new PlanValidationError('Cannot delete the default plan')

  const activeCount = await countActiveSubscriptions(plan.code)
  if (activeCount > 0) {
    throw new PlanValidationError(
      `Cannot delete plan "${plan.code}" — it has ${activeCount} active subscription(s)`
    )
  }
}
```

- [ ] **Step 2: Create `src/billing/plans/PlanEvents.ts`**

```typescript
// ─── Billing Plans — Events ────────────────────────────────────────────────

import { eventBus } from '../../core'
import type { BillingPlan } from './PlanTypes'

export async function emitPlanCreated(plan: BillingPlan): Promise<void> {
  eventBus.publish('PlanCreated', { planId: plan.id, code: plan.code, name: plan.name }, 'billing-plans')
}

export async function emitPlanUpdated(plan: BillingPlan, changes: Record<string, unknown>): Promise<void> {
  eventBus.publish('PlanUpdated', { planId: plan.id, code: plan.code, changes }, 'billing-plans')
}

export async function emitPlanDeleted(planId: string, code: string): Promise<void> {
  eventBus.publish('PlanDeleted', { planId, code }, 'billing-plans')
}

export async function emitPlanActivated(plan: BillingPlan): Promise<void> {
  eventBus.publish('PlanActivated', { planId: plan.id, code: plan.code }, 'billing-plans')
}

export async function emitPlanDeactivated(plan: BillingPlan): Promise<void> {
  eventBus.publish('PlanDeactivated', { planId: plan.id, code: plan.code }, 'billing-plans')
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/plans/Plan"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/plans/PlanValidation.ts src/billing/plans/PlanEvents.ts && git commit -m "feat(billing-plans): PlanValidation (guards + error class) + PlanEvents (5 event emitters)"
```

---

## Task 4 — PlanService

**Files:**
- Create: `src/billing/plans/PlanService.ts`

**Dependencies:** PlanRepository, PlanValidation, PlanEvents, AuditService from `src/core`

- [ ] **Step 1: Read `src/core/index.ts`** to confirm `AuditService` export and `createAudit` method signature. Then read `src/core/types/index.ts` for `CreateAuditInput` shape.

- [ ] **Step 2: Create `src/billing/plans/PlanService.ts`**

```typescript
// ─── Billing Plans — Service ───────────────────────────────────────────────

import * as Repo       from './PlanRepository'
import * as Validation from './PlanValidation'
import * as Events     from './PlanEvents'
import { AuditService } from '../../core'
import type { BillingPlan, CreatePlanInput, UpdatePlanInput } from './PlanTypes'

const MODULE = 'BILLING_PLANS'

async function audit(action: string, entityId: string, performedBy: string, meta?: Record<string, unknown>) {
  await AuditService.createAudit({
    module:      MODULE,
    entity:      'BillingPlan',
    entityId,
    action,
    performedBy,
    metadata:    meta ? JSON.stringify(meta) : undefined,
  }).catch(() => undefined)
}

export async function listPlans(filter?: { isActive?: boolean }): Promise<BillingPlan[]> {
  return Repo.findAll(filter)
}

export async function getPlan(id: string): Promise<BillingPlan | null> {
  return Repo.findById(id)
}

export async function createPlan(input: CreatePlanInput, by: string): Promise<BillingPlan> {
  await Validation.validateCreate(input)
  if (input.isDefault) await Repo.unsetAllDefaults()
  const plan = await Repo.create(input)
  await Events.emitPlanCreated(plan)
  await audit('CREATE', plan.id, by, { code: plan.code, name: plan.name })
  return plan
}

export async function updatePlan(id: string, input: UpdatePlanInput, by: string): Promise<BillingPlan> {
  await Validation.validateUpdate(id, input)
  if (input.isDefault === true) await Repo.unsetAllDefaults()
  const plan = await Repo.update(id, input)
  await Events.emitPlanUpdated(plan, input as Record<string, unknown>)
  await audit('UPDATE', id, by, input as Record<string, unknown>)
  return plan
}

export async function deletePlan(id: string, by: string): Promise<void> {
  const plan = await Repo.findById(id)
  if (!plan) throw new Validation.PlanValidationError('Plan not found')
  await Validation.validateDelete(id)
  await Repo.remove(id)
  await Events.emitPlanDeleted(id, plan.code)
  await audit('DELETE', id, by, { code: plan.code })
}

export async function duplicatePlan(id: string, by: string): Promise<BillingPlan> {
  const source = await Repo.findById(id)
  if (!source) throw new Validation.PlanValidationError('Plan not found')

  const newCode = `${source.code}_COPY_${Date.now()}`
  const newPlan = await Repo.create({
    name:                 `${source.name} (Copy)`,
    code:                 newCode,
    description:          source.description ?? undefined,
    monthlyPrice:         source.monthlyPrice,
    yearlyPrice:          source.yearlyPrice,
    currency:             source.currency,
    isActive:             false,         // copies start inactive
    isDefault:            false,
    displayOrder:         source.displayOrder + 1,
    maxUsers:             source.maxUsers,
    maxStorageGB:         source.maxStorageGB,
    aiCredits:            source.aiCredits,
    marketplaceEnabled:   source.marketplaceEnabled,
    automationEnabled:    source.automationEnabled,
    certificationEnabled: source.certificationEnabled,
    apiAccess:            source.apiAccess,
    supportLevel:         source.supportLevel,
  })
  await Events.emitPlanCreated(newPlan)
  await audit('DUPLICATE', newPlan.id, by, { sourceId: id, sourceCode: source.code })
  return newPlan
}

export async function activatePlan(id: string, by: string): Promise<BillingPlan> {
  const plan = await Repo.update(id, { isActive: true })
  await Events.emitPlanActivated(plan)
  await audit('ACTIVATE', id, by)
  return plan
}

export async function deactivatePlan(id: string, by: string): Promise<BillingPlan> {
  const existing = await Repo.findById(id)
  if (existing?.isDefault) throw new Validation.PlanValidationError('Cannot deactivate the default plan')
  const plan = await Repo.update(id, { isActive: false })
  await Events.emitPlanDeactivated(plan)
  await audit('DEACTIVATE', id, by)
  return plan
}

export async function setDefaultPlan(id: string, by: string): Promise<BillingPlan> {
  await Repo.unsetAllDefaults()
  const plan = await Repo.update(id, { isDefault: true, isActive: true })
  await audit('SET_DEFAULT', id, by)
  return plan
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "billing/plans"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/billing/plans/PlanService.ts && git commit -m "feat(billing-plans): PlanService — create, update, delete, duplicate, activate, deactivate, setDefault + audit"
```

---

## Task 5 — API Routes + server.ts

**Files:**
- Create: `src/routes/billingPlansSA.ts`
- Modify: `src/routes/billingSuperAdmin.ts` (rename plan routes)
- Modify: `src/server.ts` (register new router)

- [ ] **Step 1: Rename existing plan routes in `src/routes/billingSuperAdmin.ts`**

  Find the two existing routes:
  ```
  router.get('/api/superadmin/billing/plans', ...)
  router.get('/api/superadmin/billing/plans/:plan', ...)
  ```
  Replace their paths with:
  ```
  router.get('/api/superadmin/billing/plan-catalog', ...)
  router.get('/api/superadmin/billing/plan-catalog/:plan', ...)
  ```

- [ ] **Step 2: Create `src/routes/billingPlansSA.ts`**

```typescript
// ─── Billing Plans — SuperAdmin Routes ────────────────────────────────────

import { Router } from 'express'
import * as PlanService from '../billing/plans/PlanService'
import { PlanValidationError } from '../billing/plans/PlanValidation'

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
  if (err instanceof PlanValidationError) return res.status(400).json({ error: err.message })
  return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
}

// GET /api/superadmin/billing/plans
router.get('/api/superadmin/billing/plans', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const filter: { isActive?: boolean } = {}
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true'
    const plans = await PlanService.listPlans(filter)
    res.json({ plans })
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/plans/:id
router.get('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.getPlan(req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans
router.post('/api/superadmin/billing/plans', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.createPlan(req.body, saEmail(req))
    res.status(201).json({ plan })
  } catch (err) { handleError(res, err) }
})

// PATCH /api/superadmin/billing/plans/:id
router.patch('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.updatePlan(req.params.id, req.body, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// DELETE /api/superadmin/billing/plans/:id
router.delete('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    await PlanService.deletePlan(req.params.id, saEmail(req))
    res.json({ ok: true })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/duplicate
router.post('/api/superadmin/billing/plans/:id/duplicate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.duplicatePlan(req.params.id, saEmail(req))
    res.status(201).json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/activate
router.post('/api/superadmin/billing/plans/:id/activate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.activatePlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/deactivate
router.post('/api/superadmin/billing/plans/:id/deactivate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.deactivatePlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/set-default
router.post('/api/superadmin/billing/plans/:id/set-default', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.setDefaultPlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

export default router
```

- [ ] **Step 3: Register in `src/server.ts`**

  Read `src/server.ts` to find where `billingRestaurantRouter` is registered, and add after it:
  ```typescript
  import billingPlansSARouter from './routes/billingPlansSA'
  ```
  And:
  ```typescript
  app.use(billingPlansSARouter)
  ```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add src/routes/billingPlansSA.ts src/routes/billingSuperAdmin.ts src/server.ts && git commit -m "feat(billing-plans): 9 SuperAdmin plan routes + register in server.ts + rename plan-catalog routes"
```

---

## Task 6 — SuperAdmin UI

**Files:**
- Create: `app/superadmin/billing/page.tsx`
- Create: `app/superadmin/billing/plans/page.tsx`

### UI Design Spec

**`billing/page.tsx`** — Billing hub  
Three card tiles linking to sub-sections:
- Plans → `/superadmin/billing/plans`
- Subscriptions → `/superadmin/billing/subscriptions` (coming soon, disabled)
- Invoices → `/superadmin/billing/invoices` (coming soon, disabled)

Dark zinc-950. Arabic default. 2-3 columns grid.

**`billing/plans/page.tsx`** — Plans management  
Patterns exactly as in `app/superadmin/marketplace/products/page.tsx`:
- `'use client'`
- `useSAAuth()` from `../../context` (**note: two levels up for billing/plans**)
- `lang` state defaults to `'ar'`, `isRTL = lang === 'ar'`
- Inline `T.ar` and `T.en` i18n objects
- `useCallback` + `useEffect` for data loading with debounced search

**Plans table columns:** Name, Code, Price (monthly), Features (badge row), Status, Default, Actions

**Action buttons per row:**
- Edit (pencil) → opens modal with pre-filled form
- Duplicate (copy) → POST `/:id/duplicate`, reload
- Activate / Deactivate toggle → POST `/:id/activate` or `/:id/deactivate`, reload
- Set Default (star) → POST `/:id/set-default`, reload (only show if not already default)
- Delete (trash) → confirm dialog → DELETE `/:id`, reload

**Create/Edit modal:**
- Fields: Name, Code (create only), Description, Monthly Price, Yearly Price, Currency, Display Order, Max Users, Max Storage GB, AI Credits, Marketplace Enabled, Automation Enabled, Certification Enabled, API Access, Support Level
- Validation: name required, code required (create), price >= 0
- Submit: POST /plans (create) or PATCH /plans/:id (edit)

**i18n strings needed (at minimum):**
- ar: `title: 'الخطط'`, `subtitle: 'إدارة خطط الاشتراك'`, `add: 'إضافة خطة'`, `search: 'بحث...'`, `edit: 'تعديل'`, `duplicate: 'نسخ'`, `activate: 'تفعيل'`, `deactivate: 'إيقاف'`, `setDefault: 'تعيين افتراضي'`, `deleteConfirm: 'هل أنت متأكد من الحذف؟'`, `name: 'الاسم'`, `code: 'الرمز'`, `price: 'السعر الشهري'`, `status: 'الحالة'`, `default: 'الافتراضي'`, `actions: 'إجراءات'`, `loading: 'جاري التحميل...'`, `noPlans: 'لا توجد خطط'`, `active: 'نشطة'`, `inactive: 'غير نشطة'`, `yes: 'نعم'`, `no: 'لا'`, `save: 'حفظ'`, `cancel: 'إلغاء'`, `features: 'الميزات'`
- en: equivalent English strings

**Status badge colors:**
- isActive: `bg-green-900 text-green-300` / `bg-zinc-700 text-zinc-300`
- isDefault: `bg-amber-900 text-amber-300`

**Feature badges (small pills):**
- marketplaceEnabled: blue
- automationEnabled: violet  
- certificationEnabled: emerald
- apiAccess: cyan

**Support Level badge:**
- COMMUNITY: zinc, EMAIL: blue, PRIORITY: orange, DEDICATED: purple

- [ ] **Step 1: Create `app/superadmin/billing/page.tsx`**

  Create a hub page with 3 tiles. First read an existing SA hub page (like `app/superadmin/ops/page.tsx` or the SA main page) for visual patterns.

- [ ] **Step 2: Create `app/superadmin/billing/plans/page.tsx`**

  Full plans management page as specced above. Copy the structure from `app/superadmin/marketplace/products/page.tsx` and adapt for plans.

  **Critical:** Auth header from `useSAAuth()` must be passed to every fetch. Import path for context: `import { useSAAuth } from '../../context'` (billing/plans → billing → superadmin → context.tsx).

  **State needed:**
  - `plans: BillingPlan[]`
  - `loading: boolean`
  - `search: string`
  - `showModal: boolean`
  - `editPlan: BillingPlan | null` (null = create mode)
  - `form: Partial<BillingPlan>` (form state for modal)
  - `saving: boolean`

  **API calls:**
  - Load: `GET /api/superadmin/billing/plans` (with search filter if needed — implement client-side filter since plans list will be small)
  - Create: `POST /api/superadmin/billing/plans`
  - Update: `PATCH /api/superadmin/billing/plans/:id`
  - Delete: `DELETE /api/superadmin/billing/plans/:id`
  - Duplicate: `POST /api/superadmin/billing/plans/:id/duplicate`
  - Activate: `POST /api/superadmin/billing/plans/:id/activate`
  - Deactivate: `POST /api/superadmin/billing/plans/:id/deactivate`
  - Set Default: `POST /api/superadmin/billing/plans/:id/set-default`

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep "superadmin/billing"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add app/superadmin/billing/ && git commit -m "feat(billing-plans): SuperAdmin Billing hub + Plans management page (AR/EN, CRUD modal, activate/deactivate/duplicate/set-default)"
```

---

## Task 7 — Update Documentation

**Files:**
- Modify: `docs/architecture/billing-platform.md`

- [ ] **Step 1: Add the following section after the existing "Data Models" section in `docs/architecture/billing-platform.md`**

```markdown
---

## Plan Management (Sprint K1)

### Overview

`BillingPlan` is a database-backed, SuperAdmin-managed plan entity. It is separate from the hardcoded `PLAN_DEFINITIONS` in `src/tenant/plans/index.ts` which define module access for the tenant lifecycle engine.

The `BillingPlan` model is the source of truth for what plans are sold to customers, at what prices, and with what feature entitlements.

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

Rules:
- `code` must be unique across all plans
- Exactly one plan can be `isDefault = true` at any time
- Cannot delete the default plan
- Cannot delete a plan with active tenant subscriptions
- Duplicated plans start as `isActive = false`

### Plan Events

| Event | When |
|-------|------|
| `PlanCreated` | New plan created (including duplicates) |
| `PlanUpdated` | Any field changed |
| `PlanDeleted` | Plan permanently removed |
| `PlanActivated` | Plan made available for sale |
| `PlanDeactivated` | Plan removed from sale |

### Future: Subscription Integration

In Sprint K2, `BillingSubscription` will reference `BillingPlan.code` to link tenants to their current plan. The QuotaService will then read limits from `BillingPlan` (DB) instead of `PLAN_DEFINITIONS` (hardcoded).
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau" && git add docs/architecture/billing-platform.md && git commit -m "docs(billing-plans): update architecture doc with Plan lifecycle, schema, future subscription integration"
```

---

## Task 8 — Final Verification + Push

- [ ] **Step 1: Verify all billing/plans files**

```bash
cd "/Users/mac/Documents/SaaS restau" && find src/billing/plans -name "*.ts" | sort && find app/superadmin/billing -name "*.tsx" | sort
```

Expected:
```
src/billing/plans/PlanCatalogService.ts  (existing, unchanged)
src/billing/plans/PlanEvents.ts
src/billing/plans/PlanRepository.ts
src/billing/plans/PlanService.ts
src/billing/plans/PlanTypes.ts
src/billing/plans/PlanValidation.ts
app/superadmin/billing/page.tsx
app/superadmin/billing/plans/page.tsx
```

- [ ] **Step 2: Verify route registration**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "billingPlansSA\|plan-catalog" src/server.ts src/routes/billingSuperAdmin.ts
```

Expected: import + app.use in server.ts, plan-catalog paths in billingSuperAdmin.ts.

- [ ] **Step 3: Verify Prisma model**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "BillingPlan\b" prisma/schema.prisma | head -5
```

Expected: model definition lines.

- [ ] **Step 4: Verify PlatformEventName extensions**

```bash
cd "/Users/mac/Documents/SaaS restau" && grep -n "PlanCreated\|PlanUpdated\|PlanDeleted\|PlanActivated\|PlanDeactivated" src/core/types/index.ts
```

Expected: 5 lines.

- [ ] **Step 5: Full TypeScript check**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx tsc --noEmit 2>&1 | grep -v "CrossModuleOrchestrator\|integration/orchestrator"
```
Expected: no output.

- [ ] **Step 6: Push**

```bash
cd "/Users/mac/Documents/SaaS restau" && git push
```

---

## Summary of Deliverables

| File | Type | What it does |
|------|------|--------------|
| `src/billing/plans/PlanTypes.ts` | New | BillingPlan, CreatePlanInput, UpdatePlanInput interfaces |
| `src/billing/plans/PlanRepository.ts` | New | Prisma CRUD for BillingPlan |
| `src/billing/plans/PlanValidation.ts` | New | Code uniqueness, default guard, delete guard |
| `src/billing/plans/PlanEvents.ts` | New | 5 EventBus emitters |
| `src/billing/plans/PlanService.ts` | New | Business logic + audit logging |
| `src/routes/billingPlansSA.ts` | New | 9 SuperAdmin endpoints |
| `app/superadmin/billing/page.tsx` | New | Billing hub page |
| `app/superadmin/billing/plans/page.tsx` | New | Plans CRUD UI |
| `prisma/schema.prisma` | Modified | +BillingPlan model |
| `src/core/types/index.ts` | Modified | +5 PlatformEventNames |
| `src/routes/billingSuperAdmin.ts` | Modified | Rename /plans → /plan-catalog |
| `src/server.ts` | Modified | Register billingPlansSA |
| `docs/architecture/billing-platform.md` | Modified | Plan lifecycle + schema section |
