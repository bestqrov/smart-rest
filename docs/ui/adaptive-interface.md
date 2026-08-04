# Adaptive Interface — Product & UX Design Standard

Status: **Official SmartRestau Adaptive Experience specification, approved 2026-08-04. No UI code implemented yet (Phase A schema only — commit `97cf0f9`).**

All future modules and capability-driven UI work must be designed against this document before implementation — it replaces case-by-case judgment calls about what to hide, lock, or suggest.

---

## 1. Initial Onboarding

No change from the previously approved onboarding proposal — restated here for completeness since this doc is the durable reference.

**Flow**: 6 existing wizard steps, unchanged in count. The capability questions live inside **Step 3 (Structure)**, directly under the zones/table-count inputs, as a single screen section — not a new step.

**Questions** (3 toggles, default ON):
- 🖥️ Kitchen Display → `kitchenDisplayEnabled`
- 📅 Reservations → `reservationsEnabled` (existing field, reused)
- 🎁 Loyalty program → `loyaltyEnabled`

**Not asked** — resolved without a question:
- QR Menu: always on, core capability, no flag.
- Delivery: no module exists yet, no flag in V1.
- Online payment: inferred later from whether `PaymentConfig` credentials are filled in (Settings → Payments), not an onboarding question.
- `takeawayOnlyMode`: **inferred**, not asked — if the restaurant configures `tableCount = 0` in the same Step 3, it is set `true` automatically; otherwise `false`. See dependency rule in §2.3.

**Timing target**: this section adds ~15-20 seconds to Step 3 (read 3 toggles + optionally flip one or two). Defaults are ON because most restaurants have all three capabilities, so the common path is zero taps.

**Mobile-first interaction**: toggles stacked vertically, one-line label each (icon + 2-3 words), no explanatory paragraph inline — a single optional "learn more" link opens detail on demand. Sticky "Next" button, no scroll needed on a standard phone viewport.

---

## 2. Adaptive Interface — per capability

For each capability, this section enumerates every UI surface found in the current codebase that must react to the flag. Surfaces marked **(gap)** don't exist yet but are called out so future work builds them flag-aware from day one instead of needing a follow-up audit.

### 2.1 Kitchen Display (`kitchenDisplayEnabled = false`)

| Surface | Where | Action |
|---|---|---|
| Quick-launch icon | `app/admin/layout.tsx:22-27` (`STAFF_LINKS`, rendered `:637`) | Hide the `ChefHat` / `kitchenKds` icon |
| `/kitchen` route | `app/kitchen/page.tsx` | Block direct navigation (redirect to dashboard with a one-line explanation, not a 404) |
| Dashboard kitchen widget | *(gap — none exists today; `app/admin/dashboard/page.tsx` has no kitchen card)* | Any future kitchen widget must gate on this flag at build time |
| Kitchen configuration screen | *(gap — no dedicated kitchen-settings section exists today)* | Same: gate at build time when it's built |
| Notifications | `src/services/kds.ts` emits `kds_new_order`/`kds_order_updated` over sockets only — no persisted `SystemNotification` row exists for kitchen today | No suppression code needed now (nothing listens if `/kitchen` is unreachable); if a persisted kitchen notification is added later, it must check this flag before creating the row |

### 2.2 Loyalty (`loyaltyEnabled = false`)

| Surface | Where | Action |
|---|---|---|
| Sidebar nav item | `app/admin/AdminSidebarNav.tsx:47` (growth group, `/admin/loyalty`) | Hide |
| Dashboard widget | *(gap — no loyalty card exists on `app/admin/dashboard/page.tsx` today)* | Future widget must gate on this flag |
| Quick actions | *(gap — no loyalty entry in `STAFF_LINKS` or a dashboard quick-actions grid exists today)* | Same |
| Customer-facing loyalty CTA | Wherever the QR menu surfaces a loyalty signup/points prompt | Hide |
| Notifications | `src/loyalty/LoyaltyService.ts` `earnPoints()`/`redeemPoints()` — confirmed zero notification/toast/socket plumbing exists today | Nothing to suppress now; any future "customer earned points" notification must gate on this flag |

### 2.3 Takeaway-only mode (`takeawayOnlyMode = true`)

