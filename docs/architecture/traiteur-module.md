# Traiteur (Catering & Events) — Architecture

## Purpose

The events/catering side of SmartRestau, for cafés and restaurants that also run weddings, corporate events, birthdays, and galas as a `TRAITEUR` business type. Separate data model from the regular table/order flow — an event is planned, staffed, priced, and closed independently of daily dine-in operations.

**Explicit non-goals:** No table/POS order flow (guests order from the regular restaurant menu on the day of the event, via the existing dine-in ordering system). No payment processing beyond deposit/installment tracking (no card capture, no invoicing). No e-signature or legal contract generation.

---

## Module Location

```
app/admin/traiteur/
  page.tsx                 — Dashboard: stats, list/calendar toggle, status filter tabs, event list
  events/new/page.tsx      — Event creation form
  events/[id]/page.tsx     — Event detail: guests / menu / services / payments / tasks /
                              staff / invitations / cards / finance tabs

app/[subdomain]/event/[eventId]/page.tsx  — Public guest-facing page (QR scan → check-in → order)

src/routes/traiteur.ts     — All backend endpoints (single file, ~1050 lines)
```

---

## Data Models (Prisma / MongoDB)

| Model                   | Key Fields |
|--------------------------|------------|
| `Event`                  | name, type (WEDDING\|CORPORATE\|BIRTHDAY\|REUNION\|GALA\|OTHER), date, venue, guestCount, status (DRAFT\|CONFIRMED\|ACTIVE\|COMPLETED\|CANCELLED), clientName/Phone/Email, quotedPrice, depositPaid, depositDate, actualAttendees, commissionAmount, menuPackageName, pricePerGuest, invitationMessage |
| `Guest`                  | name, phone, email, tableNumber, seatNumber, qrToken (unique), dietaryReq, checkedIn, checkedInAt, invitationSentAt, sessionId (links to `ClientSession`) |
| `EventMenuItem`          | eventId, category (STARTER\|MAIN\|DESSERT\|DRINK\|OTHER), name, description, order |
| `EventService`           | eventId, name (free text — décor, sound, DJ...), details, vendor, cost, status (NEEDED\|CONFIRMED\|DONE) |
| `EventPayment`           | eventId, label (free text), amount, dueDate, paidDate, method, status (PENDING\|PAID) |
| `EventTask`              | eventId, title, dueDate, done, doneAt, order |
| `EventStaffAssignment`   | eventId, staffId (→ `Staff`), role (free text, per-event override), notes |

All models carry `cafeId` and are indexed on `[cafeId]`; `Event` is additionally indexed on `status` and `date`; `EventStaffAssignment` also on `staffId`. No migration files — MongoDB schema changes sync via `prisma db push` on deploy (see `package.json` start script).

---

## API Routes (`src/routes/traiteur.ts`)

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/traiteur/events` | admin | List events for the cafe |
| `POST /api/traiteur/events` | admin | Create event (status defaults DRAFT) |
| `GET /api/traiteur/events/:id` | admin | Event detail incl. guests |
| `PATCH /api/traiteur/events/:id` | admin | Update any event field (wired to the edit modal) |
| `DELETE /api/traiteur/events/:id` | admin | Delete event + guests (transaction) |
| `GET/POST /api/traiteur/events/:id/guests` | admin | List / add a guest |
| `POST /api/traiteur/events/:id/guests/bulk` | admin | Import up to 500 guests |
| `DELETE /api/traiteur/events/:id/guests/:guestId` | admin | Remove a guest |
| `GET /api/traiteur/events/:id/menu` | admin | Package name, price/guest, courses |
| `PATCH /api/traiteur/events/:id/menu` | admin | Set package name / price per guest |
| `POST/PATCH/DELETE /api/traiteur/events/:id/menu/items[/:itemId]` | admin | Manage courses |
| `GET /api/traiteur/events/:id/services` | admin | List extra services |
| `POST/PATCH/DELETE /api/traiteur/events/:id/services[/:serviceId]` | admin | Manage extra services (décor/sound/DJ/...) |
| `GET/POST /api/traiteur/events/:id/payments` | admin | List / add a payment installment |
| `PATCH/DELETE /api/traiteur/events/:id/payments/:paymentId` | admin | Edit, mark paid, or remove an installment |
| `GET/POST /api/traiteur/events/:id/tasks` | admin | List / add a checklist item |
| `PATCH/DELETE /api/traiteur/events/:id/tasks/:taskId` | admin | Toggle done, edit, or remove a task |
| `GET /api/traiteur/events/:id/staff` | admin | Staff assigned to this event |
| `GET /api/traiteur/events/:id/staff/available` | admin | Active cafe staff not yet assigned |
| `POST /api/traiteur/events/:id/staff` | admin | Assign a staff member (409 if already assigned) |
| `DELETE /api/traiteur/events/:id/staff/:assignmentId` | admin | Unassign |
| `PATCH /api/traiteur/events/:id/invitation-template` | admin | Save the invitation message template |
| `POST /api/traiteur/events/:id/guests/:guestId/invitation-sent` | admin | Mark a guest's invitation sent (manual wa.me flow) |
| `POST /api/traiteur/events/:id/invitations/send` | admin | Bulk-send via `WhatsAppEngine`, per-guest try/catch |
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

## Invitations — Two Send Paths

- **Manual** (`waLink()` in the events/[id] page): builds a `https://wa.me/{phone}?text=...` deep link per guest with the template rendered client-side. No integration dependency — opens WhatsApp (app or web) with the message prefilled, admin taps send. Marked sent client-side on click.
- **Bulk automated** (`POST .../invitations/send`): loops guests with a phone number and calls the existing `sendMessage()` from `src/whatsapp/WhatsAppEngine.ts` (the same engine used by `whatsappAdmin.ts` elsewhere in the app) — reused, not rebuilt. If the cafe has no Evolution API connection configured, each send resolves to `SKIPPED` rather than throwing, so the batch always completes and reports `{ total, sent, skipped }`.

---

## Shipped

Everything below was gap-audited and built in one pass (2026-07-19), each as its own typechecked commit:

| # | Feature | Model | Commit |
|---|---|---|---|
| — | Event CRUD, guest list + bulk import, QR check-in cards, deposit/commission finance tab | `Event`, `Guest` | original build |
| 1 | Event menu packages | `EventMenuItem` | `9ee1612` |
| 2 | Extra-services checklist (décor/sound/DJ/...) | `EventService` | `86a62d2` |
| 3 | Edit event core fields from the UI | — (wired existing `PATCH`) | `c97d987` |
| 4 | Payment installment schedule | `EventPayment` | `54d34ff` |
| 5 | Task checklist | `EventTask` | `54d34ff` |
| 6 | Staff assignment per event | `EventStaffAssignment` | `54d34ff` |
| 7 | Month calendar view + double-booking warning | — | `4511b3c` |
| 8 | Guest invitations (manual wa.me + bulk automated) | `Event.invitationMessage`, `Guest.invitationSentAt` | `23bcb78` |

## Open Items (lower priority, not yet requested)

- The `EventMenuItem` package is admin-planning only — not yet surfaced on the guest-facing public page, which still shows the full restaurant menu.
- No contract/e-signature generation (explicit non-goal above, revisit if asked).
- No client CRM linking repeat clients across multiple events (client info lives per-`Event`, not deduplicated).

Ask the user before building any of the above — nothing here was requested yet.
