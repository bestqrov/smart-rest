# SuperAdmin Dashboard Redesign
**Date:** 2026-06-11  
**Status:** Approved

---

## Overview

Full redesign of `app/superadmin/page.tsx` with:
- 3 selectable themes (A: Dark Premium / B: Glass Sidebar / C: Minimal Pro)
- Theme switcher in top bar, persisted via `localStorage`
- Better analytics (KPI cards, revenue chart, churn alerts, onboarding progress)
- New management features (impersonation, notes, messaging, export CSV, activity log)
- New "Future Clients" section with Google Places scraper + lead pipeline

---

## Architecture

### File Structure

```
app/superadmin/
  page.tsx                          ← parent: data fetching + all actions + theme state
  components/
    themes/
      ThemeA.tsx                    ← Dark Premium (dark sidebar + gradient cards)
      ThemeB.tsx                    ← Glass Sidebar (glass effect + rich colors)
      ThemeC.tsx                    ← Minimal Pro (top nav + clean table)
      ThemeSwitcher.tsx             ← A/B/C buttons in top bar
    shared/
      TenantModal.tsx               ← billing config / trial / activate modal
      DeleteConfirm.tsx             ← delete confirmation dialog
      DemoRequests.tsx              ← pending demo trial requests panel
      TenantNotes.tsx               ← per-tenant notes (stored in DB)
      SendMessage.tsx               ← send email or in-app notification to tenant
    analytics/
      KpiCards.tsx                  ← 4-5 stat cards with trend indicator
      RevenueChart.tsx              ← 6-month bar chart (SVG, no external lib)
      ChurnAlerts.tsx               ← tenants with 0 orders in last 7 days
      OnboardingProgress.tsx        ← 5-step progress bar per tenant
      ActivityLog.tsx               ← localStorage action log
    leads/
      LeadScraper.tsx               ← city + type search → Google Places results
      LeadPipeline.tsx              ← kanban-style pipeline view
      LeadCard.tsx                  ← individual lead card
```

### Data Flow

`page.tsx` fetches all data and passes it as props to whichever theme component is active. All action handlers (suspend, delete, activate, impersonate, etc.) live in `page.tsx` and are passed down as callbacks. Shared modals are rendered in `page.tsx` above the theme component.

---

## Theme System

### ThemeSwitcher
- 3 buttons labeled `A`, `B`, `C` in the top bar of every theme
- On click: sets `localStorage('superadmin-theme')` and updates React state
- Default: `A` (Dark Premium)

### Theme A — Dark Premium
- Left sidebar, dark background `#060612`
- KPI cards with per-card gradient backgrounds and trend badges
- Revenue bar chart below KPIs
- Tenant table with flag icons and action buttons

### Theme B — Glass Sidebar
- Left sidebar with `backdrop-filter: blur(20px)` glass effect
- Background: deep purple/blue gradient
- Cards with radial glow overlays
- Server health status at bottom of sidebar

### Theme C — Minimal Pro
- Top navigation bar (no sidebar)
- Clean white-on-dark table
- Compact 5-column KPI strip
- Action buttons as text links (`Edit` / `Delete`)

---

## Analytics Features

### KPI Cards
Fields: Total Tenants, Active, MRR (USD), Trial, Suspended.  
Each card shows: current value + trend vs last week (▲/▼).

### Revenue Chart
- SVG bar chart, no external library
- Data: monthly commission totals for last 6 months (from existing MRR breakdown API)
- Rendered in `RevenueChart.tsx`, consumed by all 3 themes

### Churn Alerts
- Query: tenants where `lastOrderAt < now - 7 days` (new field or derived from orders)
- Displayed as a warning strip above the tenant table
- Each alert has a "Send Message" shortcut button

### Onboarding Progress
5 binary steps per tenant, shown as a progress bar in the tenant row:
1. Menu items added (products > 0)
2. QR code generated (tables > 0)
3. Staff created (staff > 0)
4. First order received (orders > 0)
5. Billing configured (subscriptionTier != null)

Data derived from existing tenant fields — no new API needed.

---

## Management Features

### Impersonation (Login as Tenant)
- Button "ادخل كـ" in each tenant row
- Calls `POST /api/superadmin/tenants/[id]/impersonate`
- Backend generates a short-lived JWT (15 min, `purpose: 'impersonate'`) for the tenant's admin user
- Frontend opens `/admin/dashboard` in a new tab with the token in localStorage
- New API route: `app/api/superadmin/tenants/[id]/impersonate/route.ts`

### Notes per Tenant
- "Notes" tab added to existing `TenantModal`
- Stored in new Prisma model: `SuperAdminNote { id, cafeId, body, createdAt }`
- CRUD via `POST/GET /api/superadmin/tenants/[id]/notes`