| Surface | Where | Action |
|---|---|---|
| Table management page | `app/admin/tables/page.tsx` (QR generation, print-all, per-table cards) | Hide nav entry and block direct navigation — a takeaway-only restaurant has no physical tables to manage |
| POS table grid | `app/pos/page.tsx` (`TableColor` grid, `:694`, table selection required to confirm an order `:327,366,385,400,411`) | `/pos` is inherently table-centric with no takeaway mode — for takeaway-only cafes, the canonical staff screen becomes `/comptoir`, not `/pos`. Repoint the quick-launch "mini POS" icon accordingly. |
| Dine-in toggle in Comptoir | `app/comptoir/page.tsx:515-520` (`orderType: 'TAKEAWAY' \| 'DINE_IN'` buttons) | Hide the "Sur place" (dine-in) button, lock `orderType` to `'TAKEAWAY'` — this is the screen takeaway-only restaurants actually live in |
| Table assignment in Reservations | `app/admin/reservations/page.tsx:59,95,131,167,739` (`assignTable`, table number display) | Not directly reachable — see dependency rule below |

### Capability Dependency Matrix

Cross-flag effects are never hardcoded as one-off `if` statements scattered through the app. Every effect a capability has on *another* capability or surface is a row in this matrix. Adding a new capability means adding rows here, not inventing a new mechanism — the matrix is the single place that answers "what else changes when this flag flips."

| Trigger capability | Trigger state | Affected item | Effect |
|---|---|---|---|
| Takeaway Only | `true` | `reservationsEnabled` | Force **OFF** |
| Takeaway Only | `true` | Dine-in tables nav (`/admin/tables`) | **Hide** |
| Takeaway Only | `true` | Default staff quick-launch screen | **Set default** → `/comptoir` (instead of `/pos`) |
| Takeaway Only | `true` | Comptoir "Sur place" toggle | **Hide**, lock `orderType = 'TAKEAWAY'` |
| Kitchen Display | `false` | Kitchen nav / quick-launch icon | **Hide** |
| Kitchen Display | `false` | Kitchen configuration screen *(gap — not built yet)* | **Hide** once built |
| Kitchen Display | `false` | `/kitchen` route | **Block**, redirect with explanation |
| Loyalty | `false` | Loyalty nav item | **Hide** |
| Loyalty | `false` | Loyalty dashboard widgets *(gap — not built yet)* | **Hide** once built |
| Loyalty | `false` | Customer-facing loyalty CTA on QR menu | **Hide** |

Effect vocabulary is deliberately small and reused across every row:
- **Force OFF / Force ON** — the matrix overrides another capability's stored value. Always paired with a one-line explanation shown to the owner at the moment it happens (never a silent write).
- **Hide** — a nav item, route, or widget is removed from the interface entirely (§3: this is the "Hidden" state, applied here as a *consequence* of another flag rather than a direct onboarding answer).
- **Set default** — changes which screen/action the app routes to by default, without disabling anything else.
- **Block** — direct navigation to a URL is intercepted and redirected, for surfaces with no nav entry to simply hide (deep links, bookmarks).

Only one rule exists in the current flag set (Takeaway Only → Reservations off); the matrix format is what makes it trivial to add the next one (e.g. a future `deliveryEnabled` might one day force-hide a "dine-in" default) without re-deriving the reasoning from scratch each time.

---

## 3. Progressive Discovery — hidden vs. locked vs. suggested

Three states, chosen by **why** the capability is off, not by developer convenience:

| State | Use when | Why | Current precedent |
|---|---|---|---|
| **Hidden** | The owner explicitly declined a *free, self-serve* capability (any of the three onboarding toggles) | They made an informed "not now" — showing a locked nav item for something they can enable themselves for free is noise, not opportunity. A lock icon also wrongly implies a paywall that doesn't exist here. | New pattern for `kitchenDisplayEnabled`/`loyaltyEnabled`/`takeawayOnlyMode` |
| **Visible-but-locked** | The capability requires a purchase, superadmin approval, or plan tier the restaurant hasn't unlocked | The restaurant hasn't said no — they simply haven't upgraded yet. Keeping it visible (with a lock badge) is the discoverability mechanism that drives upgrades. | `isSmartInventoryEnabled` and `marketplaceEnabled` in `app/admin/AdminSidebarNav.tsx:141-171` — deliberately changed from fully-hidden to visible-but-locked in commit `15be894` for exactly this reason |
| **Contextual suggestion** | A capability is off (self-serve, not gated) but recent usage data suggests it would now help | Turns a declined toggle into a dismissible, time/behavior-triggered nudge instead of a permanent nav change — respects the original "no" while still surfacing genuinely relevant opportunities | Not yet built anywhere in the codebase — new pattern, see example below |

