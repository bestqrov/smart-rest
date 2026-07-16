# Comptoir POS + Caisse (Cash Shift) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone counter-sale POS screen (`/comptoir`) plus a Caisse de départ / Clôture flow (shared with the existing `/pos`) that includes staff shift timing and an overtime auto-lock, per `docs/superpowers/specs/2026-07-05-comptoir-pos-caisse-design.md`.

**Architecture:** Backend changes extend the existing `CashierShift` model and `POST /api/pos/shift` route (already has unused `open`/`close` actions) with planned-end-time, counted-cash reconciliation, and a lock flag enforced by a new middleware + cron. Two new POS-scoped endpoints (`/api/pos/customers`) reuse the existing `CustomerService`. On the frontend, shared Caisse UI (hook + 4 small components) is built once and used by both `/pos` (retrofitted) and the new `/comptoir` page, which otherwise reuses the existing `/api/pos/menu`, `/api/pos/orders`, and `/api/pos/orders/:id/checkout` endpoints.

**Tech Stack:** Express + Prisma (MongoDB) on the backend, Next.js App Router client components on the frontend, `node-cron` for the overtime sweep, no test framework configured — verification follows this repo's existing convention (`scripts/controlTest.ts`-style integration scripts run against a live dev server with `ts-node`).

**Note on TDD in this repo:** There is no Jest/Vitest setup and no `*.test.ts` files anywhere in the codebase — the established verification pattern is a `scripts/*.ts` script using `node-fetch` + a tiny `ok()` assertion helper, run manually against `npm run dev`. This plan follows that convention instead of inventing a new test framework: backend tasks are verified individually with `curl`/quick manual checks, then Task 10 adds one consolidated integration script (mirroring `scripts/controlTest.ts`) that exercises the full backend surface built in Tasks 1–9. Frontend tasks are verified with `npx tsc --noEmit` (fast type-check feedback) per task, then a full manual browser pass in the final task, per this repo's own convention of testing UI changes live before declaring them done.

---

## File Structure

**Schema:**
- Modify: `prisma/schema.prisma` — add 4 fields to `CashierShift`.

**Backend:**
- Modify: `src/routes/pos/shift.ts` — planned end time on open, counted cash + discrepancy on close, demo-mode parity fix.
- Create: `src/middleware/requireUnlockedShift.ts` — blocks selling actions when a shift is locked.
- Create: `src/cron/shiftOvertimeLock.ts` — sweeps shifts 1h past their planned end time and locks them.
- Create: `src/routes/pos/shiftAdmin.ts` — admin-facing list-locked / unlock endpoints.
- Modify: `src/routes/pos/orders.ts` — persist `orderType`; guard with the new middleware.
- Modify: `src/routes/pos/checkout.ts` — guard both checkout routes with the new middleware.
- Create: `src/routes/pos/customers.ts` — POS-scoped customer search + quick-create.
- Modify: `src/server.ts` — mount 2 new routers, start 1 new cron.

**Test script:**
- Create: `scripts/controlTestComptoir.ts` — integration coverage for everything above.

**Frontend (shared):**
- Create: `src/lib/posReceipt.ts` — receipt-printing helper, extracted from `app/pos/page.tsx`.
- Create: `src/hooks/useCashierShift.ts` — shift status/open/close/timing state, shared by both pages.
- Create: `src/components/pos/CaisseDepartScreen.tsx`
- Create: `src/components/pos/ClotureModal.tsx`
- Create: `src/components/pos/ShiftTimingPill.tsx`
- Create: `src/components/pos/LockedOverlay.tsx`
- Modify: `app/pos/page.tsx` — use the extracted receipt helper + wire in the Caisse gate, timing pill, lock overlay, Clôture button.

**Frontend (new page):**
- Create: `app/comptoir/page.tsx` — full Comptoir screen (login → Caisse gate → categories/products/facture/footer → confirm & print).

---

## Task 1: `CashierShift` schema fields

**Files:**
- Modify: `prisma/schema.prisma:789-806`

- [ ] **Step 1: Add the new fields**

Open `prisma/schema.prisma` and find the `CashierShift` model:

```prisma
model CashierShift {
  id         String      @id @default(auto()) @map("_id") @db.ObjectId
  cafeId     String      @db.ObjectId
  cafe       Cafe        @relation(fields: [cafeId], references: [id])
  staffId    String      @db.ObjectId
  staff      Staff       @relation(fields: [staffId], references: [id])
  status     ShiftStatus @default(OPEN)
  startTime  DateTime    @default(now())
  endTime    DateTime?
  // cash in drawer at shift start
  initialCash       Float @default(0)
  // sum of all cash payments collected during the shift
  totalCollectedCash Float @default(0)
  notes      String?

  @@index([cafeId])
  @@index([staffId])
  @@index([status])
}
```

Replace it with:

```prisma
model CashierShift {
  id         String      @id @default(auto()) @map("_id") @db.ObjectId
  cafeId     String      @db.ObjectId
  cafe       Cafe        @relation(fields: [cafeId], references: [id])
  staffId    String      @db.ObjectId
  staff      Staff       @relation(fields: [staffId], references: [id])
  status     ShiftStatus @default(OPEN)
  startTime  DateTime    @default(now())
  endTime    DateTime?
  // cash in drawer at shift start
  initialCash       Float @default(0)
  // sum of all cash payments collected during the shift
  totalCollectedCash Float @default(0)
  notes      String?

  // Staff-declared time they expect to leave, entered alongside initialCash
  // when the shift opens. Drives the "Timing to out" UI and the overtime
  // auto-lock below.
  plannedEndTime DateTime?
  // Staff-entered actual cash count at clôture (montant compté).
  countedCash    Float?
  // countedCash - (initialCash + totalCollectedCash); positive = surplus,
  // negative = shortfall. Null until the shift is closed.
  discrepancy    Float?
  // Set by the overtime cron (src/cron/shiftOvertimeLock.ts) when the shift
  // is still OPEN more than 1h past plannedEndTime. Cleared only by an
  // admin (src/routes/pos/shiftAdmin.ts), never by the staff themselves.
  lockedAt       DateTime?

  @@index([cafeId])
  @@index([staffId])
  @@index([status])
  @@index([lockedAt])
}
```

- [ ] **Step 2: Push the schema to the database**

Run: `npx prisma generate && npx prisma db push`
Expected: output ends with `Your database is now in sync with your Prisma schema.` and no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add shift timing and lock fields to CashierShift"
```

---

## Task 2: Shift open — planned end time + shared helpers + demo-mode parity

**Files:**
- Modify: `src/routes/pos/shift.ts` (full rewrite of the action handlers below)

The current `action: 'open'` handler only exists in the PIN branch. The demo-mode branch (used by the `welcome` demo subdomain) returns early for *every* action without ever creating or closing a shift — meaning Caisse de départ would silently do nothing in demo mode. Fix this by extracting `openShiftFor`/`closeShiftFor` helpers used by both branches.

- [ ] **Step 1: Add the shared helpers and use them from the PIN branch**

In `src/routes/pos/shift.ts`, after the `validatePin` function (around line 44), add:

```ts
// ─── shift helpers — shared by the PIN branch and the demo-mode branch ───────

async function openShiftFor(
  staffId: string,
  cafeId: string,
  initialCash: number,
  plannedEndTime?: string,
  notes?: string
) {
  const openShift = await prisma.cashierShift.findFirst({
    where: { staffId, cafeId, status: 'OPEN' }
  })
  if (openShift) {
    const err: any = new Error('A shift is already open for this staff member')
    err.status = 409
    err.shiftId = openShift.id
    throw err
  }

  let parsedPlannedEndTime: Date | undefined
  if (plannedEndTime) {
    parsedPlannedEndTime = new Date(plannedEndTime)
    if (isNaN(parsedPlannedEndTime.getTime())) {
      const err: any = new Error('plannedEndTime is not a valid date')
      err.status = 400
      throw err
    }
  }

  return prisma.cashierShift.create({
    data: {
      cafeId,
      staffId,
      status:             'OPEN',
      initialCash:        initialCash ?? 0,
      totalCollectedCash: 0,
      plannedEndTime:     parsedPlannedEndTime ?? null,
      notes:              notes ?? null
    }
  })
}

async function closeShiftFor(staffId: string, cafeId: string, countedCash?: number) {
  const shift = await prisma.cashierShift.findFirst({
    where: { staffId, cafeId, status: 'OPEN' }
  })
  if (!shift) {
    const err: any = new Error('No open shift found for this staff member')
    err.status = 404
    throw err
  }

  const cashOrders = await prisma.order.aggregate({
    where: {
      cafeId,
      createdById:   staff_id_placeholder(staffId),
      paymentMethod: 'CASH',
      isPaid:        true,
      createdAt:     { gte: shift.startTime }
    },
    _sum: { totalPrice: true }
  })
  const totalCollectedCash = cashOrders._sum.totalPrice ?? 0

  let discrepancy: number | null = null
  if (typeof countedCash === 'number' && !isNaN(countedCash)) {
    discrepancy = countedCash - (shift.initialCash + totalCollectedCash)
  }

  return prisma.cashierShift.update({
    where: { id: shift.id },
    data: {
      status:             'CLOSED',
      endTime:            new Date(),
      totalCollectedCash,
      countedCash:        typeof countedCash === 'number' ? countedCash : null,
      discrepancy
    }
  })
}

function staff_id_placeholder(staffId: string) { return staffId }
```

(The `staff_id_placeholder` wrapper only exists so this diff reads clearly against the original inline query below — remove it in Step 2 and call `staffId` directly instead. It is not meant to survive; see Step 2.)

- [ ] **Step 2: Clean up the placeholder and replace the PIN-branch handlers**

Immediately fix the helper you just wrote: in `openShiftFor`/`closeShiftFor` above, `staff_id_placeholder` was scaffolding — delete that function and change `createdById: staff_id_placeholder(staffId)` to `createdById: staffId` directly. The final `closeShiftFor` body's aggregate `where` clause reads:

```ts
  const cashOrders = await prisma.order.aggregate({
    where: {
      cafeId,
      createdById:   staffId,
      paymentMethod: 'CASH',
      isPaid:        true,
      createdAt:     { gte: shift.startTime }
    },
    _sum: { totalPrice: true }
  })
