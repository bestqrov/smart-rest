# Loyalty Program — Configurability, Customer Profile & Auto-Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real bug where `orders.ts` awards loyalty points without updating `lifetimePoints` (breaking tier progression), make the earning rate and tier thresholds configurable per cafe, add a customer-facing self-service profile (name + social handles) joined to the existing loyalty system by phone, and send an automatic WhatsApp notification when a customer becomes eligible for a reward.

**Architecture:** All new schema fields are optional/defaulted — no breaking change. `LoyaltyService.ts` keeps its existing function signatures (`earnPoints(cafeId, phone, totalPrice, orderId)`, `getTierInfo(cafeId, phone)`) but now fetches the cafe's configurable rate/thresholds internally instead of using hardcoded constants, so no caller needs to change except `orders.ts` (which starts calling the shared function instead of duplicating its logic). `CafeCustomer` and `LoyaltyAccount` stay two separate models joined by `(cafeId, phone)` — no schema merge. The new customer-facing page follows the existing pattern used by sibling `app/[subdomain]/**` pages (local `useState<Lang>`, not the admin `useLang()` context).

**Tech Stack:** Express + Prisma (MongoDB) on the backend, Next.js App Router client components on the frontend, no test framework configured — verification follows this repo's existing convention (`scripts/controlTest*.ts`-style integration scripts run against a live dev server with `ts-node`, plus `tsc --noEmit` and a manual browser pass).

**Note on TDD in this repo:** There is no Jest/Vitest setup and no `*.test.ts` files anywhere in the codebase — the established verification pattern is a `scripts/*.ts` script using `fetch` + a tiny `ok()` assertion helper, run manually against `npm run dev`. This plan follows that convention.

**Note on i18n (a lesson from the immediately-preceding Achats work in this repo):** every `app/admin/**` page routes ALL UI strings through a local `T = {ar,fr,en,es}` table via `useLang()`. Three separate hardcoded-French bugs were found and fixed across three different admin pages in the last session because this was treated as implicit rather than an explicit task step. Every task in this plan that touches `app/admin/loyalty/page.tsx` or creates the new customer-facing page MUST add every new string to the appropriate translation table as part of that same task — not as an afterthought.