**Rule of thumb**: hidden = "you told us no, we believe you." Locked = "you haven't paid/qualified yet, here's what you're missing." Suggested = "you told us no, but your data changed — want to reconsider?"

### Contextual Suggestions — behavior signals, not generic prompts

A suggestion never fires on a timer or a generic "you might like this" heuristic. Each one is tied to an **observable, countable signal** in real usage data, with an explicit threshold and a message that states the specific benefit — not "try Loyalty!" but "you have 43 repeat customers this month." The system **only recommends — it never flips a flag itself.** Every suggestion ends in an owner tap, same as any other Feature Configuration change.

| Suggestion | Signal | Threshold (starting point, tune after launch) | Message shown | Data availability today |
|---|---|---|---|---|
| Suggest Loyalty | Repeat-customer count/rate over a rolling window | e.g. ≥20 distinct returning customers in 30 days | "You have N repeat customers this month — Loyalty could reward them and bring them back more often." | **Partial** — `CafeCustomer` (WhatsApp opt-in model) can identify returning customers by phone; needs a rolling-window aggregation query, not built today |
| Suggest Kitchen Display | Frequency of kitchen ticket prints / manual "mark as printed" actions | e.g. >15 print actions/day sustained over a week | "You're printing N kitchen tickets a day — a Kitchen Display screen could remove the paper step entirely." | **Gap** — no print-action is logged anywhere today; this signal needs new instrumentation before the suggestion can fire (flagged, not assumed to exist) |
| Suggest Reservations | Volume of manually-created reservations (phone/walk-in entry vs. self-serve) | e.g. ≥10 manually-entered reservations in a week | "Staff manually logged N phone reservations this week — turning on the Reservations button lets customers book themselves." | **Partial** — `app/admin/reservations` stores reservations, but whether a `source` field (phone vs. QR-menu-self-serve) exists needs confirming before this can be built |
| Suggest Smart Inventory | Volume/frequency of manual stock-adjustment actions | e.g. sustained manual inventory edits over N weeks | "You've logged N manual stock adjustments this month — Smart Inventory automates this." | Needs confirming against `src/routes/inventoryAdmin.ts` activity — likely available since inventory actions are already logged for the existing add-on, but the aggregation/threshold job doesn't exist yet |

**Design constraints that apply to every suggestion, no exceptions:**
1. **Never auto-enables anything.** The suggestion is a dismissible card/banner with a single "Turn on" action that routes to Feature Configuration (§4) — it never writes the flag itself as a side effect of being shown or even of being tapped-into-view.
2. **Dismissal is remembered per capability**, not per session — a dismissed suggestion doesn't reappear the next day nagging about the same signal; it may reappear later if the signal materially changes (e.g. doubles) or after a long cooldown (e.g. 90 days).
3. **One suggestion surfaced at a time.** If multiple thresholds are crossed simultaneously, rank by estimated impact and show the single most relevant one — a wall of nudges reads as pressure, not help.
4. **Every signal must be backed by a real, queryable data point before its suggestion ships** — the "Data availability today" column above is the acceptance gate for building each one; a suggestion whose signal can't actually be measured yet is not ready for Phase C, regardless of how good the idea is.

---

## 4. Settings → Feature Configuration

**Placement**: promote to its own settings tab rather than squeezing into the existing Profile tab. The current `TABS` array (`app/admin/settings/page.tsx:294-297`: profile / branding / password / staff) plus the hard-coded `payments` tab (`:327-332`) already shows the page outgrows a single "Profile" section once more than one or two toggles exist — and this doc's own §5 adds several more candidates over time. Add a sixth tab, `features`, after `staff`.

**Layout**, grouped by category (not a flat list):

```
Settings → Feature Configuration
────────────────────────────────
Service Style
  🪑 Dine-in tables        [ON/OFF]   "Manage table QR codes, floor
                                        plan, and reservations"
  🖥️ Kitchen Display        [ON/OFF]   "Kitchen queue screen and
                                        order-ready alerts"

Customer Engagement
  📅 Reservations           [ON/OFF]   "Reservation button on your
                                        QR menu" (auto-off if
                                        Dine-in tables is off — see §2.3)
  🎁 Loyalty program        [ON/OFF]   "Points and rewards for
                                        repeat customers"

Growth & Add-ons
  📦 Smart Inventory   [PRO — locked]  tap → upgrade/contact flow
  🛒 Marketplace       [PRO — locked]  tap → upgrade/contact flow
```