```

Now replace the existing `action === 'open'` block:

```ts
    // ── "open" — open a new shift ─────────────────────────────────────────────
    if (action === 'open') {
      const openShift = await prisma.cashierShift.findFirst({
        where: { staffId: staff.id, cafeId, status: 'OPEN' }
      })
      if (openShift) {
        return res.status(409).json({
          error:  'A shift is already open for this staff member',
          shiftId: openShift.id
        })
      }

      const shift = await prisma.cashierShift.create({
        data: {
          cafeId,
          staffId:            staff.id,
          status:             'OPEN',
          initialCash:        initialCash ?? 0,
          totalCollectedCash: 0,
          notes:              notes ?? null
        }
      })

      const token = issueStaffToken(staff.id, cafeId, staff.role as StaffRole, shift.id)
      logger.info({ msg: 'POS shift opened', shiftId: shift.id, staffId: staff.id })
      return res.status(201).json({ token, shift })
    }
```

with:

```ts
    // ── "open" — open a new shift ─────────────────────────────────────────────
    if (action === 'open') {
      try {
        const shift = await openShiftFor(staff.id, cafeId, initialCash ?? 0, plannedEndTime, notes)
        const token = issueStaffToken(staff.id, cafeId, staff.role as StaffRole, shift.id)
        logger.info({ msg: 'POS shift opened', shiftId: shift.id, staffId: staff.id })
        return res.status(201).json({ token, shift })
      } catch (err: any) {
        return res.status(err.status ?? 500).json({ error: err.message, shiftId: err.shiftId })
      }
    }
```

And replace the `action === 'close'` block:

```ts
    // ── "close" — close the current open shift ────────────────────────────────
    if (action === 'close') {
      const shift = await prisma.cashierShift.findFirst({
        where: { staffId: staff.id, cafeId, status: 'OPEN' }
      })
      if (!shift) return res.status(404).json({ error: 'No open shift found for this staff member' })

      // Calculate total cash collected: sum of CASH, isPaid orders during this shift
      const cashOrders = await prisma.order.aggregate({
        where: {
          cafeId,
          createdById:   staff.id,
          paymentMethod: 'CASH',
          isPaid:        true,
          createdAt:     { gte: shift.startTime }
        },
        _sum: { totalPrice: true }
      })
      const totalCollectedCash = cashOrders._sum.totalPrice ?? 0

      const closed = await prisma.cashierShift.update({
        where: { id: shift.id },
        data: {
          status:             'CLOSED',
          endTime:            new Date(),
          totalCollectedCash
        }
      })

      logger.info({ msg: 'POS shift closed', shiftId: closed.id, totalCollectedCash })
      return res.json({ shift: closed })
    }
```

with:

```ts
    // ── "close" — close the current open shift ────────────────────────────────
    if (action === 'close') {
      try {
        const closed = await closeShiftFor(staff.id, cafeId, countedCash)
        logger.info({ msg: 'POS shift closed', shiftId: closed.id, totalCollectedCash: closed.totalCollectedCash, discrepancy: closed.discrepancy })
        return res.json({ shift: closed })
      } catch (err: any) {
        return res.status(err.status ?? 500).json({ error: err.message })
      }
    }
```

- [ ] **Step 3: Accept `plannedEndTime` and `countedCash` in the request body**

Find the destructuring near the top of the route handler:

```ts
    const { cafeId: rawCafeId, subdomain, pinCode, action, initialCash, notes } = req.body as {
      cafeId?:      string
      subdomain?:   string   // convenience alias — resolved to cafeId below
      pinCode:      string
      action:       'login' | 'open' | 'close' | 'status'
      initialCash?: number
      notes?:       string
    }
```

Replace with:

```ts
    const { cafeId: rawCafeId, subdomain, pinCode, action, initialCash, notes, plannedEndTime, countedCash } = req.body as {
      cafeId?:         string
      subdomain?:      string   // convenience alias — resolved to cafeId below
      pinCode:         string
      action:          'login' | 'open' | 'close' | 'status'
      initialCash?:    number
      notes?:          string
      plannedEndTime?: string   // ISO datetime — staff's declared "sortie prévue"
      countedCash?:    number   // staff-entered cash count at clôture
    }
```

- [ ] **Step 4: Fix demo-mode parity so `open`/`close` also work for the demo subdomain**

Find the demo-mode block:

```ts
    // ── Demo mode: bypass PIN if subdomain is DEMO_SUBDOMAIN and demoStaffId provided ──
    const DEMO_SUB = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    if (subdomain?.trim().toLowerCase() === DEMO_SUB && req.body.demoStaffId) {
      const demoStaff = await prisma.staff.findFirst({
        where: { id: req.body.demoStaffId, cafeId, isActive: true },
        select: { id: true, name: true, role: true },
      })
      if (!demoStaff) return res.status(404).json({ error: 'Staff not found' })
      const existingShift = await prisma.cashierShift.findFirst({
        where: { staffId: demoStaff.id, cafeId, status: 'OPEN' }
      })
      const token = issueStaffToken(demoStaff.id, cafeId, demoStaff.role as StaffRole, existingShift?.id)
      return res.json({
        token,
        staff: { id: demoStaff.id, name: demoStaff.name, role: demoStaff.role },
        shift: existingShift ?? null
      })
    }
```

Replace with:

```ts
    // ── Demo mode: bypass PIN if subdomain is DEMO_SUBDOMAIN and demoStaffId provided ──
    const DEMO_SUB = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    if (subdomain?.trim().toLowerCase() === DEMO_SUB && req.body.demoStaffId) {
      const demoStaff = await prisma.staff.findFirst({
        where: { id: req.body.demoStaffId, cafeId, isActive: true },
        select: { id: true, name: true, role: true },
      })
      if (!demoStaff) return res.status(404).json({ error: 'Staff not found' })

      if (action === 'open') {
        try {
          const shift = await openShiftFor(demoStaff.id, cafeId, initialCash ?? 0, plannedEndTime, notes)
          const token = issueStaffToken(demoStaff.id, cafeId, demoStaff.role as StaffRole, shift.id)
          return res.status(201).json({ token, staff: demoStaff, shift })
        } catch (err: any) {
          return res.status(err.status ?? 500).json({ error: err.message, shiftId: err.shiftId })
        }
      }

      if (action === 'close') {
        try {
          const closed = await closeShiftFor(demoStaff.id, cafeId, countedCash)
          return res.json({ shift: closed })
        } catch (err: any) {
          return res.status(err.status ?? 500).json({ error: err.message })
        }
      }

      // default (login / anything else): same behavior as before — return
      // a token plus whatever shift is currently open, without creating one.
      const existingShift = await prisma.cashierShift.findFirst({
        where: { staffId: demoStaff.id, cafeId, status: 'OPEN' }
      })
      const token = issueStaffToken(demoStaff.id, cafeId, demoStaff.role as StaffRole, existingShift?.id)
      return res.json({
        token,
        staff: { id: demoStaff.id, name: demoStaff.name, role: demoStaff.role },
        shift: existingShift ?? null
      })
    }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `src/routes/pos/shift.ts`.

- [ ] **Step 6: Manual check against a running server**

Run: `npm run dev` in one terminal, then in another:

```bash
curl -s -X POST http://localhost:4000/api/pos/shift \
  -H 'Content-Type: application/json' \
  -d '{"subdomain":"welcome","action":"login","demoStaffId":"REPLACE_WITH_A_REAL_DEMO_STAFF_ID"}'
```

(Get a real demo staff id first with `curl -s 'http://localhost:4000/api/public/demo-staff?subdomain=welcome'`.)

Then open a shift:

```bash
curl -s -X POST http://localhost:4000/api/pos/shift \
  -H 'Content-Type: application/json' \
  -d '{"subdomain":"welcome","action":"open","demoStaffId":"SAME_STAFF_ID","initialCash":200,"plannedEndTime":"2026-07-05T22:00:00.000Z"}'
```

Expected: `201` with a `shift` object where `initialCash: 200` and `plannedEndTime` matches what you sent.

- [ ] **Step 7: Commit**

```bash
git add src/routes/pos/shift.ts
git commit -m "feat(pos): add plannedEndTime + countedCash/discrepancy to shift open/close"
```

---

## Task 3: `requireUnlockedShift` middleware

**Files:**
- Create: `src/middleware/requireUnlockedShift.ts`

- [ ] **Step 1: Write the middleware**

```ts
import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'

/**
 * Blocks POS "selling" actions (create order, checkout, create customer)
 * when the authenticated staff member's shift has been locked by the
 * overtime cron (src/cron/shiftOvertimeLock.ts). Only an admin can clear
 * the lock (src/routes/pos/shiftAdmin.ts) — the staff member cannot
 * self-resolve it by closing or reopening a shift.
 *
 * No-ops if the staff token has no shiftId (e.g. no shift opened yet) —
 * this middleware only enforces a lock, it does not require a shift to
 * exist.
 */
export async function requireUnlockedShift(req: Request, res: Response, next: NextFunction) {
  try {
    const shiftId = req.staff?.shiftId
    if (!shiftId) return next()

    const shift = await prisma.cashierShift.findUnique({
      where:  { id: shiftId },
      select: { lockedAt: true }
    })

    if (shift?.lockedAt) {
      return res.status(423).json({
        error:    'POS locked — contact your manager to unlock it',
        lockedAt: shift.lockedAt
      })
    }

    return next()
  } catch (err) {
    logger.error({ msg: 'requireUnlockedShift error', err })
    return res.status(500).json({ error: 'Lock check failed' })
  }
}

export default requireUnlockedShift
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing the new file.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/requireUnlockedShift.ts
git commit -m "feat(pos): add requireUnlockedShift middleware"
```

---

## Task 4: Overtime lock cron

**Files:**
- Create: `src/cron/shiftOvertimeLock.ts`
- Modify: `src/server.ts:124` (import) and `src/server.ts:383` (register)

- [ ] **Step 1: Write the cron**