**Note on lookup-table consistency:** `app/admin/loyalty/page.tsx` already has its own **client-side** `getTier(pts, t)` function with hardcoded thresholds (200/500/1000, plus a "Platinum" tier that doesn't exist anywhere in the backend) computed from **current `points`**, completely independent of and inconsistent with the backend's `LoyaltyService.getTier()` (thresholds 500/2000, only Bronze/Silver/Gold, computed from **`lifetimePoints`**). This plan removes the frontend's parallel tier logic and replaces it with the real backend data, so there is exactly one source of truth for tier thresholds once they become configurable — this is exactly the kind of parallel-lookup-table drift a holistic review caught last time, addressed here directly instead.

---

## File Structure

**Schema:**
- Modify: `prisma/schema.prisma` — `Cafe` gains 3 loyalty config fields; `CafeCustomer` gains 3 social-handle fields.

**Backend:**
- Modify: `src/loyalty/LoyaltyService.ts` — configurable rate/thresholds, reward-eligibility check on earn.
- Modify: `src/routes/orders.ts` — replace inline point-award block with `earnPoints()` call (bug fix).
- Modify: `src/routes/loyalty.ts` — add `GET`/`PATCH /api/loyalty/settings`; enrich `GET /api/loyalty/customers` and `GET /api/loyalty/:phone` responses with `lifetimePoints`.
- Modify: `src/whatsapp/WhatsAppEngine.ts` — subscribe to the new `LoyaltyRewardEligible` event.
- Modify: `src/routes/customers.ts` — add public (no-auth) `GET`/`PATCH /api/public/loyalty/:subdomain/:phone`.

**Test script:**
- Create: `scripts/controlTestLoyalty.ts` — integration coverage for everything above.

**Frontend:**
- Modify: `app/admin/loyalty/page.tsx` — remove the inconsistent client-side tier logic in favor of real backend data; add a "Settings" tab.
- Create: `app/[subdomain]/loyalty/page.tsx` — the new customer-facing self-service profile page.

---

## Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma:301` (insert after `Cafe.certifiedAt`, before its relations block)
- Modify: `prisma/schema.prisma:1891` (insert into `CafeCustomer`, after `createdAt`)

- [ ] **Step 1: Add loyalty config fields to `Cafe`**

Find (in the `Cafe` model):

```prisma
  certifiedAt            DateTime?

  categories      Category[]
```

Replace with:

```prisma
  certifiedAt            DateTime?

  // ── Loyalty program configuration (admin-configurable, see /admin/loyalty) ──
  // Currency units required to earn 1 point (e.g. 10 means "10 MAD = 1 point").
  loyaltyPointsPerCurrency    Float @default(10)
  loyaltyTierSilverThreshold  Int   @default(500)
  loyaltyTierGoldThreshold    Int   @default(2000)

  categories      Category[]
```

- [ ] **Step 2: Add social-handle fields to `CafeCustomer`**

Find:

```prisma
  phone     String   // WhatsApp number (international format, e.g. +212612345678)
  name      String?  // Optional — collected at opt-in
  lastVisit DateTime @default(now())
  optIn     Boolean  @default(true)
  visits    Int      @default(1)
  createdAt DateTime @default(now())

  // CRM Foundation (K19) — visit/order history is derived from Order.customerPhone
  // (not duplicated here); tags/notes/favorites are genuinely new.
  tags               String[] @default([])
  notes              String?
  favoriteProductIds String[] @default([])
```

Replace with:

```prisma
  phone     String   // WhatsApp number (international format, e.g. +212612345678)
  name      String?  // Optional — collected at opt-in
  lastVisit DateTime @default(now())
  optIn     Boolean  @default(true)
  visits    Int      @default(1)
  createdAt DateTime @default(now())

  // CRM Foundation (K19) — visit/order history is derived from Order.customerPhone
  // (not duplicated here); tags/notes/favorites are genuinely new.
  tags               String[] @default([])
  notes              String?
  favoriteProductIds String[] @default([])

  // Loyalty self-service profile (customer-entered via app/[subdomain]/loyalty)
  instagramHandle String?
  facebookHandle  String?
  tiktokHandle    String?
```

- [ ] **Step 3: Push schema + regenerate client**

Run: `npx prisma db push && npx prisma generate`
Expected: no errors, both models updated.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add configurable loyalty settings + customer social handles"
```

---

## Task 2: `LoyaltyService.ts` — configurable rate/tiers + reward-eligibility check

**Files:**
- Modify: `src/loyalty/LoyaltyService.ts` (full file rewrite of the relevant sections)

- [ ] **Step 1: Replace hardcoded tier thresholds with a cafe-driven lookup**

Find:

```typescript
export type MembershipTier = 'BRONZE' | 'SILVER' | 'GOLD'

// Thresholds on lifetime points earned (never lowered by redemption).
const TIER_THRESHOLDS: { tier: MembershipTier; min: number }[] = [
  { tier: 'GOLD',   min: 2000 },
  { tier: 'SILVER', min: 500 },
  { tier: 'BRONZE', min: 0 },
]

export function getTier(lifetimePoints: number): MembershipTier {
  return TIER_THRESHOLDS.find(t => lifetimePoints >= t.min)!.tier
}

// Default earning rule: 10 currency units = 1 point, rounded down — same
// rate already hardcoded in routes/orders.ts's COMPLETED handler (reused
// as the canonical default here, not diverging from it).
export function calculateEarnedPoints(totalPrice: number): number {
  return Math.floor(totalPrice / 10)
}
```

Replace with:

```typescript
export type MembershipTier = 'BRONZE' | 'SILVER' | 'GOLD'

// Thresholds are now per-cafe (Cafe.loyaltyTierSilverThreshold /
// loyaltyTierGoldThreshold), configurable via the Settings tab in
// /admin/loyalty. This function takes them as parameters instead of a
// hardcoded array so callers stay explicit about which cafe's config
// they're using.
export function getTier(lifetimePoints: number, silverThreshold: number, goldThreshold: number): MembershipTier {
  if (lifetimePoints >= goldThreshold)   return 'GOLD'
  if (lifetimePoints >= silverThreshold) return 'SILVER'
  return 'BRONZE'
}

// Earning rule: `pointsPerCurrency` currency units = 1 point, rounded down.
// Now per-cafe (Cafe.loyaltyPointsPerCurrency, default 10), configurable via
// the Settings tab in /admin/loyalty — was previously a hardcoded `10` here
// AND separately hardcoded again (and never kept in sync) in
// routes/orders.ts, which is the bug Task 3 fixes.
export function calculateEarnedPoints(totalPrice: number, pointsPerCurrency: number): number {
  return Math.floor(totalPrice / pointsPerCurrency)
}

async function getLoyaltyConfig(cafeId: string) {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { loyaltyPointsPerCurrency: true, loyaltyTierSilverThreshold: true, loyaltyTierGoldThreshold: true },
  })
  return {
    pointsPerCurrency: cafe?.loyaltyPointsPerCurrency ?? 10,
    silverThreshold:   cafe?.loyaltyTierSilverThreshold ?? 500,
    goldThreshold:     cafe?.loyaltyTierGoldThreshold ?? 2000,
  }
}
```

- [ ] **Step 2: Update `earnPoints` to use the cafe's config and detect newly-eligible rewards**

Find:

```typescript
// ─── Earn ───────────────────────────────────────────────────────────────────
export async function earnPoints(cafeId: string, phone: string, totalPrice: number, orderId?: string) {
  const points = calculateEarnedPoints(totalPrice)
  if (points <= 0) return getOrCreateAccount(cafeId, phone)

  const before = await getOrCreateAccount(cafeId, phone)
  const tierBefore = getTier(before.lifetimePoints)

  const updated = await prisma.loyaltyAccount.update({
    where: { cafeId_phone: { cafeId, phone } },
    data: {
      points:         { increment: points },
      lifetimePoints: { increment: points },
      ledger:         { push: { type: 'EARN', points, orderId: orderId ?? null, note: 'Order completed', createdAt: new Date() } },
    },
  })

  publishStandardEvent('LoyaltyPointsEarned', {
    tenantId: cafeId, resourceId: updated.id, metadata: { phone, points, orderId },
  }, 'loyalty')

  const tierAfter = getTier(updated.lifetimePoints)
  if (tierAfter !== tierBefore) {
    publishStandardEvent('LoyaltyTierChanged', {
      tenantId: cafeId, resourceId: updated.id, metadata: { phone, from: tierBefore, to: tierAfter },
    }, 'loyalty')
  }

  return updated
}
```

Replace with:

```typescript
// ─── Earn ───────────────────────────────────────────────────────────────────
export async function earnPoints(cafeId: string, phone: string, totalPrice: number, orderId?: string) {
  const config = await getLoyaltyConfig(cafeId)
  const points = calculateEarnedPoints(totalPrice, config.pointsPerCurrency)
  if (points <= 0) return getOrCreateAccount(cafeId, phone)

  const before = await getOrCreateAccount(cafeId, phone)
  const tierBefore = getTier(before.lifetimePoints, config.silverThreshold, config.goldThreshold)

  const updated = await prisma.loyaltyAccount.update({
    where: { cafeId_phone: { cafeId, phone } },
    data: {
      points:         { increment: points },
      lifetimePoints: { increment: points },
      ledger:         { push: { type: 'EARN', points, orderId: orderId ?? null, note: 'Order completed', createdAt: new Date() } },
    },
  })

  publishStandardEvent('LoyaltyPointsEarned', {
    tenantId: cafeId, resourceId: updated.id, metadata: { phone, points, orderId },
  }, 'loyalty')

  const tierAfter = getTier(updated.lifetimePoints, config.silverThreshold, config.goldThreshold)
  if (tierAfter !== tierBefore) {
    publishStandardEvent('LoyaltyTierChanged', {
      tenantId: cafeId, resourceId: updated.id, metadata: { phone, from: tierBefore, to: tierAfter },
    }, 'loyalty')
  }

  // Newly-eligible rewards: active rewards whose pointsCost the customer just
  // crossed with this earn (was below before.points, now at or above the new
  // balance). WhatsAppEngine listens for this event and sends one message
  // covering every reward that became reachable in this single earn.
  const activeRewards = await prisma.loyaltyReward.findMany({ where: { cafeId, isActive: true } })
  const newlyEligible = activeRewards.filter(r => before.points < r.pointsCost && r.pointsCost <= updated.points)
  if (newlyEligible.length > 0) {
    publishStandardEvent('LoyaltyRewardEligible', {
      tenantId: cafeId, resourceId: updated.id,
      metadata: { phone, rewardNames: newlyEligible.map(r => r.name), currentPoints: updated.points },
    }, 'loyalty')
  }

  return updated
}
```

- [ ] **Step 3: Update `getTierInfo` to use the cafe's config**

Find:

```typescript
export async function getTierInfo(cafeId: string, phone: string) {
  const account = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } } })
  const lifetimePoints = account?.lifetimePoints ?? 0
  const tier = getTier(lifetimePoints)
  const next = TIER_THRESHOLDS.filter(t => t.min > lifetimePoints).sort((a, b) => a.min - b.min)[0]

  return {
    tier,
    lifetimePoints,
    currentPoints: account?.points ?? 0,
    nextTier: next ? { tier: next.tier, pointsNeeded: next.min - lifetimePoints } : null,
  }
}
```

Replace with:

```typescript
export async function getTierInfo(cafeId: string, phone: string) {
  const [account, config] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } } }),
    getLoyaltyConfig(cafeId),
  ])
  const lifetimePoints = account?.lifetimePoints ?? 0
  const tier = getTier(lifetimePoints, config.silverThreshold, config.goldThreshold)

  const thresholds: { tier: MembershipTier; min: number }[] = [
    { tier: 'GOLD',   min: config.goldThreshold },
    { tier: 'SILVER', min: config.silverThreshold },
  ]
  const next = thresholds.filter(t => t.min > lifetimePoints).sort((a, b) => a.min - b.min)[0]

  return {
    tier,
    lifetimePoints,
    currentPoints: account?.points ?? 0,
    nextTier: next ? { tier: next.tier, pointsNeeded: next.min - lifetimePoints } : null,
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors in `src/routes/orders.ts` are expected here if it calls `calculateEarnedPoints`/`getTier` directly (it doesn't — it has its own inline copy, fixed in Task 3) — everything else should be clean. If you see an error outside `orders.ts`, stop and investigate before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/loyalty/LoyaltyService.ts
git commit -m "feat(loyalty): make earning rate and tier thresholds configurable per cafe"
```

---

## Task 3: Fix the `orders.ts` bug — route through `earnPoints()`

**Files:**
- Modify: `src/routes/orders.ts:236-263`

- [ ] **Step 1: Import `earnPoints`**

Find (near the top of the file, with the other imports):

```typescript
import { deductInventoryForOrder } from '../services/inventoryDeduction'
```

Replace with:

```typescript
import { deductInventoryForOrder } from '../services/inventoryDeduction'
import { earnPoints } from '../loyalty/LoyaltyService'
```

If the import above isn't present verbatim, search the file for the actual import of `deductInventoryForOrder` (it's used at the line right before the loyalty-award block, per the code below) and add the `earnPoints` import as a new line directly below it instead.

- [ ] **Step 2: Replace the inline point-awarding block**

Find:

```typescript
      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        await applyOrderFee(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', false, order._count.items)

        // Deduct inventory stock for each recipe ingredient consumed
        await deductInventoryForOrder(tx, cafeId, orderId)

        // Award loyalty points: 10 MAD = 1 point, rounded down
        if (order.customerPhone) {
          const earned = Math.floor(order.totalPrice / 10)
          if (earned > 0) {
            await tx.loyaltyAccount.upsert({
              where:  { cafeId_phone: { cafeId, phone: order.customerPhone } },
              create: {
                cafeId,
                phone:  order.customerPhone,
                points: earned,
                ledger: [{ type: 'EARN', points: earned, orderId, note: `Order completed`, createdAt: new Date() }],
              },
              update: {
                points: { increment: earned },
                ledger: {
                  push: { type: 'EARN', points: earned, orderId, note: `Order completed` }
                }
              }
            })
          }
        }
      }
    })
```

Replace with:

```typescript
      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        await applyOrderFee(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', false, order._count.items)

        // Deduct inventory stock for each recipe ingredient consumed
        await deductInventoryForOrder(tx, cafeId, orderId)
      }
    })

    // Award loyalty points via the shared service (outside the transaction —
    // earnPoints does its own prisma call and previously this block bypassed
    // LoyaltyService entirely with a duplicated, out-of-sync copy that never
    // updated lifetimePoints, silently breaking tier progression).
    if (status === 'COMPLETED' && order.status !== 'COMPLETED' && order.customerPhone) {
      await earnPoints(cafeId, order.customerPhone, order.totalPrice, orderId)
    }
```

Note the closing `})` of the `prisma.$transaction` moves up to right after `deductInventoryForOrder` — verify against the actual surrounding code that this is the correct transaction boundary (the `if (status === 'COMPLETED' ...)` block should be the last thing inside the transaction before this change; if there is code after the loyalty block and before the transaction's closing `})` in the actual file, keep that code inside the transaction and only move the loyalty-award block out, adjusting braces accordingly).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, complete a real order for a phone number with `customerPhone` set (or use the control test script from Task 11 once it exists), then query the `LoyaltyAccount` directly:

```bash
npx ts-node --transpile-only -e "
import prisma from './src/prisma';
prisma.loyaltyAccount.findFirst({ where: { phone: '<test-phone>' } }).then(a => { console.log(a); process.exit(0) })
"
```

Expected: `lifetimePoints` equals `points` for a fresh account (both incremented together), where previously `lifetimePoints` would have stayed `0`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/orders.ts
git commit -m "fix(loyalty): route order-completion point awards through LoyaltyService (fixes lifetimePoints never updating)"
```

