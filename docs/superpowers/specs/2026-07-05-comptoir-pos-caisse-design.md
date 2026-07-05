# Comptoir POS + Caisse (Cash Shift) — Design

**Date:** 2026-07-05
**Status:** Phase 1 of 3 (see Roadmap below)

## Context

SmartRestau currently has one staff-facing POS screen (`/pos`), built entirely
around **tables**: a staff member must select a table before they can build
an order. This matches restaurant/waiter service, but doesn't fit a
**counter/comptoir** sale — a walk-up customer ordering directly at the
register (coffee bar, takeaway counter), with no table involved.

This spec covers **Phase 1**: a new Comptoir POS screen, plus wiring the
existing (but unused) cash-shift reconciliation backend into the UI, shared
between `/pos` and the new `/comptoir`.

Two related features were identified during design but are **out of scope**
for this spec — see Roadmap.

## Roadmap (for context — not part of this spec)

1. **Phase 1 (this spec):** `/comptoir` page + Caisse de départ / Clôture UI.
2. **Phase 2:** `DEBITEUR` payment method (customer credit/tab, settled
   monthly) + new `app/admin/customers` page with an "Encaisser" action.
3. **Phase 3:** Automatic nightly cash report to the owner (23:30) +
   "Comptabilité" section in the admin dashboard.

## Goals (Phase 1)

- Let staff record a direct counter sale without picking a table.
- Every sale is tied to a mandatory customer record (`CafeCustomer`).
- Support two order types: **Emporter** (takeaway) and **Sur place** (dine-in,
  with an optional table pick — comptoir tables aren't reserved seating, just
  a place to bring the order to).
- Print an order ticket immediately on confirm — the shop assumed here has no
  kitchen display tablet; the printed ticket is what the staff carries to the
  customer along with the item.
- Introduce the "Caisse" concept already modeled in the backend
  (`CashierShift`) but never exposed in the UI: staff declare a starting cash
  float when they begin, and reconcile counted vs. expected cash when they
  end (clôture), shared across both `/pos` and `/comptoir` since a cafe has
  one physical register regardless of which screen is used.

## Non-goals (Phase 1)

- `DEBITEUR` payment / customer credit balances (Phase 2).
- Admin-facing customer list / CRM page (Phase 2).
- Automated nightly reports, accounting dashboard (Phase 3).
- Hotel "Chambres" service (separate, not yet designed).

## Architecture

### New page: `app/comptoir/page.tsx`

Client component, same auth model as `/pos` (staff logs in via
`POST /api/pos/shift`, same JWT). Layout:

```
┌─────────────────────────── Header ───────────────────────────┐
│ logo · cafe name · staff · clock          caisse status · logout │
├──────────┬──────────────────────────────┬─────────────────────┤
│          │                              │                     │
│ Left:    │  Center:                     │  Right:             │
│ category │  products of active category │  facture (cart)     │
│ list     │  grid, each with qty +/- like │  - line items,      │
│          │  the existing /pos grid       │    editable qty     │
│          │                              │  - running total     │
│          │                              │                     │
├──────────┴──────────────────────────────┴─────────────────────┤
│ Footer: [Client: search/select — required]                     │
│         [Order type: Emporter | Sur place (+ optional table)]  │
│         [Payment: Cash | Card]   [Confirmer & Imprimer]        │
└──────────────────────────────────────────────────────────────┘
```

