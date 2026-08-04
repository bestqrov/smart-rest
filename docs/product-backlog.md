# Product Backlog — recorded, not implemented

Logged per instruction during Sprint 2 (2026-08-04). These are Product
Decisions, not Quick Wins — they require a call from the team before any
code is written. No implementation here.

---

## 1. Marketplace backend entitlement enforcement (Security / Revenue Protection)

**Context:** Sprint 1 found that `marketplaceEnabled` (the flag gating the
Marketplace nav item) has zero server-side enforcement — grepped every file
in `src/routes/` for the flag, no route checks it. The nav item was the only
gate. Sprint 1 made the nav item visible-but-locked (matching the Inventory
pattern) rather than hidden, which is more honest about the feature's
existence but does not change the underlying fact: any authenticated admin
who knows or guesses the URL has always had full read/write access to the
Marketplace module regardless of whether their cafe is entitled to it.

**Decision needed:** If Marketplace is meant to be a paid/gated feature,
the entitlement check needs to move server-side (e.g. into the marketplace
route handlers or a shared middleware), not just the nav. If it's not
actually meant to be gated, the flag and lock badge should be removed
instead. Either way this is a backend/business-logic change, explicitly out
of scope for the UX-only work done so far.

---

## 2. Review automation workflow

**Context:** `docs/n8n-w1-reservation-whatsapp.json` documents an automatic
WhatsApp review-request (`/r/[reservationId]` link) meant to fire from
`src/routes/orders.ts` when an order hits `COMPLETED`. That handler only
awards loyalty points today — the webhook call was never wired in. The
receiving page (`app/r/[reservationId]/page.tsx`) and the review-ingestion
n8n workflow both already exist and work; only the trigger is missing.

**Decision needed:** Confirm the n8n endpoint documented is still the
intended channel (URLs/webhooks age; Twilio/WATI credentials may have
changed since this was designed) before wiring a live trigger into the
order-completion path. This is a backend change (new outbound call from
`orders.ts`), not a UI quick win.

---

## 3. Staff dashboard consolidation

**Context:** From the Staff Dashboard Architecture decision
(`docs/architecture-decisions-2026-08-04.md`): `/w/login` + `/w/dashboard`'s
QR-scan-to-clock-in mechanism is actively linked from two admin screens and
should stay, but its notification/accept-order UI duplicates `/waiter`'s
better-maintained Alerts tab on a separate `waiterToken` auth system.
`/supervisor` has no live discovery path anywhere and its one distinguishing
action (approve checkout) is already covered by `/pos`.

**Decision needed:** Confirm intent before any narrowing/retirement —
(a) should `/w/dashboard` be scoped down to just clock-in/out + stats, with
notifications removed in favor of `/waiter`; (b) can `/supervisor` be
retired outright, or does some restaurant have staff trained on that
specific URL/PIN today. Both are deletions/reductions of currently-shippable
surface area, a different risk profile than additive Quick Wins.
