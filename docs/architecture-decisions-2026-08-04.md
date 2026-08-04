# Architecture Decisions — 2026-08-04

Two decisions requested before executing Quick Wins from the Product Discovery
Audit. No code changed in this document — findings only, backed by git
history and cross-file evidence.

---

## Decision 1 — QR Journey Architecture

### Verdict

**`app/[subdomain]/t/[tableNumber]` (+ its `s/[seatNumber]` variant) is the
official V2 customer journey. `app/[subdomain]/menu/page.tsx` is legacy.**

This was already established with URL-generation evidence in
`docs/qr-menu-duplicate-architecture-note.md` (`app/admin/tables/page.tsx`
is the only place in the repo that generates a customer-facing QR code, and
it always points to `/t/[tableNumber]`). This section adds the migration
plan requested.

### Capabilities that exist only on the legacy page

| Capability | Where it lives today | Used by |
|---|---|---|
| Reservation booking form | `menu/page.tsx:631-738`, posts to `POST /api/reservations` | Customer |
| Smart WiFi credentials card | `SmartWifiCard.tsx`, shown via `menu/page.tsx:796-800` | Customer |
| "Smart Resto Certified" badge | `CertifiedBadge.tsx`, `menu/page.tsx:504` | Customer (trust signal) |
| PWA service-worker registration | `menu/page.tsx:103-121` | Customer (install/offline shell) |
| Offline/LAN fallback ordering | `useOffline` + `useLocalRouter`/`smartPost`, `menu/page.tsx:143-146` | Customer (degraded connectivity) |

### Migration plan (port only — no business logic changes)

Each item below is independent and can ship as its own PR/commit, in this
order (lowest risk / highest value first):

1. **Certified badge** (Small) — pure presentational component, no state
   dependency beyond `certificationStatus` which `t/[tableNumber]` already
   receives from the same `/api/menu/public`-family endpoint. Copy the
   render call into the header of `t/[tableNumber]/page.tsx`.

2. **Smart WiFi card** (Small–Medium) — component itself has no
   `tableToken`-specific logic (takes `ssid`/`password`/`onClose` props).
   Needs: (a) confirm the WiFi-credentials fetch (`/api/menu/wifi` in the
   legacy page) accepts `sessionId`-based auth the same way `t/[tableNumber]`
   already authenticates its other calls, or add a session-scoped variant;
   (b) render after order confirmation, same spot the legacy page uses.

3. **Reservation booking form** (Medium) — the form itself is presentational
   and already uses `POST /api/reservations` with `tableToken`. The one real
   adaptation: `t/[tableNumber]` only holds a `sessionId` (not a raw
   `tableToken`) after scan. Either (a) have the session-scan response also
   return the table's `qrToken` so the reservation POST can still use it
   unchanged, or (b) add a session-scoped reservation endpoint. Confirm with
   backend which is preferred — this is the only step that touches an API
   shape decision, everything else is pure UI porting.

4. **PWA service worker + offline/LAN fallback** (Large, and a genuine
   product question, not just a port) — before porting, confirm whether any
   currently-active restaurant actually depends on LAN-only ordering
   (`useOffline`/`smartPost`). If yes, this needs real device testing per
   site, not just a code move — treat as its own project, not a quick win.

### After migration: what to do with the legacy route

Do **not** delete `menu/page.tsx` as part of the migration above. Once all
4 capabilities are ported and confirmed working on `t/[tableNumber]` in
production for at least one full service cycle, revisit deletion vs.
redirect. Reason to keep a redirect rather than hard-delete: any restaurant
with an old printed QR code/table-tent still pointing at `/menu?token=...`
would otherwise 404. A `menu/page.tsx` → `t/[tableNumber]` redirect (matching
`tableToken` → looking up the table → redirecting to the numbered URL) is
the safe end state, decided separately once porting is verified.

---

## Decision 2 — Staff Dashboard Architecture

### Evidence gathered

