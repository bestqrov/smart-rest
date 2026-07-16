# Smart Tier Pricing — Design Spec

**Date:** 2026-07-04
**Status:** Approved by user, pending implementation plan

## Context

SmartRestau's landing page (`app/landing/page.tsx`) currently sells access via a
**per-order commission model** (`MARKETS` array, section `#pricing`): a fee per
completed order that varies by order-size bracket and country, plus a
per-country flat "Premium" no-commission price (199 MAD / 159 SAR / 159 AED /
159 EUR / 13 000 XOF).

The user has decided to introduce a **second, primary pricing structure**:
three flat monthly subscription tiers (Smart Start / Smart Growth / Smart
Elite), sold in Moroccan dirhams (MAD) as the baseline, with a ×4 multiplier
for Gulf and Europe markets. This is an *addition* alongside the existing
commission model — the commission section is not removed.

There is an existing `BillingPlan` Prisma model (`prisma/schema.prisma:2652`)
and `src/billing/plans/` service layer (Sprint K1), plus a DB-backed
subscription engine (Sprint K2/K3, built in the
`.claude/worktrees/sprint-k2-subscription-engine` branch, not yet merged to
`main`) expecting plan codes like `FREE`/`STARTER`. No `BillingPlan` rows are
currently seeded — this is a clean slate for the 3 new tiers.

This work is a user-authorized exception to the [[project-v1-freeze]] CTO
directive (see `project_v1_freeze_exceptions.md`), same pattern as prior
exceptions — the user is directly requesting it in-session.

## Scope for this round

**In scope:**
- 3 `BillingPlan` rows (Smart Start 499 / Smart Growth 899 / Smart Elite
  1499 DH) with feature bullets, badge tier, and region price multipliers
- New `BillingAddon` model + 6 seeded one-time services
- Region-aware price display (×4 for Gulf/Europe, converted to local
  currency for display)
- Landing page: new tier-pricing section (cards + addon table), added
  alongside the existing commission-pricing section
- Superadmin `billing/plans` page: extended to show/edit the new fields

**Out of scope (explicitly deferred):**
- Checkout / payment flow for these tiers
- Feature-gating / enforcement (a plan's booleans/features are descriptive
  only, nothing blocks usage based on tier yet)
- Removing or modifying the existing commission-based pricing model
- Real-time FX rates (static conversion constants only)
- Actually linking the K2/K3 subscription engine's lifecycle to these 3
  plans (that engine already exists in a separate branch; wiring it up is
  future work)

## Data Model Changes

### 1. Extend `BillingPlan` (prisma/schema.prisma)

Add three fields to the existing model:

```prisma
model BillingPlan {
  // ...existing fields unchanged...
  regionMultipliers Json?   // e.g. {"GULF": 4, "EUROPE": 4} — absent region = ×1
  badgeTier         String? // "VERIFIED" | "PREMIUM" | "ELITE"
  features          Json?   // ordered list of {ar, fr, en} bullet strings
}
```