```ts
/**
 * Shift Overtime Lock Cron — runs every 5 minutes
 *
 * Any OPEN CashierShift whose plannedEndTime is more than 1 hour in the
 * past gets locked (lockedAt = now). Locked shifts are blocked from
 * selling (see src/middleware/requireUnlockedShift.ts) until an admin
 * unlocks them via PATCH /api/admin/shifts/:shiftId/unlock.
 */

import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'

const OVERTIME_GRACE_MS = 60 * 60 * 1000 // 1 hour

export function startShiftOvertimeLockCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runShiftOvertimeLock()
      if (result.locked > 0) {
        logger.info({ msg: '[CRON] Shift overtime lock', locked: result.locked })
      }
    } catch (err) {
      logger.error({ msg: '[CRON] Shift overtime lock failed', err })
    }
  })
  logger.info({ msg: '[CRON] Shift overtime lock cron registered (every 5 min)' })
  return task
}

// Exported for manual trigger (superadmin route, tests)
export async function runShiftOvertimeLock(): Promise<{ locked: number }> {
  const cutoff = new Date(Date.now() - OVERTIME_GRACE_MS)

  const result = await prisma.cashierShift.updateMany({
    where: {
      status:         'OPEN',
      plannedEndTime: { lt: cutoff },
      lockedAt:       null
    },
    data: { lockedAt: new Date() }
  })

  return { locked: result.count }
}
```

- [ ] **Step 2: Register it in `src/server.ts`**

Find the import block (near line 124):

```ts
import { startDailyDebtDetectionCron } from './cron/dailyDebtDetection'
```

Add directly below it:

```ts
import { startShiftOvertimeLockCron } from './cron/shiftOvertimeLock'
```

Find the `cronTasks` array (near line 383):

```ts
  const cronTasks = [
    startDailyDebtDetectionCron(),
    startWeeklyBillingCron(),
    startNightlyCron(),
    startCertificationCron(),
    startSubscriptionLifecycleCron(),
    startWhatsAppSchedulerCron(),
    startEmailSchedulerCron(),
    startSocialSchedulerCron(),
  ]
```

Add `startShiftOvertimeLockCron(),` to the list:

```ts
  const cronTasks = [
    startDailyDebtDetectionCron(),
    startWeeklyBillingCron(),
    startNightlyCron(),
    startCertificationCron(),
    startSubscriptionLifecycleCron(),
    startWhatsAppSchedulerCron(),
    startEmailSchedulerCron(),
    startSocialSchedulerCron(),
    startShiftOvertimeLockCron(),
  ]
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, confirm the log line `[CRON] Shift overtime lock cron registered (every 5 min)` appears at boot.

- [ ] **Step 5: Commit**

```bash
git add src/cron/shiftOvertimeLock.ts src/server.ts
git commit -m "feat(pos): add overtime shift-lock cron"
```

---

## Task 5: Admin shift-unlock endpoints

**Files:**
- Create: `src/routes/pos/shiftAdmin.ts`
- Modify: `src/server.ts:117` (import) and `src/server.ts:319` (mount)

- [ ] **Step 1: Write the route**

```ts
/**
 * Admin-facing endpoints for CashierShift lock management.
 *
 * GET   /api/admin/shifts/locked        — list currently-locked shifts for this cafe
 * PATCH /api/admin/shifts/:shiftId/unlock — clear the lock so the staff member can sell again
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import { authorizeAdmin } from '../../middleware/authorizeAdmin'

const router = express.Router()

router.get('/api/admin/shifts/locked', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const shifts = await prisma.cashierShift.findMany({
      where:   { cafeId, lockedAt: { not: null }, status: 'OPEN' },
      include: { staff: { select: { id: true, name: true, role: true } } },
      orderBy: { lockedAt: 'desc' }
    })
    return res.json({ shifts })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/shifts/locked error', err })
    return res.status(500).json({ error: 'Failed to fetch locked shifts' })
  }
})

router.patch('/api/admin/shifts/:shiftId/unlock', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const shiftId = req.params['shiftId'] as string

    const shift = await prisma.cashierShift.findFirst({ where: { id: shiftId, cafeId } })
    if (!shift) return res.status(404).json({ error: 'Shift not found' })
    if (!shift.lockedAt) return res.status(409).json({ error: 'Shift is not locked' })

    const updated = await prisma.cashierShift.update({
      where: { id: shiftId },
      data:  { lockedAt: null }
    })

    logger.info({ msg: 'Admin unlocked shift', shiftId, cafeId, adminId: req.admin!.userId })
    return res.json({ shift: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/shifts/:shiftId/unlock error', err })
    return res.status(500).json({ error: 'Failed to unlock shift' })
  }
})

export default router
```

- [ ] **Step 2: Mount it in `src/server.ts`**

Find the import (near line 117):

```ts
import customersRouter        from './routes/customers'
```

Add directly below it:

```ts
import shiftAdminRouter       from './routes/pos/shiftAdmin'
```

Find the mount point (near line 319):

```ts
  app.use(customersRouter)
```

Add directly below it:

```ts
  app.use(shiftAdminRouter)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/pos/shiftAdmin.ts src/server.ts
git commit -m "feat(admin): add locked-shift list + unlock endpoints"
```

---

## Task 6: Persist `orderType` on POS orders

**Files:**
- Modify: `src/routes/pos/orders.ts:23-138`

- [ ] **Step 1: Accept `orderType` in the request body**

Find:

```ts
router.post('/api/pos/orders', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId, shiftId } = req.staff!
    const { tableId, items, paymentMethod, customerPhone } = req.body as {
      tableId?:       string
      items:          ItemInput[]
      paymentMethod:  'CASH' | 'CARD' | 'ONLINE'
      customerPhone?: string
    }
```

Replace with:

```ts
router.post('/api/pos/orders', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId, shiftId } = req.staff!
    const { tableId, items, paymentMethod, customerPhone, orderType } = req.body as {
      tableId?:       string
      items:          ItemInput[]
      paymentMethod:  'CASH' | 'CARD' | 'ONLINE'
      customerPhone?: string
      orderType?:     'DINE_IN' | 'TAKEAWAY'
    }
```

- [ ] **Step 2: Persist it on order creation**

Find the `prisma.order.create` call:

```ts
    const order = await prisma.order.create({
      data: {
        cafeId,
        tableId:         tableId ?? null,
        paymentMethod,
        orderSource:     'POS_MANUAL',
        billStatus:      'OPENED',
        status:          'PENDING',
        totalPrice:      orderTotal,
        totalCommission,
        customerPhone:   customerPhone ?? null,
        createdById:     staffId,
        items: {
          create: lineItems
        }
      },
      include: { items: { include: { product: true } } }
    })
```

Replace with:

```ts
    const order = await prisma.order.create({
      data: {
        cafeId,
        tableId:         tableId ?? null,
        paymentMethod,
        orderSource:     'POS_MANUAL',
        billStatus:      'OPENED',
        status:          'PENDING',
        totalPrice:      orderTotal,
        totalCommission,
        customerPhone:   customerPhone ?? null,
        orderType:       orderType ?? null,
        createdById:     staffId,
        items: {
          create: lineItems
        }
      },
      include: { items: { include: { product: true } } }
    })
```

- [ ] **Step 3: Import the new middleware**

Find the import block at the top of the file:

```ts
import authorizePOS from '../../middleware/authorizePOS'
```

Add directly below it:

```ts
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/pos/orders.ts
git commit -m "feat(pos): persist orderType on order creation, guard with shift lock"
```

---

## Task 7: Guard checkout routes with the shift lock

**Files:**
- Modify: `src/routes/pos/checkout.ts`

- [ ] **Step 1: Import the middleware**

Find:

```ts
import authorizePOS from '../../middleware/authorizePOS'
```

Add directly below it:

```ts
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
```

- [ ] **Step 2: Apply it to both routes**

Find:

```ts
router.patch('/api/pos/orders/:orderId/checkout', authorizePOS, async (req: Request, res: Response) => {
```

Replace with:

```ts
router.patch('/api/pos/orders/:orderId/checkout', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
```

Find:

```ts
router.patch('/api/pos/tables/:tableId/checkout', authorizePOS, async (req: Request, res: Response) => {
```

Replace with:

```ts
router.patch('/api/pos/tables/:tableId/checkout', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/pos/checkout.ts
git commit -m "feat(pos): guard checkout routes with shift lock"
```

---

## Task 8: POS-scoped customer search + quick-create

**Files:**
- Create: `src/routes/pos/customers.ts`
- Modify: `src/server.ts:46` (import) and `src/server.ts:249` (mount)

The existing `searchCustomers` in `src/customers/CustomerService.ts` is currently only reachable via `authorizeAdmin` routes (`src/routes/customers.ts`). Staff need their own narrower access for the mandatory client picker in Comptoir.

- [ ] **Step 1: Write the route**

```ts
/**
 * POS-scoped customer endpoints — search existing CafeCustomer records or
 * quick-create one, for the mandatory client picker on the Comptoir screen.
 * Requires POS Bearer token (authorizePOS), same as the rest of /api/pos/*.
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
import { searchCustomers } from '../../customers/CustomerService'

const router = express.Router()

// ─── GET /api/pos/customers?search= ────────────────────────────────────────

router.get('/api/pos/customers', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const search = (req.query.search as string) ?? ''
    const result = await searchCustomers(cafeId, { search, limit: 20 })
    return res.json(result)
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/customers error', err })
    return res.status(500).json({ error: 'Failed to search customers' })
  }
})

// ─── POST /api/pos/customers — quick-create a walk-in client ───────────────

router.post('/api/pos/customers', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const { phone, name } = req.body as { phone?: string; name?: string }

    if (!phone) return res.status(400).json({ error: 'phone is required' })

    const normalized = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    const customer = await prisma.cafeCustomer.upsert({
      where:  { cafeId_phone: { cafeId, phone: normalized } },
      create: {
        cafeId,
        phone:     normalized,
        name:      name?.trim() || null,
        lastVisit: new Date(),
        visits:    1,
        optIn:     true,
      },
      update: {
        lastVisit: new Date(),
        visits:    { increment: 1 },
        ...(name?.trim() ? { name: name.trim() } : {}),
      }
    })

    return res.status(201).json({ customer })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/customers error', err })
    return res.status(500).json({ error: 'Failed to create customer' })
  }
})

export default router
```

- [ ] **Step 2: Mount it in `src/server.ts`**

Find the import (near line 46):

```ts
import posOrdersRouter from './routes/pos/orders'
```

Add directly below it:

```ts
import posCustomersRouter from './routes/pos/customers'
```

Find the mount point (near line 249):

```ts
  app.use(posOrdersRouter)
```

Add directly below it:

```ts
  app.use(posCustomersRouter)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/pos/customers.ts src/server.ts
git commit -m "feat(pos): add POS-scoped customer search + quick-create"
```

---

## Task 9: Consolidated backend integration test script

**Files:**
- Create: `scripts/controlTestComptoir.ts`

This exercises everything built in Tasks 1–8 against a real running server, using the `welcome` demo cafe (no PIN needed), following the same pattern as the existing `scripts/controlTest.ts`.

- [ ] **Step 1: Write the script**

```ts
/**
 * Comptoir + Caisse control test — verifies shift open/close (with
 * plannedEndTime/countedCash/discrepancy), orderType persistence, the
 * POS customer endpoints, and the overtime lock/unlock cycle.
 *
 * Requires the `welcome` demo cafe to exist (see scripts/controlTest.ts
 * for the same assumption).
 *
 * Run: npx ts-node --transpile-only scripts/controlTestComptoir.ts
 */

