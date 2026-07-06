# Loyalty Program — Configurability, Customer Profile & Auto-Notification — Design Spec

> Next module in the established V1 priority order (Reservations → **Loyalty** →
> Marketing → Social, per memory `project-v1-progress`) — not a freeze exception.

## Problem

A substantial Loyalty Program already exists from a prior session: `LoyaltyAccount`
(points + append-only ledger), `LoyaltyReward` (admin-defined reward catalog),
membership tiers (Bronze/Silver/Gold), a full REST API
(`src/routes/loyalty.ts`), a service layer (`src/loyalty/LoyaltyService.ts`),
and a complete 4-language admin page (`app/admin/loyalty/page.tsx`) with
customer list, profile/ledger view, and manual redemption.

Three things are missing relative to what the user wants, and one real bug
was found during investigation:

1. **Bug**: `src/routes/orders.ts`'s order-completion handler awards loyalty
   points with its own inline copy of the earning logic (`Math.floor(totalPrice
   / 10)`) instead of calling `LoyaltyService.earnPoints()`. It never
   increments `lifetimePoints`, so a customer's membership tier can never
   advance past Bronze even as they earn and spend points.
2. **Not configurable**: the earning rate (10 currency units = 1 point) and
   the Silver/Gold tier thresholds (500 / 2000 lifetime points) are hardcoded
   constants, not something a gérant can adjust per restaurant.
3. **No customer-facing profile**: `LoyaltyAccount` has only `phone` +
   `points` — no name, no social media handles. It is also entirely
   disconnected from the existing `CafeCustomer` model (added in a prior
   WhatsApp re-engagement session), which already has `phone`/`name`/`tags`/
   `notes`/WhatsApp `optIn` but no social media fields either.
4. **No automatic reward notification**: rewards today are only redeemed
   manually by an admin/cashier at checkout. There's no signal to the
   customer that they've become eligible for something.

## Goals (this round)

1. Fix the `orders.ts` bug by routing through `LoyaltyService.earnPoints()`.
2. Make the earning rate and tier thresholds configurable per cafe, via new
   fields directly on the `Cafe` model and a new settings tab in the
   existing `/admin/loyalty` page.
3. Add social media fields (`instagramHandle`, `facebookHandle`,
   `tiktokHandle`) to `CafeCustomer`, and a new customer-facing self-service
   page where a customer can look up their points/tier by phone and update
   their name + social handles. `CafeCustomer` and `LoyaltyAccount` remain
   two separate models, joined by `phone` wherever both are needed — no
   schema merge.
4. Send an automatic WhatsApp notification (reusing the existing
   `sendMessage()` in `src/whatsapp/WhatsAppEngine.ts`, no new template
   system) when a customer's points balance newly crosses the `pointsCost`
   of an active `LoyaltyReward`, gated on `CafeCustomer.optIn === true`.

## Explicitly out of scope (not addressed this round)

- Automatic reward *redemption* (the notification tells the customer they're
  eligible; an admin/cashier still manually redeems it, exactly as today).
- A reward-notification history/audit log beyond the existing
  `LoyaltyPointsEarned`/`LoyaltyTierChanged` event stream.
- Any change to how points are calculated from an order beyond making the
  rate configurable (no bonus multipliers, no per-product point rules).

## Data model changes (`prisma/schema.prisma`)

- `Cafe` gains:
  - `loyaltyPointsPerCurrency Float @default(10)` — currency units required
    to earn 1 point (e.g. `10` means "10 MAD = 1 point").
  - `loyaltyTierSilverThreshold Int @default(500)`.
  - `loyaltyTierGoldThreshold Int @default(2000)`.
- `CafeCustomer` gains (all optional, additive):
  - `instagramHandle String?`
  - `facebookHandle String?`
  - `tiktokHandle String?`

All new fields are optional or have sensible defaults matching today's
hardcoded behavior — no breaking change, no migration needed for existing
cafes.

## Backend changes

### Bug fix + configurable earning/tiers (`src/loyalty/LoyaltyService.ts`)

- `calculateEarnedPoints(totalPrice, pointsPerCurrency)` takes the rate as a
  parameter instead of a hardcoded `10`.