---

## Task 4: Settings API + richer customer/account responses

**Files:**
- Modify: `src/routes/loyalty.ts`

- [ ] **Step 1: Add the settings routes**

Find (end of file):

```typescript
export default router
```

Replace with:

```typescript
// ─── K-Loyalty — Settings (points rate + tier thresholds) ────────────────────

router.get('/api/loyalty/settings', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { loyaltyPointsPerCurrency: true, loyaltyTierSilverThreshold: true, loyaltyTierGoldThreshold: true },
    })
    return res.json({
      pointsPerCurrency: cafe?.loyaltyPointsPerCurrency ?? 10,
      silverThreshold:   cafe?.loyaltyTierSilverThreshold ?? 500,
      goldThreshold:     cafe?.loyaltyTierGoldThreshold ?? 2000,
    })
  } catch (err) {
    logger.error({ msg: 'GET loyalty settings error', err })
    return res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

router.patch('/api/loyalty/settings', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { pointsPerCurrency, silverThreshold, goldThreshold } = req.body as Record<string, any>

    const data: Record<string, any> = {}
    if (pointsPerCurrency !== undefined) {
      if (!(Number(pointsPerCurrency) > 0)) return res.status(400).json({ error: 'pointsPerCurrency must be a positive number' })
      data.loyaltyPointsPerCurrency = Number(pointsPerCurrency)
    }
    if (silverThreshold !== undefined) {
      if (!Number.isInteger(silverThreshold) || silverThreshold < 0) return res.status(400).json({ error: 'silverThreshold must be a non-negative integer' })
      data.loyaltyTierSilverThreshold = silverThreshold
    }
    if (goldThreshold !== undefined) {
      if (!Number.isInteger(goldThreshold) || goldThreshold < 0) return res.status(400).json({ error: 'goldThreshold must be a non-negative integer' })
      data.loyaltyTierGoldThreshold = goldThreshold
    }

    const effectiveSilver = data.loyaltyTierSilverThreshold ?? (await prisma.cafe.findUnique({ where: { id: cafeId }, select: { loyaltyTierSilverThreshold: true } }))?.loyaltyTierSilverThreshold ?? 500
    const effectiveGold   = data.loyaltyTierGoldThreshold   ?? (await prisma.cafe.findUnique({ where: { id: cafeId }, select: { loyaltyTierGoldThreshold: true } }))?.loyaltyTierGoldThreshold ?? 2000
    if (effectiveGold <= effectiveSilver) {
      return res.status(400).json({ error: 'goldThreshold must be greater than silverThreshold' })
    }

    const cafe = await prisma.cafe.update({ where: { id: cafeId }, data })
    return res.json({
      pointsPerCurrency: cafe.loyaltyPointsPerCurrency,
      silverThreshold:   cafe.loyaltyTierSilverThreshold,
      goldThreshold:     cafe.loyaltyTierGoldThreshold,
    })
  } catch (err) {
    logger.error({ msg: 'PATCH loyalty settings error', err })
    return res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router
```

- [ ] **Step 2: Include `lifetimePoints` in the customers list and single-account responses**

Find:

```typescript
    const [accounts, total] = await Promise.all([
      prisma.loyaltyAccount.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, phone: true, points: true, createdAt: true, updatedAt: true },
      }),
      prisma.loyaltyAccount.count({ where }),
    ])
```

Replace with:

```typescript
    const [accounts, total] = await Promise.all([
      prisma.loyaltyAccount.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, phone: true, points: true, lifetimePoints: true, createdAt: true, updatedAt: true },
      }),
      prisma.loyaltyAccount.count({ where }),
    ])
```

Find:

```typescript
    if (!account) {
      return res.json({ phone, points: 0, ledger: [] })
    }

    // Return last 20 entries (newest first) — ledger is append-only in MongoDB
    const recent = [...account.ledger].reverse().slice(0, 20)

    return res.json({ phone, points: account.points, ledger: recent })
```

Replace with:

```typescript
    if (!account) {
      return res.json({ phone, points: 0, lifetimePoints: 0, ledger: [] })
    }

    // Return last 20 entries (newest first) — ledger is append-only in MongoDB
    const recent = [...account.ledger].reverse().slice(0, 20)

    return res.json({ phone, points: account.points, lifetimePoints: account.lifetimePoints, ledger: recent })
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, then:
```bash
curl http://localhost:3000/api/loyalty/settings -H "Authorization: Bearer $TOKEN"
```
Expected: `200` with `{"pointsPerCurrency":10,"silverThreshold":500,"goldThreshold":2000}` (defaults). Then:
```bash
curl -X PATCH http://localhost:3000/api/loyalty/settings -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"pointsPerCurrency": 5}'
```
Expected: `200` with `pointsPerCurrency: 5`, others unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/routes/loyalty.ts
git commit -m "feat(loyalty): add settings API, include lifetimePoints in customer responses"
```

---

## Task 5: WhatsApp auto-notification on reward eligibility

**Files:**
- Modify: `src/whatsapp/WhatsAppEngine.ts`

- [ ] **Step 1: Subscribe to `LoyaltyRewardEligible`**

Find:

```typescript
export function initWhatsAppEngine(): void {
  eventBus.subscribe('SupportTicketEscalated', async (event: any) => {
    try {
      const { tenantId: cafeId } = event.payload as { tenantId: string }
      const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { paymentConfig: true } })
      const phone = (cafe?.paymentConfig as { whatsappNumber?: string } | null)?.whatsappNumber
      if (!phone) return
      await sendMessage(cafeId, phone, '⚠️ A support ticket was just escalated and needs urgent attention.')
    } catch (err) {
      logger.error({ msg: '[WhatsAppEngine] SupportTicketEscalated handler failed', err })
    }
  })

  logger.info({ msg: '[WhatsAppEngine] initialized — subscribed to SupportTicketEscalated' })
}
```

Replace with:

```typescript
export function initWhatsAppEngine(): void {
  eventBus.subscribe('SupportTicketEscalated', async (event: any) => {
    try {
      const { tenantId: cafeId } = event.payload as { tenantId: string }
      const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { paymentConfig: true } })
      const phone = (cafe?.paymentConfig as { whatsappNumber?: string } | null)?.whatsappNumber
      if (!phone) return
      await sendMessage(cafeId, phone, '⚠️ A support ticket was just escalated and needs urgent attention.')
    } catch (err) {
      logger.error({ msg: '[WhatsAppEngine] SupportTicketEscalated handler failed', err })
    }
  })

  // Sends the customer's OWN WhatsApp number a notification when they
  // become eligible for a loyalty reward — distinct from the
  // SupportTicketEscalated handler above, which notifies the restaurant's
  // own WhatsApp number. Gated on CafeCustomer.optIn so we never message a
  // customer who hasn't consented to WhatsApp contact.
  eventBus.subscribe('LoyaltyRewardEligible', async (event: any) => {
    try {
      const { tenantId: cafeId, metadata } = event.payload as {
        tenantId: string
        metadata: { phone: string; rewardNames: string[]; currentPoints: number }
      }
      const customer = await prisma.cafeCustomer.findUnique({
        where:  { cafeId_phone: { cafeId, phone: metadata.phone } },
        select: { optIn: true },
      })
      if (!customer?.optIn) return

      const rewardList = metadata.rewardNames.join(', ')
      await sendMessage(cafeId, metadata.phone,
        `🎁 You've earned enough points (${metadata.currentPoints}) for: ${rewardList}! Ask your server to redeem it on your next visit.`)
    } catch (err) {
      logger.error({ msg: '[WhatsAppEngine] LoyaltyRewardEligible handler failed', err })
    }
  })

  logger.info({ msg: '[WhatsAppEngine] initialized — subscribed to SupportTicketEscalated, LoyaltyRewardEligible' })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/whatsapp/WhatsAppEngine.ts
git commit -m "feat(loyalty): send automatic WhatsApp notification when a customer becomes reward-eligible"
```

---

## Task 6: Public customer-facing loyalty profile routes

**Files:**
- Modify: `src/routes/customers.ts`

- [ ] **Step 1: Import `getTierInfo`**

Find:

```typescript
import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import {
  getCustomerProfile, searchCustomers, addTag, removeTag, setNotes, addFavorite, removeFavorite,
} from '../customers/CustomerService'
```

Replace with:

```typescript
import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import {
  getCustomerProfile, searchCustomers, addTag, removeTag, setNotes, addFavorite, removeFavorite,
} from '../customers/CustomerService'
import { getTierInfo } from '../loyalty/LoyaltyService'
```

- [ ] **Step 2: Add the public GET/PATCH routes**

Find:

```typescript
// ─── DELETE /api/customers/optout ─────────────────────────────────────────────
```

Add directly above it:

```typescript
// ─── Public (no-auth) loyalty self-service profile ───────────────────────────
// Used by app/[subdomain]/loyalty/page.tsx — a customer looks themselves up
// by phone and can edit their own name + social handles. No admin auth: the
// phone number itself is the access control (same trust model as the
// existing /api/customers/optin route above).