import dotenv from 'dotenv'
dotenv.config()

import fetch from 'node-fetch'
import prisma from '../src/prisma'

const SERVER = process.env.SERVER_URL || 'http://localhost:4000'
const DEMO_SUBDOMAIN = process.env.DEMO_SUBDOMAIN || 'welcome'

let passed = 0
let failed = 0

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅  ${label}`)
    passed++
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

async function post(path: string, data: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function patch(path: string, data: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, { headers })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function main() {
  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  Comptoir + Caisse — Control Test`)
  console.log(`  Target: ${SERVER}`)
  console.log(`${'═'.repeat(56)}`)

  // ── Setup: grab a demo staff member ────────────────────────────────────────
  console.log('\n── Setup ───────────────────────────────────────────────')
  const { status: demoStatus, body: demoBody } = await get(`/api/public/demo-staff?subdomain=${DEMO_SUBDOMAIN}`)
  if (demoStatus !== 200 || !demoBody.staff?.length) {
    console.error('Cannot continue: no demo staff found. Is the `welcome` demo cafe seeded?')
    process.exit(1)
  }
  const demoStaffId = demoBody.staff[0].id
  ok('Demo staff list fetched', true)

  // Close any shift left open by a previous run so `open` below doesn't 409
  await post('/api/pos/shift', { subdomain: DEMO_SUBDOMAIN, action: 'close', demoStaffId, countedCash: 0 })

  // ── Login ────────────────────────────────────────────────────────────────
  const { status: loginStatus, body: loginBody } = await post('/api/pos/shift', {
    subdomain: DEMO_SUBDOMAIN, action: 'login', demoStaffId,
  })
  ok('Demo login → 200 with token', loginStatus === 200 && !!loginBody.token)
  const cafeId = JSON.parse(Buffer.from(loginBody.token.split('.')[1], 'base64').toString()).cafeId

  // ── Open shift with plannedEndTime ──────────────────────────────────────────
  console.log('\n── Shift open/close ────────────────────────────────────')
  const plannedEndTime = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h from now
  const { status: openStatus, body: openBody } = await post('/api/pos/shift', {
    subdomain: DEMO_SUBDOMAIN, action: 'open', demoStaffId, initialCash: 200, plannedEndTime,
  })
  ok('Open shift → 201', openStatus === 201, JSON.stringify(openBody))
  ok('Shift has initialCash 200', openBody.shift?.initialCash === 200)
  ok('Shift has plannedEndTime set', !!openBody.shift?.plannedEndTime)
  const shiftToken = openBody.token
  const shiftId = openBody.shift.id

  const { status: reopenStatus } = await post('/api/pos/shift', {
    subdomain: DEMO_SUBDOMAIN, action: 'open', demoStaffId, initialCash: 200,
  })
  ok('Opening a 2nd shift while one is open → 409', reopenStatus === 409)

  // ── Customer quick-create + search ──────────────────────────────────────────
  console.log('\n── POS customers ───────────────────────────────────────')
  const testPhone = '+212600000001'
  const { status: custCreateStatus, body: custCreateBody } = await post('/api/pos/customers',
    { phone: testPhone, name: 'Test Comptoir Client' },
    { Authorization: `Bearer ${shiftToken}` }
  )
  ok('Create customer → 201', custCreateStatus === 201, JSON.stringify(custCreateBody))

  const { status: custSearchStatus, body: custSearchBody } = await get(
    `/api/pos/customers?search=${encodeURIComponent(testPhone)}`,
    { Authorization: `Bearer ${shiftToken}` }
  )
  ok('Search customer by phone → 200, finds it', custSearchStatus === 200 && custSearchBody.items?.some((c: any) => c.phone === testPhone))

  const { status: custNoAuthStatus } = await get(`/api/pos/customers?search=${testPhone}`)
  ok('Search customer without token → 401', custNoAuthStatus === 401)

  // ── Order with orderType ────────────────────────────────────────────────────
  console.log('\n── Order orderType ─────────────────────────────────────')
  const { status: menuStatus, body: menuBody } = await get('/api/pos/menu', { Authorization: `Bearer ${shiftToken}` })
  ok('Fetch menu → 200', menuStatus === 200)
  const firstProduct = menuBody.categories?.find((c: any) => c.products?.length)?.products?.[0]
  if (!firstProduct) {
    console.error('Cannot continue: demo cafe has no products in its menu.')
    process.exit(1)
  }

  const { status: orderStatus, body: orderBody } = await post('/api/pos/orders', {
    items: [{ productId: firstProduct.id, quantity: 1 }],
    paymentMethod: 'CASH',
    customerPhone: testPhone,
    orderType: 'TAKEAWAY',
  }, { Authorization: `Bearer ${shiftToken}` })
  ok('Create tableless TAKEAWAY order → 201', orderStatus === 201, JSON.stringify(orderBody))
  ok('Order persisted orderType TAKEAWAY', orderBody.order?.orderType === 'TAKEAWAY')
  const orderId = orderBody.order?.id

  const { status: checkoutStatus, body: checkoutBody } = await patch(
    `/api/pos/orders/${orderId}/checkout`,
    { paymentMethod: 'CASH', printReceipt: false },
    { Authorization: `Bearer ${shiftToken}` }
  )
  ok('Checkout order → 200, isPaid true', checkoutStatus === 200 && checkoutBody.order?.isPaid === true)

  // ── Close shift, verify discrepancy math ───────────────────────────────────
  const { status: closeStatus, body: closeBody } = await post('/api/pos/shift', {
    subdomain: DEMO_SUBDOMAIN, action: 'close', demoStaffId, countedCash: 200 + firstProduct.price,
  })
  ok('Close shift → 200', closeStatus === 200)
  ok('totalCollectedCash reflects the CASH order', closeBody.shift?.totalCollectedCash === firstProduct.price, JSON.stringify(closeBody.shift))
  ok('discrepancy is 0 for an exact count', closeBody.shift?.discrepancy === 0, JSON.stringify(closeBody.shift))

  // ── Overtime lock + admin unlock (direct DB manipulation, mirrors the cron) ──
  console.log('\n── Overtime lock / admin unlock ────────────────────────')
  await prisma.cashierShift.update({ where: { id: shiftId }, data: { status: 'OPEN', lockedAt: new Date() } })

  const { status: lockedOrderStatus } = await post('/api/pos/orders', {
    items: [{ productId: firstProduct.id, quantity: 1 }],
    paymentMethod: 'CASH',
    customerPhone: testPhone,
    orderType: 'TAKEAWAY',
  }, { Authorization: `Bearer ${shiftToken}` })
  ok('Order blocked while shift locked → 423', lockedOrderStatus === 423)

  const { status: unlockNoAuthStatus } = await patch(`/api/admin/shifts/${shiftId}/unlock`, {})
  ok('Unlock without admin token → 401', unlockNoAuthStatus === 401)

  await prisma.cashierShift.update({ where: { id: shiftId }, data: { lockedAt: null, status: 'CLOSED' } })
  const stillLocked = await prisma.cashierShift.findUnique({ where: { id: shiftId } })
  ok('Cleanup: shift closed and unlocked', stillLocked?.status === 'CLOSED' && stillLocked?.lockedAt === null)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log(`${'═'.repeat(56)}\n`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('Fatal error running control test:', err)
  await prisma.$disconnect()
  process.exit(1)
})
```

- [ ] **Step 2: Run it against a live dev server**

Run: `npm run dev` in one terminal (wait for `Server listening on http://0.0.0.0:4000`), then in another:

```bash
npx ts-node --transpile-only scripts/controlTestComptoir.ts
```

Expected: every line prefixed `✅`, ending with `N passed, 0 failed`. If the demo cafe or its menu is empty, the script exits early with a clear message telling you which precondition is missing — seed the `welcome` demo cafe first (see `docs/superpowers/plans/` or ask whoever owns demo seeding) and re-run.

- [ ] **Step 3: Fix any failures**

If a specific assertion fails, re-open the corresponding file from Tasks 1–8, compare against the exact code blocks given there, and correct the mismatch. Re-run Step 2 until all assertions pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/controlTestComptoir.ts
git commit -m "test: add Comptoir + Caisse integration control test"
```

---

## Task 10: Extract shared receipt-printing helper

**Files:**
- Create: `src/lib/posReceipt.ts`
- Modify: `app/pos/page.tsx:39-66` (remove the inline version, import the shared one)

- [ ] **Step 1: Create the shared module**

```ts
// Shared 80mm thermal-receipt printer, used by both /pos (table service) and
// /comptoir (counter sales). Opens a new window, writes a print-ready HTML
// document, and triggers the browser print dialog.

export type ReceiptItem = { name: string; quantity: number; unitPrice: number }