Each row reuses the exact pattern already shipped for `reservationsEnabled` (`app/admin/settings/page.tsx:468-491`): icon + label + one-line consequence + switch. Locked rows reuse the amber "PRO" + lock-icon badge already shipped for Inventory/Marketplace nav items (`AdminSidebarNav.tsx:141-171`) rather than inventing a new visual language.

**No onboarding repeat**: every toggle here writes to the same `Cafe` fields the onboarding wizard writes to (`PATCH` through the existing cafe-profile endpoint pattern, `src/routes/menuAdmin.ts` ~`:182-230`). Turning a capability back on is a single switch flip — the owner never re-enters the onboarding wizard.

**No restart requirement**: saving a Feature Configuration change must never require restarting the app, redeploying, or the owner logging out and back in. The interface adapts on the very next render after save — concretely: (1) the save call updates the `Cafe` row directly, no queued/batched job; (2) the admin client re-fetches or locally updates its cached cafe-profile state immediately after a successful save, rather than relying on a stale value already in memory (this is the one implementation trap to watch for — flags read once into client state at page load and never refreshed would silently violate this rule even though the backend is instant); (3) nav items, quick-launch icons, and blocked routes must all read from that same up-to-date state, not a value cached at an earlier point in the session.

---

## 5. Future Growth — fitting new capabilities into the same system

| Future capability | Fits as | Notes |
|---|---|---|
| Smart Inventory | Existing boolean, already shipped (`isSmartInventoryEnabled`) | Already following this system — visible-but-locked, superadmin-approved. No change needed, cited here as the precedent the whole model is built from. |
| Smart Marketing | New boolean (`marketingEnabled` or similar), Growth & Add-ons group | Same shape as Inventory — add/paid module, visible-but-locked by default. |
| Marketplace | Existing flag, already shipped (`marketplaceEnabled`, superadmin-set) | Already visible-but-locked per commit `15be894`; slot directly into the Growth & Add-ons group in §4. |
| AI Assistant | New boolean, Growth & Add-ons, **also a strong Contextual Suggestion candidate** | Unlike Inventory/Marketplace, a trial/nudge triggered by usage depth (e.g. "you've processed 500 orders — try the AI assistant") fits §3's third bucket better than a static locked row alone. |
| Hotel (vertical) | **Not a capability boolean** | This changes *what kind of business* the account is, not a feature toggle on top of an existing restaurant — same category as the existing `tier` (CAFE/RESTAURANT) and `accountMode` (RESTAURANT/TRAITEUR) fields. Needs its own product/data-model decision (new `accountMode` value or a parallel vertical field), not a `Cafe` boolean. Flagging the distinction now so it isn't miscategorized later. |
| Multi-Branch | **Not a capability boolean** | This is an org-structure change (one owner account controlling multiple `Cafe` records) rather than a behavior toggle on a single `Cafe`. It belongs to a future multi-tenant/organization data model question, separate from this capability-flag system. Flagging the distinction now for the same reason. |

**Why the split matters**: §2-4 of this document only govern capabilities that change *what a single restaurant's interface shows*, modeled as `Cafe` booleans per the architecture rule in `docs/ARCHITECTURE.md` ("Key Design Decisions"). Hotel and Multi-Branch are structural/vertical decisions, not interface toggles — forcing them into a boolean would violate that same architecture rule (capabilities vs. business-model changes are different things). When those are designed, they need their own proposal; this document's hidden/locked/suggested framework and the Feature Configuration page layout are still the right *place* to surface them once the underlying model exists, just not as a plain on/off switch.

---

## Open questions for implementation (Phase B, not started)

1. Confirm whether the customer-facing loyalty CTA referenced in §2.2 currently exists on the QR menu at all, or needs to be built — the research pass for this doc did not locate one explicitly.
2. Confirm the exact redirect/empty-state copy for blocked routes (`/kitchen`, `/admin/tables` when hidden) — should read as "not needed for your setup," not an error.
3. Decide whether `takeawayOnlyMode`'s auto-off of `reservationsEnabled` (§2.3) needs a confirmation dialog or is silent-with-explanation.