router.get('/api/public/loyalty/:subdomain/:phone', async (req: Request, res: Response) => {
  try {
    const subdomain = (req.params.subdomain as string).trim().toLowerCase()
    const phone     = req.params.phone as string

    const cafe = await prisma.cafe.findUnique({ where: { subdomain }, select: { id: true, isActive: true } })
    if (!cafe || !cafe.isActive) return res.status(404).json({ error: 'Cafe not found' })

    const [tierInfo, customer] = await Promise.all([
      getTierInfo(cafe.id, phone),
      prisma.cafeCustomer.findUnique({
        where:  { cafeId_phone: { cafeId: cafe.id, phone } },
        select: { name: true, instagramHandle: true, facebookHandle: true, tiktokHandle: true },
      }),
    ])

    return res.json({
      ...tierInfo,
      customer: customer ?? { name: null, instagramHandle: null, facebookHandle: null, tiktokHandle: null },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/api/public/loyalty/:subdomain/:phone', async (req: Request, res: Response) => {
  try {
    const subdomain = (req.params.subdomain as string).trim().toLowerCase()
    const phone     = req.params.phone as string
    const { name, instagramHandle, facebookHandle, tiktokHandle } = req.body as Record<string, any>

    const cafe = await prisma.cafe.findUnique({ where: { subdomain }, select: { id: true, isActive: true } })
    if (!cafe || !cafe.isActive) return res.status(404).json({ error: 'Cafe not found' })

    const customer = await prisma.cafeCustomer.upsert({
      where: { cafeId_phone: { cafeId: cafe.id, phone } },
      create: {
        cafeId: cafe.id, phone,
        name: name?.trim() || null,
        instagramHandle: instagramHandle?.trim() || null,
        facebookHandle:  facebookHandle?.trim()  || null,
        tiktokHandle:    tiktokHandle?.trim()     || null,
      },
      update: {
        ...(name             !== undefined && { name:             name?.trim()             || null }),
        ...(instagramHandle  !== undefined && { instagramHandle:  instagramHandle?.trim()  || null }),
        ...(facebookHandle   !== undefined && { facebookHandle:   facebookHandle?.trim()   || null }),
        ...(tiktokHandle     !== undefined && { tiktokHandle:     tiktokHandle?.trim()     || null }),
      },
      select: { name: true, instagramHandle: true, facebookHandle: true, tiktokHandle: true },
    })

    return res.json({ ok: true, customer })
  } catch (err) {
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── DELETE /api/customers/optout ─────────────────────────────────────────────
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

```bash
curl http://localhost:3000/api/public/loyalty/plage/%2B212600000001
```
Expected: `200` with `{tier, lifetimePoints, currentPoints, nextTier, customer}`, all zeroed/null for a phone with no prior activity.
```bash
curl -X PATCH http://localhost:3000/api/public/loyalty/plage/%2B212600000001 -H "Content-Type: application/json" -d '{"name":"Test User","instagramHandle":"@testuser"}'
```
Expected: `200` with the customer object reflecting the new name/handle.

- [ ] **Step 5: Commit**

```bash
git add src/routes/customers.ts
git commit -m "feat(loyalty): add public self-service profile routes (GET/PATCH by phone)"
```

---

## Task 7: Admin page — fix inconsistent tier logic, use `lifetimePoints`

**Files:**
- Modify: `app/admin/loyalty/page.tsx`

- [ ] **Step 1: Update the `LoyaltyCustomer` and `CustomerDetail` interfaces**

Find:

```tsx
interface LoyaltyCustomer {
  id:        string
  phone:     string
  points:    number
  createdAt: string
  updatedAt: string
}
```

Replace with:

```tsx
interface LoyaltyCustomer {
  id:             string
  phone:          string
  points:         number
  lifetimePoints: number
  createdAt:      string
  updatedAt:      string
}
```

Find:

```tsx
interface CustomerDetail {
  phone:   string
  points:  number
  ledger:  LedgerEntry[]
}
```

Replace with:

```tsx
interface CustomerDetail {
  phone:          string
  points:         number
  lifetimePoints: number
  ledger:         LedgerEntry[]
}
```

- [ ] **Step 2: Remove the inconsistent client-side `getTier` and replace call sites with real backend thresholds**

Find:

```tsx
function getTier(pts: number, t: typeof T[Lang]) {
  if (pts >= 1000) return { label: t.platinum, color: 'text-cyan-400',   bg: 'bg-cyan-500/15',   ring: 'ring-cyan-500/30'   }
  if (pts >= 500)  return { label: t.gold,     color: 'text-amber-400',  bg: 'bg-amber-500/15',  ring: 'ring-amber-500/30'  }
  if (pts >= 200)  return { label: t.silver,   color: 'text-slate-300',  bg: 'bg-slate-500/15',  ring: 'ring-slate-500/30'  }
  return                  { label: t.bronze,   color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' }
}
```

Replace with:

```tsx
interface LoyaltySettings {
  pointsPerCurrency: number
  silverThreshold:   number
  goldThreshold:     number
}

function getTierBadge(lifetimePoints: number, thresholds: LoyaltySettings | null, t: typeof T[Lang]) {
  const gold   = thresholds?.goldThreshold   ?? 2000
  const silver = thresholds?.silverThreshold ?? 500
  if (lifetimePoints >= gold)   return { label: t.gold,   color: 'text-amber-400',  bg: 'bg-amber-500/15',  ring: 'ring-amber-500/30'  }
  if (lifetimePoints >= silver) return { label: t.silver, color: 'text-slate-300',  bg: 'bg-slate-500/15',  ring: 'ring-slate-500/30'  }
  return                        { label: t.bronze, color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' }
}
```

Note the `platinum` key in the `T` table becomes unused — leave it in place for now (removing i18n keys across all 4 languages is out of scope for this task; it's harmless dead data, not a bug).

- [ ] **Step 3: Fetch settings once and pass thresholds through, using `lifetimePoints` instead of `points`**

Find:

```tsx
  const [profile,        setProfile]        = useState<CustomerDetail | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfile,    setShowProfile]    = useState(false)
```

Replace with:

```tsx
  const [profile,        setProfile]        = useState<CustomerDetail | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfile,    setShowProfile]    = useState(false)
  const [settings,       setSettings]       = useState<LoyaltySettings | null>(null)
```

Find:

```tsx
  useEffect(() => { loadCustomers() }, [page, sortBy, order])
```

Replace with:

```tsx
  useEffect(() => { loadCustomers() }, [page, sortBy, order])

  useEffect(() => {
    fetch('/api/loyalty/settings', { headers: h }).then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d) })
  }, [])
```

Find:

```tsx
                const tier = getTier(c.points, t)
```

Replace with:

```tsx
                const tier = getTierBadge(c.lifetimePoints, settings, t)
```

Find:

```tsx
                      {(() => { const tier = getTier(profile.points, t); return (
```

Replace with:

```tsx
                      {(() => { const tier = getTierBadge(profile.lifetimePoints, settings, t); return (
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Run `npm run dev`, open `/admin/loyalty`, confirm the customer list and profile modal both still render tier badges without errors, and the badge now reflects `lifetimePoints` (a customer who redeemed points down to a low `points` balance should still show their earned tier, not drop back to Bronze).

- [ ] **Step 6: Commit**

```bash
git add app/admin/loyalty/page.tsx
git commit -m "fix(loyalty): use real backend tier thresholds (lifetimePoints) instead of inconsistent client-side logic"
```

---

## Task 8: Admin page — real Rewards catalog + view switcher (replaces the static, disconnected `REWARDS` array)

**Important context discovered while writing this plan (not in the design spec, found by reading the actual file):** `app/admin/loyalty/page.tsx` currently has **no tab UI at all** despite already having unused `tabCustomers`/`tabRewards` translation keys — the page is a single always-visible customer list. Its redeem modal quick-select buttons read from a **hardcoded, static `const REWARDS = [...]` array** (4 fixed items: free drink/dessert/main/meal-for-2) that is completely disconnected from the real `LoyaltyReward` Prisma model — which already has full working backend CRUD (`GET/POST /api/loyalty/rewards`, `PATCH /api/loyalty/rewards/:id/deactivate`) that no UI anywhere calls. This matters for this plan specifically: Task 2's new WhatsApp reward-eligibility notification reads real `LoyaltyReward` rows from the database — without a way for an admin to actually create one, that feature can never fire for a real restaurant. This task replaces the static array with the real backend data and adds management UI, making Task 2/5's feature actually usable.

**Files:**
- Modify: `app/admin/loyalty/page.tsx`

- [ ] **Step 1: Remove the static `REWARDS` array**

Find:

```tsx
// ─── Static reward tiers ──────────────────────────────────────────────────────

const REWARDS = [
  { id: 'r1', pts: 50,  icon: '☕', label: { ar: 'مشروب مجاني',    fr: 'Boisson offerte',     en: 'Free drink',       es: 'Bebida gratis'    } },
  { id: 'r2', pts: 100, icon: '🍰', label: { ar: 'حلوى مجانية',    fr: 'Dessert offert',      en: 'Free dessert',     es: 'Postre gratis'    } },
  { id: 'r3', pts: 200, icon: '🍽️', label: { ar: 'طبق رئيسي مجاني', fr: 'Plat offert',         en: 'Free main dish',   es: 'Plato gratis'     } },
  { id: 'r4', pts: 500, icon: '🎉', label: { ar: 'وجبة كاملة للاثنين', fr: 'Repas complet ×2',  en: 'Full meal for 2',  es: 'Comida completa ×2' } },
]
```

Replace with: (delete this block entirely — no replacement, the real `rewards` state added in Step 3 takes its place)

```tsx
```

- [ ] **Step 2: Add reward-catalog translation keys to all 4 languages**

Find (in the `ar` block):

```tsx
    rewardTitle:   'كتالوج الجوائز',
    rewardSub:     'الجوائز المتاحة للزبائن عند استبدال نقاطهم',
    rewardPoints:  'نقطة',
    redeem:        'استبدل',
```

Replace with:

```tsx
    rewardTitle:   'كتالوج الجوائز',
    rewardSub:     'الجوائز المتاحة للزبائن عند استبدال نقاطهم',
    rewardPoints:  'نقطة',
    redeem:        'استبدل',
    rewardName:        'اسم الجائزة',
    rewardDescription: 'الوصف (اختياري)',
    rewardCost:        'التكلفة بالنقط',
    createReward:      'إضافة جائزة',
    deactivate:        'إلغاء',
    noRewards:         'لا توجد جوائز بعد — أضف واحدة',
    tabView:           'العرض',
  },
```

Find (in the `fr` block):

```tsx
    rewardTitle:   'Catalogue des récompenses',
    rewardSub:     'Récompenses disponibles pour vos clients',
    rewardPoints:  'pts',
    redeem:        'Échanger',
```

Replace with:

```tsx
    rewardTitle:   'Catalogue des récompenses',
    rewardSub:     'Récompenses disponibles pour vos clients',
    rewardPoints:  'pts',
    redeem:        'Échanger',
    rewardName:        'Nom de la récompense',
    rewardDescription: 'Description (optionnel)',
    rewardCost:        'Coût en points',
    createReward:      'Ajouter une récompense',
    deactivate:        'Désactiver',
    noRewards:         'Aucune récompense — ajoutez-en une',
    tabView:           'Vue',
  },
```

Find (in the `en` block):

```tsx
    rewardTitle:   'Rewards catalog',
    rewardSub:     'Available rewards for your customers',
    rewardPoints:  'pts',
    redeem:        'Redeem',
```

Replace with:

```tsx
    rewardTitle:   'Rewards catalog',
    rewardSub:     'Available rewards for your customers',
    rewardPoints:  'pts',
    redeem:        'Redeem',
    rewardName:        'Reward name',
    rewardDescription: 'Description (optional)',
    rewardCost:        'Cost in points',
    createReward:      'Add reward',
    deactivate:        'Deactivate',
    noRewards:         'No rewards yet — add one',
    tabView:           'View',
  },
```

Find (in the `es` block):

```tsx
    rewardTitle:   'Catálogo de recompensas',
    rewardSub:     'Recompensas disponibles para tus clientes',
    rewardPoints:  'pts',
    redeem:        'Canjear',
```

Replace with:

```tsx
    rewardTitle:   'Catálogo de recompensas',
    rewardSub:     'Recompensas disponibles para tus clientes',
    rewardPoints:  'pts',
    redeem:        'Canjear',
    rewardName:        'Nombre de la recompensa',
    rewardDescription: 'Descripción (opcional)',
    rewardCost:        'Costo en puntos',
    createReward:      'Añadir recompensa',
    deactivate:        'Desactivar',
    noRewards:         'Sin recompensas — añade una',
    tabView:           'Vista',
  },
```

- [ ] **Step 3: Add `view` state, rewards state, and reward CRUD functions**

Find:

```tsx
  // ── Redeem state ───────────────────────────────────────────────────────────
  const [showRedeem,     setShowRedeem]     = useState(false)
  const [redeemPts,      setRedeemPts]      = useState('')
  const [redeemLoading,  setRedeemLoading]  = useState(false)
  const [redeemMsg,      setRedeemMsg]      = useState<{ ok: boolean; text: string } | null>(null)
```

Replace with:

```tsx
  // ── Redeem state ───────────────────────────────────────────────────────────
  const [showRedeem,     setShowRedeem]     = useState(false)
  const [redeemPts,      setRedeemPts]      = useState('')
  const [redeemLoading,  setRedeemLoading]  = useState(false)
  const [redeemMsg,      setRedeemMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  // ── View switcher + rewards catalog state ──────────────────────────────────
  const [view, setView] = useState<'customers' | 'rewards'>('customers')
  interface LoyaltyRewardRow { id: string; name: string; description: string | null; pointsCost: number; isActive: boolean }
  const [rewards,        setRewards]        = useState<LoyaltyRewardRow[]>([])
  const [rewardForm,     setRewardForm]     = useState({ name: '', description: '', pointsCost: '' })
  const [rewardSaving,   setRewardSaving]   = useState(false)
```

Find:

```tsx
  useEffect(() => { loadCustomers() }, [page, sortBy, order])
```

Replace with:

```tsx
  useEffect(() => { loadCustomers() }, [page, sortBy, order])

  const loadRewards = useCallback(async () => {
    const res = await fetch('/api/loyalty/rewards', { headers: h })
    if (res.ok) setRewards((await res.json()).rewards ?? [])
  }, [])

  useEffect(() => { loadRewards() }, [])

  async function createNewReward() {
    if (!rewardForm.name.trim() || !rewardForm.pointsCost) return
    setRewardSaving(true)
    try {
      const res = await fetch('/api/loyalty/rewards', {
        method: 'POST', headers: h,
        body: JSON.stringify({
          name: rewardForm.name.trim(),
          description: rewardForm.description.trim() || undefined,
          pointsCost: Number(rewardForm.pointsCost),
        }),
      })
      if (res.ok) { setRewardForm({ name: '', description: '', pointsCost: '' }); await loadRewards() }
    } finally {
      setRewardSaving(false)
    }
  }

  async function deactivateReward(id: string) {
    await fetch(`/api/loyalty/rewards/${id}/deactivate`, { method: 'PATCH', headers: h })
    await loadRewards()
  }
```

- [ ] **Step 4: Add the view-switcher buttons to the header**

Find:

```tsx
        <button onClick={() => loadCustomers()} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ════════════════ CUSTOMERS ════════════════ */}
      <div className="space-y-4">
```

Replace with:

```tsx
        <button onClick={() => loadCustomers()} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ════════════════ VIEW SWITCHER ════════════════ */}
      <div className="flex gap-2">
        <button onClick={() => setView('customers')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'customers' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
          {t.tabCustomers}
        </button>
        <button onClick={() => setView('rewards')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'rewards' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
          {t.tabRewards}
        </button>
      </div>

      {/* ════════════════ CUSTOMERS ════════════════ */}
      {view === 'customers' && (
      <div className="space-y-4">
```

- [ ] **Step 5: Close the `view === 'customers'` conditional and add the Rewards view**

Find:

```tsx
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <span className="text-sm text-slate-400">
                {t.page} {page} {t.of} {pages}
              </span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          )}
        </div>

      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
```

Replace with:

```tsx
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <span className="text-sm text-slate-400">
                {t.page} {page} {t.of} {pages}
              </span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ REWARDS CATALOG ════════════════ */}
      {view === 'rewards' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-white font-bold">{t.rewardTitle}</h2>
            <p className="text-slate-400 text-sm">{t.rewardSub}</p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3 max-w-md">
            <input value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t.rewardName}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
            <input value={rewardForm.description} onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t.rewardDescription}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
            <input type="number" min={1} value={rewardForm.pointsCost} onChange={e => setRewardForm(f => ({ ...f, pointsCost: e.target.value }))}
              placeholder={t.rewardCost}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
            <button onClick={createNewReward} disabled={rewardSaving || !rewardForm.name.trim() || !rewardForm.pointsCost}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
              {rewardSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : t.createReward}
            </button>
          </div>

          {rewards.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-10 text-center text-slate-500 text-sm">{t.noRewards}</div>
          ) : (
            <div className="space-y-2">
              {rewards.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                  <div>
                    <p className="text-white font-semibold text-sm">{r.name}</p>
                    {r.description && <p className="text-slate-500 text-xs mt-0.5">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-violet-400 font-bold text-sm">{r.pointsCost} {t.rewardPoints}</span>
                    <button onClick={() => deactivateReward(r.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                      {t.deactivate}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
```

- [ ] **Step 6: Replace the redeem modal's static-array quick-select with real rewards**

Find:

```tsx
              {/* Quick-select reward buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {REWARDS.filter(r => r.pts <= profile.points).map(r => (
                  <button key={r.id} onClick={() => setRedeemPts(String(r.pts))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      redeemPts === String(r.pts) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {r.icon} {r.pts}
                  </button>
                ))}
              </div>
```

Replace with:

```tsx
              {/* Quick-select reward buttons — real catalog, not a static list */}
              <div className="flex flex-wrap gap-2 pt-1">
                {rewards.filter(r => r.pointsCost <= profile.points).map(r => (
                  <button key={r.id} onClick={() => setRedeemPts(String(r.pointsCost))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      redeemPts === String(r.pointsCost) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    🎁 {r.name} · {r.pointsCost}
                  </button>
                ))}
              </div>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Manual browser check**

Open `/admin/loyalty`, click the "Rewards" view button, create a new reward (e.g. name "Free Coffee", cost 30 points), confirm it appears in the list. Open a customer profile with 30+ points and confirm the redeem modal's quick-select now shows the real "Free Coffee" reward instead of the old static list. Click "Deactivate" on the test reward and confirm it disappears from the list.

- [ ] **Step 9: Commit**

```bash
git add app/admin/loyalty/page.tsx
git commit -m "feat(loyalty): replace static reward array with real LoyaltyReward catalog + management UI"
```

---

## Task 9: Admin page — Settings view

**Files:**
- Modify: `app/admin/loyalty/page.tsx`

- [ ] **Step 1: Add Settings translations to all 4 languages**

Find (in the `ar` block — the block Task 8 Step 2 just extended):

```tsx
    noRewards:         'لا توجد جوائز بعد — أضف واحدة',
    tabView:           'العرض',
  },
```

Replace with:

```tsx
    noRewards:         'لا توجد جوائز بعد — أضف واحدة',
    tabView:           'العرض',
    tabSettings:      'الإعدادات',
    settingsTitle:    'إعدادات نظام النقط',
    settingsSub:      'حدد معدل الكسب وعتبات المستويات لهاد المطعم',
    pointsPerCurrency:'المبلغ مقابل نقطة واحدة',
    silverThreshold:  'عتبة المستوى الفضي (نقط)',
    goldThreshold:    'عتبة المستوى الذهبي (نقط)',
    settingsSave:     'حفظ الإعدادات',
    settingsSaved:    'تم الحفظ بنجاح',
    settingsError:    'فشل الحفظ',
  },
```

Find (in the `fr` block):

```tsx
    noRewards:         'Aucune récompense — ajoutez-en une',
    tabView:           'Vue',
  },
```

Replace with:

```tsx
    noRewards:         'Aucune récompense — ajoutez-en une',
    tabView:           'Vue',
    tabSettings:      'Paramètres',
    settingsTitle:    'Paramètres du programme de points',
    settingsSub:      'Définissez le taux de gain et les seuils de niveau pour ce restaurant',
    pointsPerCurrency:'Montant pour 1 point',
    silverThreshold:  'Seuil niveau Argent (points)',
    goldThreshold:    'Seuil niveau Or (points)',
    settingsSave:     'Enregistrer',
    settingsSaved:    'Enregistré avec succès',
    settingsError:    'Échec de l\'enregistrement',
  },
```

Find (in the `en` block):

```tsx
    noRewards:         'No rewards yet — add one',
    tabView:           'View',
  },
```

Replace with:

```tsx
    noRewards:         'No rewards yet — add one',
    tabView:           'View',
    tabSettings:      'Settings',
    settingsTitle:    'Points Program Settings',
    settingsSub:      'Set the earning rate and tier thresholds for this restaurant',
    pointsPerCurrency:'Amount for 1 point',
    silverThreshold:  'Silver Tier Threshold (points)',
    goldThreshold:    'Gold Tier Threshold (points)',
    settingsSave:     'Save Settings',
    settingsSaved:    'Saved successfully',
    settingsError:    'Failed to save',
  },
```

Find (in the `es` block):

```tsx
    noRewards:         'Sin recompensas — añade una',
    tabView:           'Vista',
  },
```

Replace with:

```tsx
    noRewards:         'Sin recompensas — añade una',
    tabView:           'Vista',
    tabSettings:      'Ajustes',
    settingsTitle:    'Ajustes del programa de puntos',
    settingsSub:      'Define la tasa de ganancia y los umbrales de nivel para este restaurante',
    pointsPerCurrency:'Monto por 1 punto',
    silverThreshold:  'Umbral nivel Plata (puntos)',
    goldThreshold:    'Umbral nivel Oro (puntos)',
    settingsSave:     'Guardar ajustes',
    settingsSaved:    'Guardado con éxito',
    settingsError:    'Error al guardar',
  },
```

- [ ] **Step 2: Extend the `view` union and add settings-form state**

Find:

```tsx
  const [view, setView] = useState<'customers' | 'rewards'>('customers')
```

Replace with:

```tsx
  const [view, setView] = useState<'customers' | 'rewards' | 'settings'>('customers')
  const [settings,       setSettings]       = useState<LoyaltySettings | null>(null)
  const [settingsForm,   setSettingsForm]   = useState({ pointsPerCurrency: '10', silverThreshold: '500', goldThreshold: '2000' })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg,    setSettingsMsg]    = useState<{ ok: boolean; text: string } | null>(null)
```

Note: `interface LoyaltySettings` is already defined at module level from Task 7 Step 2 — do NOT redeclare it here, just reuse it.

- [ ] **Step 3: Fetch settings and add the save function**

Find:

```tsx
  useEffect(() => { loadRewards() }, [])
```

Replace with:

```tsx
  useEffect(() => { loadRewards() }, [])

  useEffect(() => {
    fetch('/api/loyalty/settings', { headers: h }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setSettings(d)
        setSettingsForm({ pointsPerCurrency: String(d.pointsPerCurrency), silverThreshold: String(d.silverThreshold), goldThreshold: String(d.goldThreshold) })
      }
    })
  }, [])

  async function saveSettings() {
    setSettingsSaving(true); setSettingsMsg(null)
    try {
      const res = await fetch('/api/loyalty/settings', {
        method: 'PATCH', headers: h,
        body: JSON.stringify({
          pointsPerCurrency: Number(settingsForm.pointsPerCurrency),
          silverThreshold:   Number(settingsForm.silverThreshold),
          goldThreshold:     Number(settingsForm.goldThreshold),
        }),
      })
      const data = await res.json()
      if (res.ok) { setSettings(data); setSettingsMsg({ ok: true, text: t.settingsSaved }) }
      else        { setSettingsMsg({ ok: false, text: data.error ?? t.settingsError }) }
    } catch {
      setSettingsMsg({ ok: false, text: t.settingsError })
    } finally {
      setSettingsSaving(false)
    }
  }
```

- [ ] **Step 4: Add the Settings button to the view switcher and the Settings view**

Find:

```tsx
        <button onClick={() => setView('rewards')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'rewards' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
          {t.tabRewards}
        </button>
      </div>
```

Replace with:

```tsx
        <button onClick={() => setView('rewards')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'rewards' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
          {t.tabRewards}
        </button>
        <button onClick={() => setView('settings')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'settings' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
          {t.tabSettings}
        </button>
      </div>
```

Find (the closing of the Rewards view block added in Task 8 Step 5, right before the Customer Profile Panel comment):

```tsx
        </div>
      )}

      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
```

Replace with:

```tsx
        </div>
      )}

      {/* ════════════════ SETTINGS ════════════════ */}
      {view === 'settings' && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 space-y-4 max-w-md">
          <div>
            <h3 className="text-white font-semibold">{t.settingsTitle}</h3>
            <p className="text-slate-400 text-sm">{t.settingsSub}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.pointsPerCurrency}</label>
            <input type="number" min={0.01} step={0.5} value={settingsForm.pointsPerCurrency}
              onChange={e => setSettingsForm(f => ({ ...f, pointsPerCurrency: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.silverThreshold}</label>
            <input type="number" min={0} step={1} value={settingsForm.silverThreshold}
              onChange={e => setSettingsForm(f => ({ ...f, silverThreshold: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.goldThreshold}</label>
            <input type="number" min={0} step={1} value={settingsForm.goldThreshold}
              onChange={e => setSettingsForm(f => ({ ...f, goldThreshold: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{settingsMsg.text}</p>
          )}
          <button onClick={saveSettings} disabled={settingsSaving}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold">
            {settingsSaving ? '…' : t.settingsSave}
          </button>
        </div>
      )}

      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
```

Also wrap the existing Customer Profile Panel and Redeem Modal blocks (both currently unconditional) so they only render in the `customers` view — find:

```tsx
      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
      {showProfile && (
```

Replace with:

```tsx
      {/* ════════════════ CUSTOMER PROFILE PANEL ════════════════ */}
      {view === 'customers' && showProfile && (
```

Find:

```tsx
      {/* ════════════════ REDEEM MODAL ════════════════ */}
      {showRedeem && profile && (
```

Replace with:

```tsx
      {/* ════════════════ REDEEM MODAL ════════════════ */}
      {view === 'customers' && showRedeem && profile && (
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Manual browser check**

Open `/admin/loyalty`, click the new "Settings" view button, change the points-per-currency value, save, confirm the success message appears and `GET /api/loyalty/settings` reflects the new value on reload. Test in at least 2 languages to confirm every new string translates (Tasks 8 and 9 both touch this file — double check no hardcoded strings crept into either).

- [ ] **Step 7: Commit**

```bash
git add app/admin/loyalty/page.tsx
git commit -m "feat(loyalty): add Settings view to /admin/loyalty for configuring points rate + tier thresholds"
```

---

## Task 10: Customer-facing self-service loyalty page

**Files:**
- Create: `app/[subdomain]/loyalty/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Loader2, Award } from 'lucide-react'

type Lang = 'ar' | 'fr' | 'en' | 'es'

const T: Record<Lang, Record<string, string>> = {
  ar: {
    title: 'برنامج الولاء', subtitle: 'أدخل رقم هاتفك باش تشوف نقطك',
    phonePlaceholder: 'رقم الهاتف (+212...)', lookup: 'بحث',
    points: 'النقط الحالية', lifetime: 'مجموع النقط', tier: 'المستوى',
    nextTier: 'باقي لك', pointsToGo: 'نقطة للمستوى الجاي',
    profileTitle: 'الملف الشخصي', name: 'الاسم', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'حفظ', saved: 'تم الحفظ ✓',
    bronze: 'برونز', silver: 'فضي', gold: 'ذهبي', notFound: 'المطعم غير موجود',
  },
  fr: {
    title: 'Programme Fidélité', subtitle: 'Entrez votre numéro pour voir vos points',
    phonePlaceholder: 'Téléphone (+212...)', lookup: 'Rechercher',
    points: 'Points actuels', lifetime: 'Total des points', tier: 'Niveau',
    nextTier: 'Il vous reste', pointsToGo: 'points pour le niveau suivant',
    profileTitle: 'Profil', name: 'Nom', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Enregistrer', saved: 'Enregistré ✓',
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', notFound: 'Restaurant introuvable',
  },
  en: {
    title: 'Loyalty Program', subtitle: 'Enter your phone to see your points',
    phonePlaceholder: 'Phone (+212...)', lookup: 'Look up',
    points: 'Current Points', lifetime: 'Lifetime Points', tier: 'Tier',
    nextTier: 'You need', pointsToGo: 'more points for the next tier',
    profileTitle: 'Profile', name: 'Name', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Save', saved: 'Saved ✓',
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', notFound: 'Restaurant not found',
  },
  es: {
    title: 'Programa de Fidelidad', subtitle: 'Ingresa tu teléfono para ver tus puntos',
    phonePlaceholder: 'Teléfono (+212...)', lookup: 'Buscar',
    points: 'Puntos actuales', lifetime: 'Puntos totales', tier: 'Nivel',
    nextTier: 'Te faltan', pointsToGo: 'puntos para el siguiente nivel',
    profileTitle: 'Perfil', name: 'Nombre', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', save: 'Guardar', saved: 'Guardado ✓',
    bronze: 'Bronce', silver: 'Plata', gold: 'Oro', notFound: 'Restaurante no encontrado',
  },
}

interface ProfileData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  lifetimePoints: number
  currentPoints: number
  nextTier: { tier: string; pointsNeeded: number } | null
  customer: { name: string | null; instagramHandle: string | null; facebookHandle: string | null; tiktokHandle: string | null }
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'text-orange-400', SILVER: 'text-slate-300', GOLD: 'text-amber-400',
}

export default function CustomerLoyaltyPage() {
  const params = useParams()
  const subdomain = params.subdomain as string
  const [lang, setLang] = useState<Lang>('fr')
  const t = T[lang]

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState({ name: '', instagramHandle: '', facebookHandle: '', tiktokHandle: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function lookup() {
    if (!phone.trim()) return
    setLoading(true); setNotFound(false)
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`)
      if (!res.ok) { setNotFound(true); setProfile(null); return }
      const data: ProfileData = await res.json()
      setProfile(data)
      setForm({
        name: data.customer.name ?? '',
        instagramHandle: data.customer.instagramHandle ?? '',
        facebookHandle:  data.customer.facebookHandle  ?? '',
        tiktokHandle:    data.customer.tiktokHandle    ?? '',
      })
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch(`/api/public/loyalty/${subdomain}/${encodeURIComponent(phone.trim())}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex justify-center gap-2 mb-2">
          {(['ar', 'fr', 'en', 'es'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${lang === l ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.subtitle}</p>
        </div>

        <div className="flex gap-2">
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={lookup} disabled={loading || !phone.trim()}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.lookup}
          </button>
        </div>

        {notFound && <p className="text-rose-400 text-sm text-center">{t.notFound}</p>}

        {profile && (
          <>
            <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.points}</span>
                <span className="text-white font-extrabold text-2xl">{profile.currentPoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.lifetime}</span>
                <span className="text-gray-300 font-bold">{profile.lifetimePoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t.tier}</span>
                <span className={`font-bold flex items-center gap-1 ${TIER_COLORS[profile.tier]}`}>
                  <Award className="w-4 h-4" /> {t[profile.tier.toLowerCase() as 'bronze' | 'silver' | 'gold']}
                </span>
              </div>
              {profile.nextTier && (
                <p className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
                  {t.nextTier} {profile.nextTier.pointsNeeded} {t.pointsToGo}
                </p>
              )}
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <h3 className="text-white font-bold text-sm">{t.profileTitle}</h3>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t.name}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.instagramHandle} onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value }))}
                placeholder={t.instagram}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.facebookHandle} onChange={e => setForm(f => ({ ...f, facebookHandle: e.target.value }))}
                placeholder={t.facebook}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={form.tiktokHandle} onChange={e => setForm(f => ({ ...f, tiktokHandle: e.target.value }))}
                placeholder={t.tiktok}
                className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={saveProfile} disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : saved ? t.saved : t.save}
              </button>
            </div>
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

- [ ] **Step 3: Manual browser check**

Run `npm run dev`, open `/plage/loyalty` (or whatever the demo subdomain resolves to locally), look up a phone number with no history (confirm zeroed points + empty profile form), save a name + Instagram handle, reload and look up the same phone again — confirm the saved values persist. Then look up a phone that has real `LoyaltyAccount` activity (from Task 3/4's manual testing) and confirm the real points/tier show correctly.

- [ ] **Step 4: Commit**

```bash
git add "app/[subdomain]/loyalty/page.tsx"
git commit -m "feat(loyalty): add customer-facing self-service profile page"
```

---

## Task 11: Consolidated backend integration test script

**Files:**
- Create: `scripts/controlTestLoyalty.ts`

- [ ] **Step 1: Write the script**

```typescript
/**
 * Integration coverage for the Loyalty Program: configurable earning rate,
 * the orders.ts lifetimePoints bug fix, tier thresholds, the public profile
 * routes, and the reward-eligibility WhatsApp trigger (event-level, not
 * actual message delivery — this repo's WhatsApp send silently no-ops
 * without Evolution API configured, so we assert the event fires instead).
 *
 * Run against a live dev server:
 *   npx ts-node --transpile-only scripts/controlTestLoyalty.ts
 */
import 'dotenv/config'
import prisma from '../src/prisma'
import { eventBus } from '../src/core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
let passed = 0, failed = 0

function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

async function json(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => null)
  return { res, data }
}

async function main() {
  console.log('\n── Setup ───────────────────────────────────────────────')
  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'plage@demo.com'
  const adminPass  = process.env.TEST_ADMIN_PASSWORD ?? 'demo1234'
  const testPhone  = `+212600${Math.floor(100000 + Math.random() * 899999)}`

  const { res: loginRes, data: login } = await json('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPass }),
  })
  ok(loginRes.status === 200, 'admin login → 200')
  const token = login.token as string
  const cafeId = login.cafeId as string
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  console.log('\n── Settings ──────────────────────────────────────────────')
  const { res: getRes, data: originalSettings } = await json('/api/loyalty/settings', { headers: auth })
  ok(getRes.status === 200, 'GET /api/loyalty/settings → 200')
  ok(typeof originalSettings.pointsPerCurrency === 'number', 'settings include pointsPerCurrency')

  const { res: patchRes, data: patched } = await json('/api/loyalty/settings', {
    method: 'PATCH', headers: auth, body: JSON.stringify({ pointsPerCurrency: 5, silverThreshold: 20, goldThreshold: 100 }),
  })
  ok(patchRes.status === 200, 'PATCH /api/loyalty/settings → 200')
  ok(patched.pointsPerCurrency === 5, 'pointsPerCurrency updated to 5')

  console.log('\n── Earning uses the new configurable rate ───────────────')
  const { earnPoints } = await import('../src/loyalty/LoyaltyService')
  const before = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone: testPhone } } })
  ok(!before, 'test phone has no prior loyalty account')

  await earnPoints(cafeId, testPhone, 50, 'test-order-1') // 50 / 5 = 10 points
  const afterFirst = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone: testPhone } } })
  ok(afterFirst?.points === 10, 'earnPoints uses the configured rate (50 / 5 = 10 points)')
  ok(afterFirst?.lifetimePoints === 10, 'lifetimePoints incremented alongside points (bug fix verified)')

  console.log('\n── Tier crosses the configured Silver threshold ─────────')
  await earnPoints(cafeId, testPhone, 50, 'test-order-2') // +10 points = 20 total, threshold is 20
  const { getTierInfo } = await import('../src/loyalty/LoyaltyService')
  const tierInfo = await getTierInfo(cafeId, testPhone)
  ok(tierInfo.tier === 'SILVER', `tier is SILVER at the configured 20-point threshold (got ${tierInfo.tier})`)

  console.log('\n── Reward-eligibility event fires ───────────────────────')
  let eventFired = false
  eventBus.subscribe('LoyaltyRewardEligible', async (event: any) => {
    if (event.payload.metadata.phone === testPhone) eventFired = true
  })
  const { createReward } = await import('../src/loyalty/LoyaltyService')
  await createReward(cafeId, { name: 'Test Control Reward', pointsCost: 25 })
  await earnPoints(cafeId, testPhone, 50, 'test-order-3') // +10 = 30 total, crosses the 25-point reward
  await new Promise(r => setTimeout(r, 100)) // let the async event handler run
  ok(eventFired, 'LoyaltyRewardEligible event fires when crossing a reward threshold')

  console.log('\n── Public self-service profile ───────────────────────────')
  const { data: cafeRow } = { data: await prisma.cafe.findUnique({ where: { id: cafeId }, select: { subdomain: true } }) }
  const subdomain = cafeRow!.subdomain

  const { res: getProfileRes, data: profileData } = await json(`/api/public/loyalty/${subdomain}/${encodeURIComponent(testPhone)}`)
  ok(getProfileRes.status === 200, 'GET public loyalty profile → 200')
  ok(profileData.currentPoints === 30, 'public profile shows correct currentPoints')
  ok(profileData.tier === 'SILVER', 'public profile shows correct tier')

  const { res: patchProfileRes, data: patchedProfile } = await json(`/api/public/loyalty/${subdomain}/${encodeURIComponent(testPhone)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Control Test Customer', instagramHandle: '@controltest' }),
  })
  ok(patchProfileRes.status === 200, 'PATCH public loyalty profile → 200')
  ok(patchedProfile.customer.name === 'Control Test Customer', 'profile name saved')
  ok(patchedProfile.customer.instagramHandle === '@controltest', 'profile Instagram handle saved')

  console.log('\n── Cleanup ──────────────────────────────────────────────')
  await prisma.loyaltyAccount.deleteMany({ where: { cafeId, phone: testPhone } })
  await prisma.cafeCustomer.deleteMany({ where: { cafeId, phone: testPhone } })
  await prisma.loyaltyReward.deleteMany({ where: { cafeId, name: 'Test Control Reward' } })
  await prisma.cafe.update({
    where: { id: cafeId },
    data: {
      loyaltyPointsPerCurrency:   originalSettings.pointsPerCurrency,
      loyaltyTierSilverThreshold: originalSettings.silverThreshold,
      loyaltyTierGoldThreshold:   originalSettings.goldThreshold,
    },
  })
  console.log('  cleaned up test account, customer, reward, and reverted settings')

  console.log('\n── Summary ──────────────────────────────────────────────')
  console.log(`  ${passed} passed, ${failed} failed`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run it**

Run: `npm run dev`, then in another terminal `npx ts-node --transpile-only scripts/controlTestLoyalty.ts`
Expected: all assertions pass (`N passed, 0 failed`).

- [ ] **Step 3: Commit**

```bash
git add scripts/controlTestLoyalty.ts
git commit -m "test: add Loyalty Program integration control test"
```

---

## Task 12: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Re-run the backend integration script end-to-end**

Run: `npm run dev`, then `npx ts-node --transpile-only scripts/controlTestLoyalty.ts`
Expected: all assertions pass.

- [ ] **Step 2: Browser walkthrough — `/admin/loyalty`**

Open `/admin/loyalty`: confirm the Customers tab, Rewards tab, and new Settings tab all work. In Settings, change the points-per-currency and tier thresholds, save. Open a customer profile and confirm the tier badge reflects `lifetimePoints` against the newly-saved thresholds (not the old hardcoded 200/500/1000 Platinum scale). Test in at least Arabic and English to confirm every new string translates (no hardcoded French anywhere in the new Settings tab).

- [ ] **Step 3: Browser walkthrough — order completion → points → tier**

Place a real order through the client ordering flow with a `customerPhone` set, mark it completed (via `/pos` or `/kitchen` as appropriate for this restaurant's flow), then check `/admin/loyalty` for that phone — confirm points were awarded at the *configured* rate (not the old hardcoded 10 MAD/point) and that `lifetimePoints` moved (verifying Task 3's bug fix end-to-end, not just via the direct `earnPoints()` call in the test script).

- [ ] **Step 4: Browser walkthrough — customer self-service page**

Open `/<subdomain>/loyalty`, look up the phone from Step 3, confirm the real points/tier show, edit the name and social handles, save, reload, confirm they persisted.

- [ ] **Step 5: Reward eligibility notification (best-effort)**

If Evolution API (or whatever WhatsApp provider this repo uses) isn't configured in this dev environment, the `sendMessage()` call will no-op (status `SKIPPED`) rather than actually deliver — that's expected and already covered by Task 11's event-level assertion. If a provider IS configured, manually push a test account's points past a reward's `pointsCost` (via the admin redeem-reverse or a fresh order) and confirm a WhatsApp message actually arrives.

- [ ] **Step 6: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during Loyalty Program manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** Bug fix (Task 3). Configurable rate/thresholds (Tasks 2, 4, 8). Customer social-media profile (Tasks 1, 6, 9). Automatic WhatsApp notification (Tasks 2, 5). `CafeCustomer`↔`LoyaltyAccount` joined by phone only, no schema merge (Tasks 6, 9 both query by `(cafeId, phone)` independently). Explicitly out of scope per the design spec — automatic reward *redemption*, a notification audit log beyond existing events, bonus-multiplier/per-product point rules — none of these appear in any task above.
- **Placeholder scan:** no TBD/TODO markers. All find/replace blocks in Tasks 8–9 were written against the actual current file content (read in full while writing this plan, after discovering the static `REWARDS` array and missing tab UI), not assumed from the design spec's summary — every find block is exact.
- **Type consistency:** `getTier(lifetimePoints, silverThreshold, goldThreshold)` signature (Task 2) matches its two call sites in the same file (`earnPoints`, `getTierInfo`, both Task 2). `calculateEarnedPoints(totalPrice, pointsPerCurrency)` signature matches its only call site (`earnPoints`, Task 2) — `orders.ts` (Task 3) no longer calls it directly at all, which is the point of the fix. `LoyaltySettings` interface is defined once (Task 7 Step 2, module-level) and reused as-is by Task 9 (not redeclared) — matches the exact JSON shape returned by `GET /api/loyalty/settings` (Task 4) field-for-field. `LoyaltyRewardRow` interface (Task 8) matches the exact shape of items in the `rewards` array returned by `GET /api/loyalty/rewards` (pre-existing route, `id`/`name`/`description`/`pointsCost`/`isActive`). The public profile response shape used by `app/[subdomain]/loyalty/page.tsx`'s `ProfileData` interface (Task 10) matches `getTierInfo()`'s return shape plus the `customer` object exactly as constructed by the Task 6 route.
- **Scope note:** Task 8 (real Rewards catalog replacing the static array) was not in the original design spec — it was discovered while writing this plan (reading the actual admin page revealed no tab UI exists and the reward catalog was entirely disconnected from the backend). It's included because Task 2/5's WhatsApp reward-eligibility notification is non-functional without it (no admin-created `LoyaltyReward` rows would ever exist otherwise). This is the same category of finding a holistic review caught in the immediately-preceding Achats work — surfaced here during planning instead, before any code was written.
