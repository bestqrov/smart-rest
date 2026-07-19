# Traiteur (Catering & Events) — Architecture

## Purpose

The events/catering side of SmartRestau, for cafés and restaurants that also run weddings, corporate events, birthdays, and galas as a `TRAITEUR` business type. Separate data model from the regular table/order flow — an event is planned, staffed, priced, and closed independently of daily dine-in operations.

**Explicit non-goals:** No table/POS order flow (guests order from the regular restaurant menu on the day of the event, via the existing dine-in ordering system). No payment processing beyond deposit/quote tracking. No e-signature or legal contract generation.

---

## Module Location

```
app/admin/traiteur/
  page.tsx                 — Dashboard: stats, status filter tabs, event list
  events/new/page.tsx      — Event creation form
  events/[id]/page.tsx     — Event detail: guests / menu / services / cards / finance tabs

app/[subdomain]/event/[eventId]/page.tsx  — Public guest-facing page (QR scan → check-in → order)

src/routes/traiteur.ts     — All backend endpoints (single file, ~800 lines)
```

---

## Data Models (Prisma / MongoDB)

| Model           | Key Fields |
|------------------|------------|
| `Event`          | name, type (WEDDING\|CORPORATE\|BIRTHDAY\|REUNION\|GALA\|OTHER), date, venue, guestCount, status (DRAFT\|CONFIRMED\|ACTIVE\|COMPLETED\|CANCELLED), clientName/Phone/Email, quotedPrice, depositPaid, depositDate, actualAttendees, commissionAmount, menuPackageName, pricePerGuest |
| `Guest`          | name, phone, email, tableNumber, seatNumber, qrToken (unique), dietaryReq, checkedIn, checkedInAt, sessionId (links to `ClientSession`) |
| `EventMenuItem`  | eventId, category (STARTER\|MAIN\|DESSERT\|DRINK\|OTHER), name, description, order |
| `EventService`   | eventId, name (free text — décor, sound, DJ...), details, vendor, cost, status (NEEDED\|CONFIRMED\|DONE) |

All four models carry `cafeId` and are indexed on `[cafeId]`; `Event` is additionally indexed on `status` and `date`. No migration files — MongoDB schema changes sync via `prisma db push` on deploy (see `package.json` start script).

---

## API Routes (`src/routes/traiteur.ts`)

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/traiteur/events` | admin | List events for the cafe |
| `POST /api/traiteur/events` | admin | Create event (status defaults DRAFT) |
| `GET /api/traiteur/events/:id` | admin | Event detail incl. guests |
| `PATCH /api/traiteur/events/:id` | admin | Update any event field |
| `DELETE /api/traiteur/events/:id` | admin | Delete event + guests (transaction) |
| `GET/POST /api/traiteur/events/:id/guests` | admin | List / add a guest |
| `POST /api/traiteur/events/:id/guests/bulk` | admin | Import up to 500 guests |
| `DELETE /api/traiteur/events/:id/guests/:guestId` | admin | Remove a guest |
| `GET /api/traiteur/events/:id/menu` | admin | Package name, price/guest, courses |
| `PATCH /api/traiteur/events/:id/menu` | admin | Set package name / price per guest |
| `POST/PATCH/DELETE /api/traiteur/events/:id/menu/items[/:itemId]` | admin | Manage courses |
| `GET /api/traiteur/events/:id/services` | admin | List extra services |
| `POST/PATCH/DELETE /api/traiteur/events/:id/services[/:serviceId]` | admin | Manage extra services (décor/sound/DJ/...) |
| `GET /api/traiteur/events/:id/cards` | admin | Build QR place-card payload |
| `POST /api/traiteur/events/:id/guests/:guestId/checkin` | public (gate scanner) | Mark a guest checked in |
| `POST /api/traiteur/events/:id/guest-scan` | public | Guest scans QR → resumes/creates `ClientSession` on a synthetic `Table` → returns event info for the public page |
| `POST /api/traiteur/events/:id/close` | admin | Sets status COMPLETED, computes `actualAttendees` + `commissionAmount` |
| `GET /api/traiteur/stats` | admin | Dashboard aggregates |

Commission is computed by `calcCommission(country, attendees)` — per-country attendee-bracket rate tables with a per-event cap (MA/DZ/TN/EG/SA/AE/FR covered, `traiteur.ts:15-62`).

---

## Guest-Facing Flow

1. Admin generates QR place cards per guest (`.../cards` tab) — each QR encodes `https://{subdomain}.smartrestau.com/{subdomain}/event/{eventId}?guest={qrToken}`.
2. Guest scans → `POST .../guest-scan` auto-checks them in and creates a `ClientSession` tied to a `Table` record keyed by their assigned table number (reuses the restaurant's existing dine-in session infra rather than a bespoke event-ordering system).
3. The public page shows a welcome hero (name, seat, event name/date/venue) and embeds the **regular restaurant menu** for in-event ordering — not the event's `EventMenuItem` package, which is admin-facing planning only (not yet pushed to the guest view).

---

## Shipped So Far

- Event CRUD, guest list + bulk import, QR check-in cards, deposit/commission finance tab (original build).
- **Event menu packages** (`EventMenuItem`, commit `9ee1612`) — fixed package name + price/guest instead of relying on the à la carte menu.
- **Extra-services checklist** (`EventService`, commit `86a62d2`) — free-form décor/sound/DJ/etc. tracking with vendor, cost, and NEEDED→CONFIRMED→DONE status.

## Known Gaps (not yet built)

- No UI to edit core event fields after creation (name/date/venue/quotedPrice) — the `PATCH /api/traiteur/events/:id` route supports it but nothing calls it.
- No payment/installment schedule — only a single `quotedPrice` + `depositPaid`, no multi-tranche tracking.
- No task/checklist/timeline system (tasting date, décor deadline, final headcount cutoff).
- No staff assignment per event.
- No calendar/timeline view across all events (risk of double-booking a date).
- No guest invitations feature (create + send manually or via WhatsApp) — WhatsApp send infra already exists elsewhere in the repo (`src/routes/whatsappAdmin.ts`, `whatsappWebhook.ts`) and should be reused rather than rebuilt.
- The `EventMenuItem` package is admin-planning only — not yet surfaced on the guest-facing public page, which still shows the full restaurant menu.

Build order for these gaps should be picked one at a time with the user, not assumed.