### Send Message to Tenant
- "رسالة" button in tenant row or churn alert
- Modal with: message body + channel selector (Email via Resend / In-app)
- In-app: creates a `Notification` record for the cafe's admin user
- Email: uses existing Resend integration
- API: `POST /api/superadmin/tenants/[id]/message`

### Export CSV
- Button in top bar: "تصدير CSV"
- Exports all tenants matching current filters
- Fields: name, subdomain, country, currency, status, MRR, balance, trialEndsAt
- Pure frontend: `Blob` + `URL.createObjectURL` — no backend needed

### Activity Log
- Stored in `localStorage('superadmin-activity-log')`, max 100 entries
- Each entry: `{ action, tenantName, timestamp }`
- Written on every action (suspend, delete, activate, impersonate, message sent)
- Displayed in a collapsible panel at the bottom of the dashboard

---

## Future Clients — Lead Scraper

### Overview
A dedicated section (tab or page) for finding and tracking potential restaurant clients.

### Scraper Flow
1. Superadmin enters: city + business type (restaurant / café / traiteur)
2. Frontend calls `POST /api/superadmin/leads/search` with `{ city, type }`
3. Backend queries **Google Places API** (Text Search endpoint)
4. Returns: name, address, phone, rating, reviewCount, placeId
5. Results displayed as lead cards — superadmin can add them to pipeline

### Lead Model (new Prisma model)
```prisma
model Lead {
  id          String   @id @default(cuid())
  name        String
  address     String?
  phone       String?
  rating      Float?
  reviewCount Int?
  placeId     String?  @unique
  city        String
  country     String   @default("MA")
  status      LeadStatus @default(NEW)
  notes       String?
  lastContact DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum LeadStatus {
  NEW
  CONTACTED
  INTERESTED
  CLIENT
  REJECTED
}
```

### Lead Pipeline View
- Kanban-style columns: `🆕 جديد` / `📞 تواصلنا` / `🤝 مهتم` / `✅ عميل` / `❌ رفض`
- Drag status change via dropdown (no drag-and-drop library needed)
- Each card: name, city, phone, rating, last contact date, notes

### Lead Analytics (Report)
- Total leads per city
- Conversion funnel: NEW → CONTACTED → INTERESTED → CLIENT
- Conversion rate percentage
- Best performing cities
- Displayed as simple SVG bar/funnel in the leads section

### API Routes
```
POST /api/superadmin/leads/search       ← Google Places query
GET  /api/superadmin/leads              ← list with status filter
POST /api/superadmin/leads              ← add lead manually
PATCH /api/superadmin/leads/[id]        ← update status / notes
DELETE /api/superadmin/leads/[id]       ← remove lead
```

### Google Places API
- Uses `GOOGLE_PLACES_API_KEY` env var (to be added to `.env`)
- Text Search: `https://maps.googleapis.com/maps/api/place/textsearch/json`
- Only name, address, phone (via Place Details), rating, user_ratings_total returned

---

## New Prisma Models Summary

```prisma
model SuperAdminNote {
  id        String   @id @default(cuid())
  cafeId    String
  cafe      Cafe     @relation(fields: [cafeId], references: [id], onDelete: Cascade)
  body      String
  createdAt DateTime @default(now())
}

model Lead {
  id          String     @id @default(cuid())
  name        String
  address     String?
  phone       String?
  rating      Float?
  reviewCount Int?
  placeId     String?    @unique
  city        String
  country     String     @default("MA")
  status      LeadStatus @default(NEW)
  notes       String?
  lastContact DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

enum LeadStatus { NEW CONTACTED INTERESTED CLIENT REJECTED }
```

---

## New API Routes Summary

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/superadmin/tenants/[id]/impersonate` | Generate short-lived impersonation JWT |
| GET | `/api/superadmin/tenants/[id]/notes` | List notes for tenant |
| POST | `/api/superadmin/tenants/[id]/notes` | Add note |
| DELETE | `/api/superadmin/tenants/[id]/notes/[noteId]` | Delete note |
| POST | `/api/superadmin/tenants/[id]/message` | Send email or in-app message |
| POST | `/api/superadmin/leads/search` | Google Places scraper |
| GET | `/api/superadmin/leads` | List leads |
| POST | `/api/superadmin/leads` | Add lead manually |
| PATCH | `/api/superadmin/leads/[id]` | Update lead status/notes |
| DELETE | `/api/superadmin/leads/[id]` | Delete lead |

---

## Environment Variables Needed

```env
GOOGLE_PLACES_API_KEY=your_key_here
```

---

## Out of Scope

- Real-time drag-and-drop in lead pipeline (dropdown status change is sufficient)
- Multi-language support for superadmin (Arabic only)
- Role-based access within superadmin
- Automated email sequences for leads