export function printReceipt(cafeName: string, tableLabel: string | number, items: ReceiptItem[], total: number, currency: string) {
  const lines = items.map(i => `<tr>
    <td>${i.name}</td>
    <td style="text-align:center">${i.quantity}</td>
    <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td>
  </tr>`).join('')
  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.d{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  td{padding:2px 0;vertical-align:top}.tot td{font-weight:bold;border-top:1px dashed #000;padding-top:4px}
  @media print{body{width:80mm}@page{margin:0;size:80mm auto}}</style></head>
  <body><div class="c b" style="font-size:16px">☕ ${cafeName}</div>
  <div class="c" style="font-size:10px;color:#555">Smart Menu POS</div><div class="d"></div>
  <div>Table: <b>${tableLabel}</b></div><div>Date: ${new Date().toLocaleString()}</div><div class="d"></div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${lines}</tbody>
  <tfoot><tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${total.toFixed(2)} ${currency}</td></tr></tfoot>
  </table><div class="d"></div><div class="c" style="font-size:10px">Thank you · شكراً · Merci</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`)
  win.document.close()
}
```

(Only the parameter name changed from `tableNumber: number` to `tableLabel: string | number` and the "Table: X" line now interpolates it directly — this lets Comptoir pass `"Emporter"` or `"Table 4"` as a label instead of always a numeric table number.)

- [ ] **Step 2: Remove the inline copy from `app/pos/page.tsx` and import the shared one**

Find in `app/pos/page.tsx`:

```ts
// ─── Receipt ──────────────────────────────────────────────────────────────────

type ReceiptItem = { name: string; quantity: number; unitPrice: number }

function printReceipt(cafeName: string, tableNumber: number, items: ReceiptItem[], total: number, currency: string) {
  const lines = items.map(i => `<tr>
    <td>${i.name}</td>
    <td style="text-align:center">${i.quantity}</td>
    <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td>
  </tr>`).join('')
  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.d{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  td{padding:2px 0;vertical-align:top}.tot td{font-weight:bold;border-top:1px dashed #000;padding-top:4px}
  @media print{body{width:80mm}@page{margin:0;size:80mm auto}}</style></head>
  <body><div class="c b" style="font-size:16px">☕ ${cafeName}</div>
  <div class="c" style="font-size:10px;color:#555">Smart Menu POS</div><div class="d"></div>
  <div>Table: <b>${tableNumber}</b></div><div>Date: ${new Date().toLocaleString()}</div><div class="d"></div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${lines}</tbody>
  <tfoot><tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${total.toFixed(2)} ${currency}</td></tr></tfoot>
  </table><div class="d"></div><div class="c" style="font-size:10px">Thank you · شكراً · Merci</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`)
  win.document.close()
}
```

Replace with:

```ts
// ─── Receipt ──────────────────────────────────────────────────────────────────
// printReceipt + ReceiptItem now live in src/lib/posReceipt.ts (shared with /comptoir)
```

Find the import block near the top of the file:

```ts
import { tr, getLang, setLang as saveLang, isRTL, POS_LANGS, type Lang } from '../../src/lib/posI18n'
```

Add directly below it:

```ts
import { printReceipt, type ReceiptItem } from '../../src/lib/posReceipt'
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`printReceipt` and `ReceiptItem` are used later in the same file — e.g. `mergedItems`'s type and the `handleCheckout` call — the imported names match exactly so no other edits are needed.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/posReceipt.ts app/pos/page.tsx
git commit -m "refactor(pos): extract printReceipt into src/lib/posReceipt.ts"
```

---

## Task 11: `useCashierShift` hook

**Files:**
- Create: `src/hooks/useCashierShift.ts`

- [ ] **Step 1: Write the hook**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface CashierShift {
  id:                  string
  status:              'OPEN' | 'CLOSED'
  startTime:            string
  endTime:              string | null
  initialCash:          number
  totalCollectedCash:   number
  plannedEndTime:       string | null
  countedCash:          number | null
  discrepancy:          number | null
  lockedAt:             string | null
}

export type TimingState = 'none' | 'ontime' | 'warning' | 'overtime'

export interface TimingStatus {
  state: TimingState
  label: string
}

const WARNING_WINDOW_MS = 15 * 60 * 1000 // start warning 15 min before plannedEndTime
const POLL_INTERVAL_MS  = 30_000

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export function computeTimingStatus(shift: CashierShift | null, now: Date): TimingStatus {
  if (!shift?.plannedEndTime) return { state: 'none', label: '' }
  const planned = new Date(shift.plannedEndTime).getTime()
  const diff = planned - now.getTime()

  if (diff > WARNING_WINDOW_MS) {
    return { state: 'ontime', label: `⏱ Sortie dans ${formatDuration(diff)}` }
  }
  if (diff > 0) {
    return { state: 'warning', label: `⏱ Sortie dans ${formatDuration(diff)}` }
  }
  return { state: 'overtime', label: `⏱ +${formatDuration(diff)} — verrouillage à +1h` }
}

export function useCashierShift(token: string | null, subdomain: string) {
  const [shift, setShift]     = useState<CashierShift | null>(null)
  const [loading, setLoading] = useState(false)
  const [now, setNow]         = useState(() => new Date())
  const tokenRef = useRef(token)
  tokenRef.current = token

  const fetchStatus = useCallback(async () => {
    if (!tokenRef.current) return
    setLoading(true)
    try {
      const res = await fetch('/api/pos/shift/current', {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    fetchStatus()
    const poll = setInterval(fetchStatus, POLL_INTERVAL_MS)
    const clock = setInterval(() => setNow(new Date()), 30_000)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [token, fetchStatus])

  const openShift = useCallback(async (params: {
    pinCode?: string; demoStaffId?: string; initialCash: number; plannedEndTime?: string
  }) => {
    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain,
        action: 'open',
        pinCode: params.pinCode,
        demoStaffId: params.demoStaffId,
        initialCash: params.initialCash,
        plannedEndTime: params.plannedEndTime,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to open shift')
    setShift(data.shift)
    return data as { token: string; shift: CashierShift }
  }, [subdomain])

  const closeShift = useCallback(async (params: {
    pinCode?: string; demoStaffId?: string; countedCash: number
  }) => {
    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain,
        action: 'close',
        pinCode: params.pinCode,
        demoStaffId: params.demoStaffId,
        countedCash: params.countedCash,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to close shift')
    setShift(data.shift)
    return data.shift as CashierShift
  }, [subdomain])

  const timing = computeTimingStatus(shift, now)
  const isLocked = !!shift?.lockedAt

  return { shift, loading, timing, isLocked, fetchStatus, openShift, closeShift }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCashierShift.ts
git commit -m "feat(pos): add useCashierShift hook"
```

---

## Task 12: `CaisseDepartScreen` component

**Files:**
- Create: `src/components/pos/CaisseDepartScreen.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'

interface CaisseDepartScreenProps {
  staffName: string
  onSubmit: (params: { initialCash: number; plannedEndTime: string }) => Promise<void>
}

export default function CaisseDepartScreen({ staffName, onSubmit }: CaisseDepartScreenProps) {
  const [initialCash, setInitialCash] = useState('')
  const [exitTime, setExitTime]       = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cash = parseFloat(initialCash)
    if (isNaN(cash) || cash < 0) { setError('Montant invalide'); return }
    if (!exitTime) { setError('Heure de sortie prévue requise'); return }

    const [hours, minutes] = exitTime.split(':').map(Number)
    const planned = new Date()
    planned.setHours(hours, minutes, 0, 0)
    if (planned.getTime() < Date.now()) planned.setDate(planned.getDate() + 1)

    setSubmitting(true)
    try {
      await onSubmit({ initialCash: cash, plannedEndTime: planned.toISOString() })
    } catch (err: any) {
      setError(err.message ?? 'Échec de l\'ouverture de caisse')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Caisse de départ</h1>
          <p className="text-gray-500 text-sm mt-1">Bonjour {staffName} — ouvrez votre caisse pour commencer</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Montant de départ</label>
          <input
            type="number" min="0" step="0.5" required autoFocus
            value={initialCash} onChange={e => setInitialCash(e.target.value)}
            placeholder="200"
            className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Sortie prévue</label>
          <input
            type="time" required
            value={exitTime} onChange={e => setExitTime(e.target.value)}
            className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-lg rounded-2xl transition-all active:scale-95">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ouvrir la caisse'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pos/CaisseDepartScreen.tsx
git commit -m "feat(pos): add CaisseDepartScreen component"
```

---

## Task 13: `ClotureModal` component

**Files:**
- Create: `src/components/pos/ClotureModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { CashierShift } from '../../hooks/useCashierShift'

interface ClotureModalProps {
  shift: CashierShift
  currency: string
  onClose: () => void
  onConfirm: (countedCash: number) => Promise<void>
}

export default function ClotureModal({ shift, currency, onClose, onConfirm }: ClotureModalProps) {
  const [countedCash, setCountedCash] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<{ discrepancy: number } | null>(null)

  const expected = shift.initialCash + shift.totalCollectedCash

  async function handleConfirm() {
    setError('')
    const counted = parseFloat(countedCash)
    if (isNaN(counted) || counted < 0) { setError('Montant invalide'); return }
    setSubmitting(true)
    try {
      await onConfirm(counted)
      setResult({ discrepancy: counted - expected })
    } catch (err: any) {
      setError(err.message ?? 'Échec de la clôture')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg text-white">Clôture de caisse</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="text-center space-y-3">
            <p className="text-gray-400 text-sm">Écart</p>
            <p className={`text-3xl font-black ${result.discrepancy === 0 ? 'text-emerald-400' : result.discrepancy > 0 ? 'text-sky-400' : 'text-red-400'}`}>
              {result.discrepancy > 0 ? '+' : ''}{result.discrepancy.toFixed(2)} {currency}
            </p>
            <p className="text-gray-500 text-xs">
              {result.discrepancy === 0 ? 'Caisse exacte' : result.discrepancy > 0 ? 'Excédent' : 'Manque'}
            </p>
            <button onClick={onClose} className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm">
              Terminé
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between text-gray-400"><span>Caisse de départ</span><span className="text-white font-mono">{shift.initialCash.toFixed(2)} {currency}</span></div>
              <div className="flex justify-between text-gray-400"><span>Recette (cash)</span><span className="text-white font-mono">{shift.totalCollectedCash.toFixed(2)} {currency}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-800 pt-2"><span className="text-gray-300">Montant attendu</span><span className="text-white font-mono">{expected.toFixed(2)} {currency}</span></div>
            </div>

            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Montant compté</label>
            <input
              type="number" min="0" step="0.5" autoFocus
              value={countedCash} onChange={e => setCountedCash(e.target.value)}
              placeholder={expected.toFixed(2)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />

            {error && <div className="bg-red-950/60 border border-red-800 text-red-400 text-xs rounded-xl px-3 py-2 mb-3">{error}</div>}

            <button onClick={handleConfirm} disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm active:scale-95">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer la clôture'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pos/ClotureModal.tsx
git commit -m "feat(pos): add ClotureModal component"
```

---

## Task 14: `ShiftTimingPill` + `LockedOverlay` components

**Files:**
- Create: `src/components/pos/ShiftTimingPill.tsx`
- Create: `src/components/pos/LockedOverlay.tsx`

- [ ] **Step 1: Write `ShiftTimingPill`**

```tsx
'use client'

import type { TimingStatus } from '../../hooks/useCashierShift'

export default function ShiftTimingPill({ timing }: { timing: TimingStatus }) {
  if (timing.state === 'none') return null

  const style =
    timing.state === 'overtime' ? 'bg-red-950 text-red-400 border-red-800 animate-pulse' :
    timing.state === 'warning'  ? 'bg-amber-950 text-amber-400 border-amber-800' :
                                   'bg-gray-800 text-gray-400 border-gray-700'

  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${style}`}>
      {timing.label}
    </span>
  )
}
```

- [ ] **Step 2: Write `LockedOverlay`**

```tsx
'use client'