| File | Auth mechanism | Created | Last touched | Linked from admin? |
|---|---|---|---|---|
| `app/pos/page.tsx` | `posToken` (PIN via `/api/pos/shift`) | — | 2026-08-04 (today) | N/A — direct staff URL |
| `app/comptoir/page.tsx` | `posToken` (same) | — | 2026-08-04 (today) | N/A — direct staff URL |
| `app/waiter/page.tsx` | `posToken` (same, WAITER-role redirect from `/pos` login) | — | 2026-08-04 (today) | N/A — reached via `/pos` login redirect |
| `app/kitchen/page.tsx` | `posToken` (SUPERVISOR role) or admin `token` | — | recent | N/A — direct staff URL |
| `app/w/login` + `app/w/dashboard` | separate `waiterToken` (`/api/waiters/qr-login`, scanned from a rotating QR) | 2026-05-21 | `w/login`: 2026-06-27 · `w/dashboard`: **2026-05-21 only** | **Yes** — `app/admin/staff/page.tsx:235` and `app/admin/attendance/page.tsx:171` both actively generate `/w/login?token=` QR codes via `/api/admin/waiter-qr-token` |
| `app/supervisor/page.tsx` | separate `supervisorToken` (own PIN login, own `localStorage` namespace) | 2026-06-17 | 2026-06-17 only | **No** — zero references to `/supervisor` found anywhere in `app/admin/**` |

Key corroborating fact: `app/pos/page.tsx` redirects only the `WAITER` role
away (to `/waiter`) on login; `SUPERVISOR` and `CASHIER` both stay on `/pos`
normally (`app/pos/page.tsx:159,212,231`). So supervisors already use `/pos`
day-to-day today — there is no redirect anywhere that sends a supervisor to
`/supervisor`.

The commit that created `app/supervisor/page.tsx` (`bde98bd`, 2026-06-17)
also added order-taking to `app/waiter/page.tsx` in the *same commit* — i.e.
the team built both at once and then kept iterating only on `/waiter` (12
more commits since) while `/supervisor` was never touched again.

`app/w/dashboard/page.tsx`'s content overlaps substantially with
`app/waiter/page.tsx`'s "Alerts" tab (same three notification types — call
waiter / pay cash / pay TPE — same accept-then-remove pattern) but is a full
UI generation behind, still has the exact class of unhandled-failure bug
(`handleClockOut` doesn't check `res.ok`) that was fixed in `/waiter` this
session, and runs on a completely separate token system.

### Classification

| Screen | Classification | Why |
|---|---|---|
| `app/pos/page.tsx` | **Active** | Canonical cashier screen, actively developed. |
| `app/comptoir/page.tsx` | **Active** | Canonical counter-sale screen, actively developed. |
| `app/waiter/page.tsx` | **Active** | Canonical waiter screen — order-taking, alerts, team, today. Receives all current UX work. |
| `app/kitchen/page.tsx` | **Active** | Canonical KDS screen, actively developed. |
| `app/w/login` + `app/w/dashboard` | **Active (narrow) + Legacy (broad)** | The QR-scan-to-clock-in *mechanism* is genuinely active — two admin screens generate live rotating QR codes for it today. But the *dashboard content* (notification list, accept-order flow) is a stale, unmaintained duplicate of what `/waiter` now does better. Split verdict, see recommendation. |
| `app/supervisor/page.tsx` | **Dead code (in practice)** | No admin-side link/QR generator anywhere; its one distinguishing action (approve checkout) is already fully covered by `/pos`, which supervisors already use since login never redirects them elsewhere. Reachable only by someone who already knows the bare URL and has separately obtained a `supervisorToken` — no such credential-issuing UI was found either. |

### Recommended final architecture

1. **Keep `/pos`, `/comptoir`, `/waiter`, `/kitchen` as the four canonical
   operational screens**, unified under `posToken` auth with role-based
   redirect on login (already working as-is). No change needed.

2. **Keep the `/w/login` QR-scan mechanism for its actual job: attendance
   clock-in/out**, since it's live-wired from two admin screens today and
   attendance tracking is a real module (`app/admin/attendance`). Recommend
   (as a follow-up product decision, not part of this audit's quick wins):
   narrow `/w/dashboard` down to just clock-in/out + today's stats, and
   remove its duplicate notification/accept-order UI — that job already
   belongs to `/waiter`'s Alerts tab, which is better-maintained. This
   avoids two different screens racing to "accept" the same order
   notification with two different tokens.

3. **Retire `/supervisor`.** No live path reaches it. Before deleting:
   confirm with the team that no restaurant currently has a supervisor
   trained to use that specific URL/PIN (unlikely, given zero discovery
   path exists, but worth a one-line confirmation before removing code).
   Its "approve checkout" capability requires no replacement work — it's
   already available to supervisor-role staff via `/pos`.

Both retirement/narrowing actions above are **Product Decisions**, not
Quick Wins — they involve removing a currently-shippable (if confusing)
capability, which is a different risk profile than the additive Quick Wins
in the audit. Flagging them here for your call; no code touched.
