# Architecture Note: Two QR Customer-Facing Menu Implementations

**Date:** 2026-08-04
**Status:** Informational — no action taken, no code changed.
**Trigger:** Found while auditing the Reservation customer flow (`fd80c40`) — the
public `POST /api/reservations` endpoint turned out to be wired into
`app/[subdomain]/menu/page.tsx`, not the newer table-ordering page.

## The two implementations

| | `app/[subdomain]/t/[tableNumber]/page.tsx` (+ `s/[seatNumber]` variant) | `app/[subdomain]/menu/page.tsx` |
|---|---|---|
| Identity model | `POST /api/qr/scan` → `sessionId` + `seatNumber`, cached client-side | `tableToken` read directly from `?token=` query param |
| Menu fetch | session-scoped endpoints keyed off `sessionId` | `GET /api/menu/public?tableToken=` |
| Seat-level ordering | yes — dedicated `s/[seatNumber]` route, validated via `src/middleware/validateSeatQR.ts` | no seat concept |
| Realtime | socket.io | socket.io |
| Order tracker / live status | yes (`LiveOrderTracker`, floating card) | no — only an `orderSent` boolean |
| Welcome / thank-you splash | yes, animated | no |
| Reservation booking UI | not present | present (floating button + bottom sheet, wired to `POST /api/reservations`) |
| Offline / LAN fallback (`useOffline`, `smartPost`) | not present | present |
| PWA service worker registration | not present | present |

## Which one is primary

**`t/[tableNumber]` is the current, actually-generated customer entry point.**

Evidence: `app/admin/tables/page.tsx` is the *only* place in the repo that
generates a customer-facing QR code, and it builds the URL as:

```
${origin}/${sub}/t/${t.tableNumber}?token=${t.qrToken}
```

(`app/admin/tables/page.tsx:177`, with the same template shown as help text to
the restaurant owner at lines 396 and 642). Comments in that file state "ONE
QR per table (dynamic seat assignment on scan)".

## Which one is legacy/orphaned

**`menu/page.tsx` is not linked from anywhere in the app** — no admin QR
generator, no `<Link>`, no `router.push`, no WhatsApp/receipt template points
to `/{subdomain}/menu?token=...`. It is only reachable if someone has the URL
already (an old printed QR code from before `t/[tableNumber]` existed, a
bookmark, a manually-typed link). It still works end-to-end (menu browsing,
ordering, reservations, bill request) — it just isn't part of the flow any
new QR code produces.

Both files have been touched as recently as today, so git recency alone
doesn't distinguish them — the QR-generation evidence above is what settles it.

## Risks if merged later

- **Reservation booking has no home on the primary page.** The most direct
  "safe" merge is porting the reservation button + form from `menu/page.tsx`
  into `t/[tableNumber]/page.tsx` — but `t/[tableNumber]` only exists in a
  session context (`sessionId`, seat already assigned), so the reservation
  form's `tableToken`-based submission needs to be re-derived from the scan
  session rather than a raw query param. Low risk if done carefully, but not
  a copy-paste.
- **Offline/LAN fallback (`useOffline`, `smartPost`) exists only on the
  legacy page.** If `menu/page.tsx` is retired outright, that resilience
  path for LAN-only/degraded-connectivity restaurants disappears unless
  it's ported too — need to confirm whether any restaurant currently
  depends on it before deleting.
- **PWA service-worker registration** currently only happens on
  `menu/page.tsx`. If that page is the only one installing the SW, retiring
  it silently removes "add to home screen" / offline-shell behavior for
  customers, unless registration is moved to the primary page first.
- **Any bookmarked/printed QR codes still pointing at `/menu?token=...`**
  (old table tents, old marketing material, a restaurant that never
  reprinted QR codes after a prior migration) would break if the route is
  deleted rather than kept as a redirect.
- **Two menu-fetch API shapes** (`sessionId`-scoped vs raw `tableToken`)
  mean a merge isn't just UI — it's picking one identity model and either
  migrating the other page's callers or maintaining a compatibility shim.

## Recommendation for a future decision (not decided here)

Before merging or deleting: confirm (a) whether `useOffline`/LAN fallback and
PWA install are still required product capabilities, and if so port them to
`t/[tableNumber]` first; (b) whether any live restaurant's printed QR codes
still point at the old `/menu?token=` URL (if so, keep it as a redirect
rather than deleting outright).