This reuses the existing menu-fetch (`GET /api/pos/menu`) and product-card
pattern from `/pos`, just re-laid-out (categories move to a left rail instead
of a top strip, since there's no table strip to show).

### Order flow (single confirm action)

Comptoir sales are paid at the point of order (no open tab), unlike table
service. One button does it all:

1. Staff must have selected a `Client` (search existing `CafeCustomer` by
   name/phone, or quick-create one) before the confirm button is enabled.
2. Staff builds the cart, picks Order Type, picks Payment Method.
3. **"Confirmer & Imprimer"**:
   a. `POST /api/pos/orders` — creates the order (`tableId` set only if
      Sur place + table chosen, else `null`; `customerPhone` from selected
      client; new `orderType` field: `'TAKEAWAY'` or `'DINE_IN'`).
   b. `PATCH /api/pos/orders/:orderId/checkout` — immediately marks it paid
      (this endpoint already works without a `tableId`, no changes needed).
   c. Print the ticket client-side, reusing the existing `printReceipt`-style
      logic from `/pos` (80mm receipt layout) — shown/printed immediately so
      staff can carry it with the order.
4. On success: clear cart, deselect client, ready for the next sale.

### Caisse de départ / Clôture (shared: `/pos` + `/comptoir`)

Today `POST /api/pos/shift` already supports `action: 'open'` (takes
`initialCash`) and `action: 'close'` (auto-sums `CASH` + `isPaid` orders by
that staff member since shift start into `totalCollectedCash`) — this logic
exists but neither `/pos` nor the new `/comptoir` currently call `'open'` or
`'close'`; both just call `'login'`.

**Login gate (both pages):** after PIN login, check for an open shift
(`shift` returned by the `login`/`status` call):
- If none exists → show a **"Caisse de départ"** screen: staff enters the
  starting cash amount → `action: 'open'` → proceed into the POS/Comptoir UI.
- If one exists → proceed straight in (shift already open, e.g. staff
  switching between `/pos` and `/comptoir` mid-shift).

**Clôture (from either page's header):** a "Clôture" button opens a summary:
- Shows `initialCash` + live `totalCollectedCash` estimate (cash orders by
  this staff since `startTime`) = **montant attendu**.
- Staff enters **montant compté** (actual counted cash).
- Submits → `action: 'close'` with `countedCash` in the body.
- Backend computes `discrepancy = countedCash - (initialCash + totalCollectedCash)`
  and stores both on the `CashierShift` record, then closes it.
- Confirmation screen shows the écart (surplus/manque) to the staff.

This reconciliation data (`countedCash`, `discrepancy`) is what Phase 3's
nightly report and Comptabilité dashboard will read — not built in this
phase, but the fields are added now so nothing needs a later migration.

## Data model changes

```prisma
model CashierShift {
  // ...existing fields unchanged...
  countedCash  Float?  // staff-entered actual cash count at clôture
  discrepancy  Float?  // countedCash - (initialCash + totalCollectedCash)
}

model Order {
  // orderType already exists as String? — Phase 1 just starts populating it
  // from Comptoir ('TAKEAWAY' | 'DINE_IN'); no schema change needed.
}
```

## Backend changes

1. **`src/routes/pos/orders.ts`** — `POST /api/pos/orders`: accept and
   persist `orderType` from the request body (currently silently dropped).
2. **`src/routes/pos/shift.ts`** — `action: 'close'`: accept `countedCash`,
   compute and store `discrepancy` alongside the existing
   `totalCollectedCash` calculation.
3. **New: POS-scoped customer endpoints** (the existing `CustomerService`
   search/profile functions are only exposed via `authorizeAdmin` routes in
   `src/routes/customers.ts` — staff need their own, narrower access):
   - `GET /api/pos/customers?search=` — wraps `searchCustomers`, `authorizePOS`.
   - `POST /api/pos/customers` — quick-create `{ phone, name }`, `authorizePOS`,
     upsert-style like the existing `/api/customers/optin` logic.
4. No changes needed to `PATCH /api/pos/orders/:orderId/checkout` — it
   already operates on a single order id without requiring a `tableId`.

## Testing

- Unit: `orderType` persists on created orders; shift close computes
  `discrepancy` correctly for over/under/exact counts.
- Manual: full Comptoir flow (client select → cart → order type → payment →
  confirm → print) in the browser per this repo's `/verify` conventions;
  Caisse open/close flow from both `/pos` and `/comptoir` login paths.