Rationale: the pricing copy the user gave is free-text bullets ("🚀 إنشاء
منشورات بالذكاء الاصطناعي") that don't map cleanly onto the existing boolean
flags (`marketplaceEnabled`, `automationEnabled`, etc.) — those booleans stay
for potential future enforcement, `features` is purely for display ordering
and copy.

`regionMultipliers` is a flat multiplier keyed by region code, not a currency
code — currency conversion for display is a separate static lookup (below),
kept independent so the multiplier only ever expresses "how many times the
MAD baseline this region pays."

### 2. New `BillingAddon` model

```prisma
model BillingAddon {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  code              String   @unique
  name              String
  description       String?
  priceMAD          Float
  regionMultipliers Json?
  isActive          Boolean  @default(true)
  displayOrder      Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([isActive])
  @@index([displayOrder])
  @@map("billing_addons")
}
```

Mirrors `BillingPlan`'s pricing shape (`priceMAD` + `regionMultipliers`) for
consistency — one-time services scale with region the same way subscription
plans do.

### 3. Seed data

**3 `BillingPlan` rows** (MAD baseline, `regionMultipliers: {"GULF": 4, "EUROPE": 4}`):

| code | name | monthlyPrice | badgeTier | features (ar) |
|---|---|---|---|---|
| `SMART_START` | Smart Start | 499 | VERIFIED | منيو QR، إدارة طاولات، حجوزات، إدارة طلبات، شاشة مطبخ، لوحة مبيعات، إحصائيات أساسية، تحديثات مجانية |
| `SMART_GROWTH` | Smart Growth | 899 | PREMIUM | كل مزايا Start + منشورات AI، فيديوهات قصيرة، نشر تلقائي (FB/IG/TikTok)، حملات Email، عروض WhatsApp، نظام ولاء، Marketplace، تقارير متقدمة |
| `SMART_ELITE` | Smart Elite | 1499 | ELITE | كل مزايا Growth + عدة فروع، مساعد AI، فيديوهات أكثر، حملات غير محدودة (Fair Use)، أولوية دعم |

`SMART_GROWTH` marked `isDefault: true` (used by the landing page to render
the "الأكثر اختياراً" ribbon — reusing the existing field rather than adding
a new one).

**6 `BillingAddon` rows:**

| code | name (ar) | priceMAD |
|---|---|---|
| `PLATFORM_SETUP` | إعداد المنصة لأول مرة | 490 |
| `MENU_ENTRY_80` | إدخال المنيو (حتى 80 منتج) | 290 |
| `TEAM_CONFIG_REMOTE` | تكوين الفريق (عن بعد) | 390 |
| `QR_DESIGN_PRO` | تصميم QR احترافي | 190 |
| `DATA_IMPORT` | استيراد البيانات | 190 |
| `SOCIAL_SETUP` | إعداد صفحات التواصل الاجتماعي | 390 |
| `MARKETING_CONSULT_1H` | جلسة استشارية للتسويق (1 ساعة) | 290 |

(7 rows — the user's table had 7 optional services; correcting the "6" count
from the design summary.)

## Region & Currency Resolution

A shared helper, `resolvePlanPrice(plan | addon, region)`:

```ts
type Region = 'MAD' | 'GULF' | 'EUROPE' // extend later if needed

const FX_FROM_MAD: Record<string, number> = {
  MAD: 1,
  SAR: 0.375,
  AED: 0.367,
  EUR: 0.093,
}

const REGION_DISPLAY_CURRENCY: Record<Region, keyof typeof FX_FROM_MAD> = {
  MAD: 'MAD',
  GULF: 'SAR',   // Gulf display currency choice — SAR as representative
  EUROPE: 'EUR',
}

function resolvePlanPrice(basePriceMAD: number, regionMultipliers: Record<string, number> | null, region: Region) {
  const multiplier = regionMultipliers?.[region] ?? 1
  const priceMAD = basePriceMAD * multiplier
  const currency = REGION_DISPLAY_CURRENCY[region]
  const displayPrice = region === 'MAD' ? priceMAD : Math.round(priceMAD * FX_FROM_MAD[currency])
  return { priceMAD, currency, displayPrice }
}
```

This lives in `src/billing/plans/` (new file `PlanPricing.ts`) so both the
landing page data source and the superadmin plans page import the same
logic — no duplicated pricing math.

Note: FX rates are static display constants, not live rates. Acceptable
because there is no real checkout yet (out of scope, see above).

## Landing Page Changes (`app/landing/page.tsx`)

- New section added **after** the existing `#pricing` (commission) section,
  its own anchor (e.g. `#subscription-plans`), reachable from the same nav
  bar area — does not replace or alter the existing `MARKETS` commission
  section.
- 3 cards (Start / Growth / Elite), each showing: badge ribbon, price in the
  page's active language/region context, ✅ bullet feature list from
  `features` JSON, CTA button to `/signup`.
- Growth card gets a highlighted border/ribbon ("⭐ الأكثر اختياراً") driven
  by `isDefault`.
- Below the cards: a compact table of the 7 one-time `BillingAddon` services
  with region-adjusted prices.
- Region selection reuses whatever region/language switching mechanism
  already exists on the landing page (the `MARKETS` section implies a
  per-country context already) — if no explicit region selector exists yet,
  default region resolves from the page's current language (`ar/fr` → MAD,
  unless a country selector is added — implementation plan will confirm
  exact wiring after reading the current language/region state management
  in the file).

## Superadmin UI (`app/superadmin/billing/plans/page.tsx`)

- Extend the existing plan table/form to show and edit: `regionMultipliers`
  (simple key-value inputs for GULF/EUROPE), `badgeTier` (select), `features`
  (list editor, ar/fr/en per bullet).
- New addon management: either a new `app/superadmin/billing/addons/page.tsx`
  page, or a tab within the existing plans page — implementation plan will
  decide based on how much reuse is possible from the plans page's existing
  table/form patterns.

## Backend Service Changes

- `PlanTypes.ts`: add `regionMultipliers`, `badgeTier`, `features` to
  `BillingPlan`/`CreatePlanInput`/`UpdatePlanInput`.
- `PlanRepository.ts`: persist/read the 3 new fields (stored as Prisma `Json`).
- New `src/billing/addons/` module (mirrors `src/billing/plans/` structure):
  `AddonTypes.ts`, `AddonRepository.ts`, `AddonService.ts` — CRUD only, no
  lifecycle/events (these are one-time, not recurring).
- New `src/billing/plans/PlanPricing.ts`: the `resolvePlanPrice` helper above.
- Superadmin API: extend existing plan endpoints to accept new fields; add
  CRUD endpoints for addons (`/api/superadmin/billing/addons`, following the
  same auth pattern as `billingSubscriptionsSA.ts`).

## Non-Goals / Explicit Deferrals

- No changes to `src/billing/subscriptions/*` (K2/K3 engine) — that engine's
  plan linkage is future work.
- No payment gateway integration for these 3 tiers.
- No enforcement: a cafe's actual feature access is unaffected by which tier
  row exists in the DB — this is descriptive/marketing data for now.
- Commission-based `MARKETS` pricing section stays exactly as-is.