import { Lock } from 'lucide-react'

export default function LockedOverlay({ staffName, plannedEndTime }: { staffName: string; plannedEndTime: string | null }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-white font-black text-xl mb-2">Poste verrouillé</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          {staffName} a dépassé sa sortie prévue
          {plannedEndTime ? ` (${new Date(plannedEndTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''} de plus d'1h sans clôturer.
          La caisse est bloquée jusqu'à déverrouillage par un administrateur.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pos/ShiftTimingPill.tsx src/components/pos/LockedOverlay.tsx
git commit -m "feat(pos): add ShiftTimingPill and LockedOverlay components"
```

---

## Task 15: Wire the Caisse gate into `/pos`

**Files:**
- Modify: `app/pos/page.tsx`

- [ ] **Step 1: Import the new pieces**

Find the import block:

```ts
import { printReceipt, type ReceiptItem } from '../../src/lib/posReceipt'
```

Add directly below it:

```ts
import { useCashierShift } from '../../src/hooks/useCashierShift'
import CaisseDepartScreen from '../../src/components/pos/CaisseDepartScreen'
import ClotureModal from '../../src/components/pos/ClotureModal'
import ShiftTimingPill from '../../src/components/pos/ShiftTimingPill'
import LockedOverlay from '../../src/components/pos/LockedOverlay'
```

- [ ] **Step 2: Track the just-entered PIN and wire the hook**

Find the login state declarations:

```ts
  // login
  const [pin,         setPin]         = useState('')
  const [subdomain,   setSubdomain]   = useState('')
```

These already exist — `pin` and `subdomain` are exactly what the hook's `openShift`/`closeShift` need. Directly below the existing `staff` state declaration:

```ts
  const [staff,       setStaff]       = useState<Staff | null>(null)
```

Add:

```ts
  const cashierShift = useCashierShift(posToken, subdomain)
  const [showCloture, setShowCloture] = useState(false)
```

- [ ] **Step 3: Show the Caisse de départ screen when logged in but no shift is open**

Find the main render's top-level guard:

```ts
  // ─── PIN Login ──────────────────────────────────────────────────────────────
  if (!posToken) {
```

Directly above that line, add a new guard (this must come after `posToken` exists but the shift hasn't finished its first fetch/doesn't exist yet):

```ts
  // ─── Caisse de départ — required before entering the POS once logged in ─────
  if (posToken && !cashierShift.loading && !cashierShift.shift) {
    return (
      <CaisseDepartScreen
        staffName={staff?.name ?? ''}
        onSubmit={async ({ initialCash, plannedEndTime }) => {
          const isDemo = isDemoMode
          const result = await cashierShift.openShift({
            pinCode: isDemo ? undefined : undefined, // PIN already consumed by login; re-auth not required server-side for the demo path
            demoStaffId: isDemo ? staff?.id : undefined,
            initialCash,
            plannedEndTime,
          })
          localStorage.setItem('posToken', result.token)
          setPosToken(result.token)
        }}
      />
    )
  }

  // ─── Poste verrouillé ────────────────────────────────────────────────────────
  if (cashierShift.isLocked) {
    return <LockedOverlay staffName={staff?.name ?? ''} plannedEndTime={cashierShift.shift?.plannedEndTime ?? null} />
  }
```

> **Note for the implementer:** the non-demo (real PIN) path needs the PIN that was just typed at login to call `action: 'open'` (the backend still requires `pinCode` for that branch — see Task 2, Step 4, which only patched the *demo* branch to skip PIN re-entry; the PIN branch in Task 2 Step 2 still requires `pinCode`). Since `handleLogin` already clears `pin` via `setPin('')` right after login succeeds, you must keep the just-typed PIN in a ref until the Caisse gate is submitted. Add a ref next to the other refs:
> ```ts
>   const lastPinRef = useRef('')
> ```
> and in `handleLogin`, right before `setPin('')`, add `lastPinRef.current = pin.trim()`. Then in the `onSubmit` above, replace the `pinCode` line with `pinCode: isDemo ? undefined : lastPinRef.current,`.

- [ ] **Step 4: Add the timing pill, Clôture button, and modal to the header**

Find the header's right-side button group:

```tsx
          <button onClick={() => fetchTables(posToken!)} disabled={loadTables}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loadTables ? 'animate-spin' : ''}`} />
          </button>
```

Add directly below it:

```tsx
          <ShiftTimingPill timing={cashierShift.timing} />
          {cashierShift.shift && (
            <button onClick={() => setShowCloture(true)}
              className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors">
              Clôture
            </button>
          )}
```

- [ ] **Step 5: Render the modal at the bottom of the component**

Find the final closing tags of the component's return statement:

```tsx
      {/* ── Split Bill Modal ──────────────────────────────────────────────────── */}
      {splitOpen && selTable && (
```

Directly above that comment block, add:

```tsx
      {/* ── Clôture Modal ──────────────────────────────────────────────────────── */}
      {showCloture && cashierShift.shift && (
        <ClotureModal
          shift={cashierShift.shift}
          currency={currency}
          onClose={() => setShowCloture(false)}
          onConfirm={async (countedCash) => {
            const isDemo = isDemoMode
            await cashierShift.closeShift({
              pinCode: isDemo ? undefined : lastPinRef.current,
              demoStaffId: isDemo ? staff?.id : undefined,
              countedCash,
            })
          }}
        />
      )}

```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. Fix any missed reference (e.g. if `lastPinRef` wasn't declared where expected).

- [ ] **Step 7: Manual browser check**

Run: `npm run dev`, open `http://localhost:3000/pos` (or the demo subdomain URL), log in, confirm:
- The Caisse de départ screen appears before the table grid.
- After submitting it, the table grid appears and the header shows a "Sortie dans …" pill.
- Clicking "Clôture" opens the modal, shows the expected amount, and submitting a counted amount shows the écart.

- [ ] **Step 8: Commit**

```bash
git add app/pos/page.tsx
git commit -m "feat(pos): wire Caisse de départ / Clôture / timing lock into /pos"
```

---

## Task 16: `app/comptoir/page.tsx` — skeleton, login, Caisse gate

**Files:**
- Create: `app/comptoir/page.tsx`

This task creates the page shell: PIN/demo login (same backend as `/pos`), the Caisse gate, and the locked-overlay/timing pill reuse. Tasks 17–19 fill in the body (categories/products/facture/footer).

- [ ] **Step 1: Write the skeleton**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LogOut, Loader2, AlertTriangle } from 'lucide-react'
import { useCashierShift } from '../../src/hooks/useCashierShift'
import CaisseDepartScreen from '../../src/components/pos/CaisseDepartScreen'
import ClotureModal from '../../src/components/pos/ClotureModal'
import ShiftTimingPill from '../../src/components/pos/ShiftTimingPill'
import LockedOverlay from '../../src/components/pos/LockedOverlay'

interface Staff { id: string; name: string; role: string }

export default function ComptoirPage() {
  // auth (mirrors app/pos/page.tsx's login flow)
  const [posToken,    setPosToken]    = useState<string | null>(null)
  const [staff,       setStaff]       = useState<Staff | null>(null)
  const [cafeId,      setCafeId]      = useState('')
  const [cafeName,    setCafeName]    = useState('Café')
  const [currency,    setCurrency]    = useState('MAD')
  const [pin,         setPin]         = useState('')
  const [subdomain,   setSubdomain]   = useState('')
  const [loginErr,    setLoginErr]    = useState('')
  const [logging,     setLogging]     = useState(false)
  const [isDemoMode,  setIsDemoMode]  = useState(false)
  const [demoStaff,   setDemoStaff]   = useState<{ id: string; name: string; role: string }[]>([])
  const lastPinRef = useRef('')

  const cashierShift = useCashierShift(posToken, subdomain)
  const [showCloture, setShowCloture] = useState(false)

  // Boot — restore session
  useEffect(() => {
    const t = localStorage.getItem('posToken')
    if (!t) return
    try {
      const p = JSON.parse(atob(t.split('.')[1]))
      setPosToken(t); setCafeId(p.cafeId)
      setStaff({ id: p.staffId, name: localStorage.getItem('staffName') ?? '', role: p.staffRole })
    } catch { localStorage.removeItem('posToken') }
  }, [])

  // Auto-detect subdomain + branding + demo mode (same as /pos)
  useEffect(() => {
    const parts = window.location.hostname.split('.')
    const det   = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : ''
    const saved = localStorage.getItem('posLastSubdomain') ?? ''
    const sub   = det || saved
    if (sub) setSubdomain(sub)
    if (!sub) return
    fetch(`/api/public/cafe/${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCafeName(d.name)
    })
    fetch(`/api/public/demo-staff?subdomain=${sub}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.staff?.length) { setIsDemoMode(true); setDemoStaff(d.staff) }
    }).catch(() => {})
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(''); setLogging(true)
    try {
      const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), pinCode: pin.trim(), action: 'login' }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      lastPinRef.current = pin.trim()
      localStorage.setItem('posToken', data.token)
      localStorage.setItem('cafeId', payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomain.trim())
      localStorage.setItem('staffName', data.staff?.name ?? '')
      setPin('')
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  async function handleDemoLogin(staffId: string) {
    setLoginErr(''); setLogging(true)
    try {
      const res  = await fetch('/api/pos/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), demoStaffId: staffId, action: 'login' }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error ?? 'Login failed'); return }
      const payload = JSON.parse(atob(data.token.split('.')[1]))
      localStorage.setItem('posToken', data.token)
      localStorage.setItem('cafeId', payload.cafeId)
      localStorage.setItem('posLastSubdomain', subdomain.trim())
      localStorage.setItem('staffName', data.staff?.name ?? '')
      setPosToken(data.token); setCafeId(payload.cafeId); setStaff(data.staff)
    } catch { setLoginErr('Network error') }
    finally   { setLogging(false) }
  }

  function logout() {
    localStorage.removeItem('posToken'); localStorage.removeItem('cafeId')
    setPosToken(null); setStaff(null); setCafeId('')
  }

  // ─── PIN Login ──────────────────────────────────────────────────────────────
  if (!posToken) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3 text-4xl shadow-xl">🧾</div>
            <h1 className="text-2xl font-extrabold text-white">{cafeName}</h1>
            <p className="text-gray-500 text-sm mt-1">Comptoir — Staff Login</p>
          </div>

          {isDemoMode ? (
            <div className="space-y-3">
              {demoStaff.map(s => (
                <button key={s.id} onClick={() => handleDemoLogin(s.id)} disabled={logging}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500 rounded-2xl transition-all active:scale-95 disabled:opacity-50">
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">{s.name}</p>
                    <p className="text-gray-500 text-xs">{s.role}</p>
                  </div>
                  {logging && <Loader2 className="w-4 h-4 animate-spin text-emerald-400 ml-auto" />}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {!subdomain && (
                <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)}
                  placeholder="Cafe subdomain" required
                  className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              )}
              <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
                placeholder="PIN" maxLength={8} required
                className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {loginErr && (
                <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {loginErr}
                </div>
              )}
              <button type="submit" disabled={logging || !subdomain || pin.length < 4}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-lg rounded-2xl transition-all active:scale-95">
                {logging ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'LOGIN'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ─── Caisse de départ ───────────────────────────────────────────────────────
  if (!cashierShift.loading && !cashierShift.shift) {
    return (
      <CaisseDepartScreen
        staffName={staff?.name ?? ''}
        onSubmit={async ({ initialCash, plannedEndTime }) => {
          const result = await cashierShift.openShift({
            pinCode: isDemoMode ? undefined : lastPinRef.current,
            demoStaffId: isDemoMode ? staff?.id : undefined,
            initialCash,
            plannedEndTime,
          })
          localStorage.setItem('posToken', result.token)
          setPosToken(result.token)
        }}
      />
    )
  }

  // ─── Poste verrouillé ────────────────────────────────────────────────────────
  if (cashierShift.isLocked) {
    return <LockedOverlay staffName={staff?.name ?? ''} plannedEndTime={cashierShift.shift?.plannedEndTime ?? null} />
  }

  // ─── Main Comptoir UI ───────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-4 h-16 flex items-center justify-between shrink-0">
        <div>
          <p className="text-white font-extrabold text-sm leading-none">{cafeName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{staff?.name} · {staff?.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <ShiftTimingPill timing={cashierShift.timing} />
          {cashierShift.shift && (
            <button onClick={() => setShowCloture(true)}
              className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors">
              Clôture
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-400 text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Categories / products / facture / footer — added in Tasks 17–19
      </div>

      {showCloture && cashierShift.shift && (
        <ClotureModal
          shift={cashierShift.shift}
          currency={currency}
          onClose={() => setShowCloture(false)}
          onConfirm={async (countedCash) => {
            await cashierShift.closeShift({
              pinCode: isDemoMode ? undefined : lastPinRef.current,
              demoStaffId: isDemoMode ? staff?.id : undefined,
              countedCash,
            })
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

Run: `npm run dev`, open `http://localhost:3000/comptoir` on the demo subdomain, confirm login → Caisse de départ → placeholder main screen all render without errors.

- [ ] **Step 4: Commit**

```bash
git add app/comptoir/page.tsx
git commit -m "feat(comptoir): add page skeleton with login + Caisse gate"
```

---

## Task 17: Comptoir — categories, products, facture

**Files:**
- Modify: `app/comptoir/page.tsx`

- [ ] **Step 1: Add menu/cart types and state**

Find:

```ts
interface Staff { id: string; name: string; role: string }
```

Add directly below it:

```ts
interface MenuItem { id: string; nameEn: string; nameAr: string; nameFr: string; price: number; imageUrl: string | null }
interface MenuCat  { id: string; nameEn: string; nameAr: string; nameFr: string; order: number; products: MenuItem[] }
interface CartItem { productId: string; name: string; price: number; qty: number }

function pName(item: { nameEn: string; nameAr: string; nameFr: string }) {
  return item.nameFr || item.nameEn || item.nameAr
}
```

Find:

```ts
  const cashierShift = useCashierShift(posToken, subdomain)
  const [showCloture, setShowCloture] = useState(false)
```

Add directly below it:

```ts
  const [menuCats,  setMenuCats]  = useState<MenuCat[]>([])
  const [activeCat, setActiveCat] = useState('')
  const [cart,      setCart]      = useState<CartItem[]>([])
```

- [ ] **Step 2: Fetch the menu once a shift is open**

Find the boot `useEffect` for branding/demo detection and add a new effect directly below it:

```ts
  const fetchMenu = useCallback(async (token: string) => {
    const res = await fetch('/api/pos/menu', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setMenuCats(data.categories ?? [])
    setCurrency(data.currency ?? 'MAD')
    if (data.categories?.length) setActiveCat(data.categories[0].id)
  }, [])

  useEffect(() => {
    if (!posToken || !cashierShift.shift) return
    fetchMenu(posToken)
  }, [posToken, cashierShift.shift, fetchMenu])
```

- [ ] **Step 3: Cart helpers**

Add directly below the `fetchMenu` effect:

```ts
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { productId: item.id, name: pName(item), price: item.price, qty: 1 }]
    })
  }
  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(c => c.productId === productId ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0))
  }
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const activeItems = menuCats.find(c => c.id === activeCat)?.products ?? []
```

- [ ] **Step 4: Replace the placeholder body with categories / products / facture**

Find:

```tsx
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Categories / products / facture / footer — added in Tasks 17–19
      </div>
```

Replace with:

```tsx
      <div className="flex-1 flex overflow-hidden">
        {/* Left: categories */}
        <div className="w-44 shrink-0 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 pb-2">Catégories</div>
          {menuCats.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeCat === cat.id ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}>
              {pName(cat)}
            </button>
          ))}
        </div>

        {/* Center: products */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {activeItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-2xl p-3 text-left transition-colors active:scale-95">
                <p className="text-white font-bold text-sm truncate">{pName(item)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-emerald-400 font-extrabold text-sm">{item.price.toFixed(2)} {currency}</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-900/60 text-emerald-400 flex items-center justify-center font-bold">+</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: facture */}
        <div className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center gap-2 bg-gray-950 rounded-xl px-3 py-2">
                <button onClick={() => updateQty(item.productId, -1)} className="w-8 h-8 rounded-lg bg-gray-800 text-gray-300 font-bold">−</button>
                <span className="w-6 text-center text-white font-bold text-sm">{item.qty}</span>
                <button onClick={() => updateQty(item.productId, 1)} className="w-8 h-8 rounded-lg bg-emerald-900/70 text-emerald-400 font-bold">+</button>
                <span className="flex-1 text-white text-sm font-semibold truncate">{item.name}</span>
                <span className="text-gray-400 text-sm font-mono">{(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-10">Aucun article — touchez un produit pour l'ajouter</p>
            )}
          </div>
          <div className="border-t border-dashed border-gray-800 px-4 py-3 flex items-baseline justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</span>
            <span className="text-white font-extrabold text-xl font-mono">{cartTotal.toFixed(2)} {currency}</span>
          </div>
        </div>
      </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Manual browser check**

Log in and open a shift on `/comptoir`, confirm categories render on the left, tapping a category swaps the product grid, tapping a product adds it to the right-hand facture with a running total, and the +/− steppers work.

- [ ] **Step 7: Commit**

```bash
git add app/comptoir/page.tsx
git commit -m "feat(comptoir): add categories, products grid, and facture panel"
```

---

## Task 18: Comptoir — client picker (mandatory)

**Files:**
- Modify: `app/comptoir/page.tsx`

- [ ] **Step 1: Add client state and search/create logic**

Find:

```ts
  const [cart,      setCart]      = useState<CartItem[]>([])
```

Add directly below it:

```ts
  interface PosCustomer { id: string; phone: string; name: string | null }
  const [client,       setClient]       = useState<PosCustomer | null>(null)
  const [clientPicker, setClientPicker] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<PosCustomer[]>([])
  const [clientNewName, setClientNewName] = useState('')
  const [clientBusy, setClientBusy] = useState(false)
```

Add directly below the `addToCart`/`updateQty` helpers:

```ts
  async function searchClients(q: string) {
    setClientSearch(q)
    if (!posToken || q.trim().length < 2) { setClientResults([]); return }
    const res = await fetch(`/api/pos/customers?search=${encodeURIComponent(q.trim())}`, {
      headers: { Authorization: `Bearer ${posToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setClientResults(data.items ?? [])
    }
  }

  async function createClient() {
    if (!posToken || clientSearch.trim().length < 7) return
    setClientBusy(true)
    try {
      const res = await fetch('/api/pos/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({ phone: clientSearch.trim(), name: clientNewName.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setClient(data.customer)
        setClientPicker(false)
        setClientSearch(''); setClientNewName(''); setClientResults([])
      }
    } finally {
      setClientBusy(false)
    }
  }
```

- [ ] **Step 2: Add the client row at the top of the facture panel**

Find (inside the facture `<div className="w-80 ...">` block, from Task 17):

```tsx
        <div className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
```

Replace with:

```tsx
        <div className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            {client ? (
              <div>
                <p className="text-white text-sm font-bold">{client.name || 'Client'}</p>
                <p className="text-gray-500 text-xs font-mono">{client.phone}</p>
              </div>
            ) : (
              <p className="text-amber-400 text-xs font-bold">⚠ Sélectionnez un client</p>
            )}
            <button onClick={() => setClientPicker(true)} className="text-emerald-400 text-xs font-bold hover:text-emerald-300">
              {client ? 'Changer' : 'Choisir'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
```

- [ ] **Step 3: Add the client picker modal**

Find (the `ClotureModal` render block near the end of the component):

```tsx
      {showCloture && cashierShift.shift && (
```

Add directly above it:

```tsx
      {clientPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setClientPicker(false)}>
          <div className="bg-gray-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-white mb-3">Client</h3>
            <input
              type="text" autoFocus value={clientSearch} onChange={e => searchClients(e.target.value)}
              placeholder="Nom ou téléphone (+212...)"
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
              {clientResults.map(c => (
                <button key={c.id} onClick={() => { setClient(c); setClientPicker(false); setClientSearch(''); setClientResults([]) }}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{c.name || 'Sans nom'}</span>
                  <span className="text-gray-500 text-xs font-mono">{c.phone}</span>
                </button>
              ))}
            </div>
            {clientResults.length === 0 && /^\+?\d{7,15}$/.test(clientSearch.replace(/[\s\-().]/g, '')) && (
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <p className="text-gray-500 text-xs">Nouveau client — {clientSearch}</p>
                <input type="text" value={clientNewName} onChange={e => setClientNewName(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <button onClick={createClient} disabled={clientBusy}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm">
                  {clientBusy ? 'Création…' : 'Créer et sélectionner'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Confirm: the facture header shows "⚠ Sélectionnez un client" until you pick one; typing 2+ characters searches; typing a full phone number with no matches offers "Créer et sélectionner"; picking or creating a client updates the facture header.

- [ ] **Step 6: Commit**

```bash
git add app/comptoir/page.tsx
git commit -m "feat(comptoir): add mandatory client picker"
```

---

## Task 19: Comptoir — order type, payment, confirm & print

**Files:**
- Modify: `app/comptoir/page.tsx`

- [ ] **Step 1: Add order-type/payment state and the confirm handler**

Find:

```ts
  const [clientBusy, setClientBusy] = useState(false)
```

Add directly below it:

```ts
  const [orderType,   setOrderType]   = useState<'TAKEAWAY' | 'DINE_IN'>('TAKEAWAY')
  const [payMethod,   setPayMethod]   = useState<'CASH' | 'CARD'>('CASH')
  const [confirming,  setConfirming]  = useState(false)
  const [confirmErr,  setConfirmErr]  = useState('')
  const [lastSale,    setLastSale]    = useState<number | null>(null)
```

Add directly below `createClient`:

```ts
  async function handleConfirm() {
    if (!posToken || !client || cart.length === 0) return
    setConfirming(true); setConfirmErr('')
    try {
      const createRes = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({
          items: cart.map(c => ({ productId: c.productId, quantity: c.qty })),
          paymentMethod: payMethod,
          customerPhone: client.phone,
          orderType,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setConfirmErr(createData.error ?? 'Échec de la création'); return }

      const orderId = createData.order.id
      const checkoutRes = await fetch(`/api/pos/orders/${orderId}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posToken}` },
        body: JSON.stringify({ paymentMethod: payMethod, printReceipt: true }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutRes.ok) { setConfirmErr(checkoutData.error ?? 'Échec du paiement'); return }

      printReceipt(
        cafeName,
        orderType === 'TAKEAWAY' ? 'Emporter' : 'Sur place',
        checkoutData.order.items.map((i: any) => ({ name: i.product?.nameFr || i.product?.nameEn || i.product?.nameAr, quantity: i.quantity, unitPrice: i.unitPrice })),
        checkoutData.order.totalPrice,
        currency
      )

      setLastSale(checkoutData.order.totalPrice)
      setCart([]); setClient(null)
      setTimeout(() => setLastSale(null), 2500)
    } finally {
      setConfirming(false)
    }
  }
```

- [ ] **Step 2: Import `printReceipt`**

Find:

```ts
import LockedOverlay from '../../src/components/pos/LockedOverlay'
```

Add directly below it:

```ts
import { printReceipt } from '../../src/lib/posReceipt'
```

- [ ] **Step 3: Add the footer**

Find the closing `</div>` of the `flex-1 flex overflow-hidden` body block (right after the facture `</div>` from Task 18, still inside the `<div className="h-screen ...">` wrapper). Directly below that block's closing `</div>` (the one matching `flex-1 flex overflow-hidden`), add:

```tsx
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          <button onClick={() => setOrderType('TAKEAWAY')}
            className={`px-4 py-2.5 text-xs font-bold ${orderType === 'TAKEAWAY' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Emporter
          </button>
          <button onClick={() => setOrderType('DINE_IN')}
            className={`px-4 py-2.5 text-xs font-bold ${orderType === 'DINE_IN' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Sur place
          </button>
        </div>

        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          <button onClick={() => setPayMethod('CASH')}
            className={`px-4 py-2.5 text-xs font-bold ${payMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Cash
          </button>
          <button onClick={() => setPayMethod('CARD')}
            className={`px-4 py-2.5 text-xs font-bold ${payMethod === 'CARD' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Carte
          </button>
        </div>

        {confirmErr && <span className="text-red-400 text-xs font-semibold">{confirmErr}</span>}
        {lastSale !== null && <span className="text-emerald-400 text-xs font-bold">✓ Vente enregistrée — {lastSale.toFixed(2)} {currency}</span>}

        <span className="flex-1" />

        <button
          onClick={handleConfirm}
          disabled={confirming || !client || cart.length === 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-extrabold text-sm rounded-xl active:scale-95 transition-all"
        >
          {confirming ? 'Traitement…' : `Confirmer & Imprimer — ${cartTotal.toFixed(2)} ${currency}`}
        </button>
      </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Full flow: pick a client, add 2–3 products, pick Emporter/Sur place and Cash/Carte, click "Confirmer & Imprimer". Confirm: a print window opens with the receipt, the cart clears, the client resets, and a green "✓ Vente enregistrée" confirmation briefly appears. Also confirm the button stays disabled until both a client is chosen and the cart is non-empty.

- [ ] **Step 6: Commit**

```bash
git add app/comptoir/page.tsx
git commit -m "feat(comptoir): add order type, payment, confirm & print flow"
```

---

## Task 20: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the backend integration script one more time end-to-end**

Run: `npm run dev`, then `npx ts-node --transpile-only scripts/controlTestComptoir.ts`
Expected: all assertions pass.

- [ ] **Step 2: Browser walkthrough — `/pos` (regression check)**

Open `/pos` on the demo subdomain:
- Log in → Caisse de départ appears → open with an initial cash amount and a planned end time a few minutes in the future.
- Confirm the table grid loads, the header shows a "Sortie dans …" pill, orders can still be created/paid as before.
- Click "Clôture", confirm the expected amount matches `initialCash + totalCollectedCash`, enter a counted amount, confirm the écart shown is correct.

- [ ] **Step 3: Browser walkthrough — `/comptoir` (new flow)**

Open `/comptoir` on the demo subdomain:
- Log in → Caisse de départ → main screen.
- Search for or create a client — confirm the confirm button stays disabled until one is selected.
- Add products from at least 2 categories, adjust quantities with +/−.
- Toggle Emporter/Sur place and Cash/Carte.
- Click "Confirmer & Imprimer" — confirm the receipt print window opens with the correct items/total, and the UI resets for the next sale.

- [ ] **Step 4: Overtime lock walkthrough**

With a shift open on either page, manually set its `plannedEndTime` to a few minutes in the past via Prisma Studio (`npx prisma studio`) or a one-off script, then either wait for the cron (runs every 5 min) or manually call `runShiftOvertimeLock()` from a `ts-node -e` one-liner. Reload the page — confirm the `LockedOverlay` appears and that attempting an order returns `423`. Then unlock it via `PATCH /api/admin/shifts/:shiftId/unlock` (with a valid admin token) and confirm the page unlocks on the next status poll.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during Comptoir + Caisse manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** `/comptoir` layout (header/categories/products/facture/footer) → Tasks 16–19. Mandatory client → Task 18. Order type + Cash/Card + confirm&print → Task 19. Caisse de départ/Clôture shared between `/pos` and `/comptoir` → Tasks 11–15, 16. Shift timing pill + overtime auto-lock + admin unlock → Tasks 2–5, 14–16. `orderType` persistence → Task 6. POS-scoped customer endpoints → Task 8. All backend pieces covered by the integration script → Task 9. `DEBITEUR` payment, `app/admin/customers`, and loyalty points are explicitly Phase 2 — not in this plan.
- **Placeholder scan:** no TBD/TODO markers; every step has literal code or an exact command with expected output.
- **Type consistency:** `CashierShift` interface (Task 11) matches the Prisma fields added in Task 1 exactly (`plannedEndTime`, `countedCash`, `discrepancy`, `lockedAt`). `openShift`/`closeShift` hook signatures (Task 11) match every call site (Tasks 15, 16, 19). `ReceiptItem`/`printReceipt` signature from Task 10 matches its two call sites (`/pos` unchanged usage, `/comptoir` in Task 19).