- `getTier(lifetimePoints, silverThreshold, goldThreshold)` takes the two
  thresholds as parameters instead of the hardcoded `TIER_THRESHOLDS` array.
- `earnPoints()` and `getTierInfo()` load the cafe's three loyalty fields
  (one extra `prisma.cafe.findUnique` call, or accept them as an
  already-fetched param where the caller already has the cafe loaded) and
  pass them through.
- `src/routes/orders.ts`'s order-completion handler replaces its inline
  point-awarding block with a call to `LoyaltyService.earnPoints(cafeId,
  order.customerPhone, order.totalPrice, orderId)`, inside the same
  transaction. This fixes the `lifetimePoints` bug and removes the
  duplicated logic.

### Configurable settings API

- `GET /api/admin/loyalty/settings` and `PATCH /api/admin/loyalty/settings`
  (new routes in `src/routes/loyalty.ts`) read/write the three `Cafe`
  fields, validated (`loyaltyPointsPerCurrency > 0`, thresholds positive
  integers, `gold > silver`).

### Customer profile (self-service)

- New public routes (no admin auth — same trust model as the existing
  WhatsApp opt-in popup, which already writes to `CafeCustomer` from an
  unauthenticated customer-facing page):
  - `GET /api/public/loyalty/:subdomain/:phone` — returns
    `{ points, tier, nextTier, customer: { name, instagramHandle,
    facebookHandle, tiktokHandle } }` by joining `LoyaltyAccount` and
    `CafeCustomer` on `(cafeId, phone)`. Returns zeroed/empty defaults if no
    `LoyaltyAccount` exists yet for that phone (mirrors the existing `GET
    /api/loyalty/:phone` admin route's "not found → zero balance" pattern).
  - `PATCH /api/public/loyalty/:subdomain/:phone` — upserts the `name`/
    `instagramHandle`/`facebookHandle`/`tiktokHandle` fields on
    `CafeCustomer` (same upsert-by-phone pattern already used by the
    WhatsApp opt-in flow).

### Automatic WhatsApp reward notification

- In `LoyaltyService.earnPoints()`, after updating the account, compare
  `before.points` and `updated.points` against every active `LoyaltyReward`
  for the cafe: a reward is "newly eligible" when `before.points <
  reward.pointsCost <= updated.points`.
- If any newly-eligible rewards exist AND the `CafeCustomer` for that phone
  has `optIn === true`, call `sendMessage()` from
  `src/whatsapp/WhatsAppEngine.ts` with a message listing the reward(s)
  (single message if multiple rewards became eligible at once — no spam of
  one message per reward).
- Publish a `LoyaltyRewardEligible` event (matching the existing
  `LoyaltyPointsEarned`/`LoyaltyTierChanged` pattern) so this stays
  observable through the existing event stream, independent of whether the
  WhatsApp send succeeds.

## Frontend changes

### `/admin/loyalty` — new "Settings" tab

- Alongside the existing "Customers" and "Rewards" tabs: a third tab with a
  simple form (points-per-currency, Silver threshold, Gold threshold),
  following the same i18n (`T[lang]`) and form patterns already used
  elsewhere on this page.

### New customer-facing page: `app/[subdomain]/loyalty/page.tsx`

- Public, unauthenticated (matches the client ordering pages' trust model).
- Phone-number lookup form → shows points balance, tier, progress to next
  tier, and an editable name + 3 social-handle fields, saved via the new
  `PATCH /api/public/loyalty/:subdomain/:phone` route.
- 4-language i18n from the start (this session's own review found hardcoded
  French to be the single most common defect across new admin pages this
  week — this page follows the established `T[lang]` convention from day
  one).

## Testing approach

Per this repo's convention (no Jest/Vitest): a `scripts/controlTestLoyalty.ts`
integration script covering: configurable earning rate changes the points
awarded on order completion; `lifetimePoints` now advances tiers correctly
through the fixed `orders.ts` path; the public profile GET/PATCH round-trip;
and the auto-notification firing (and *not* firing when `optIn` is false) when
crossing a reward threshold.
