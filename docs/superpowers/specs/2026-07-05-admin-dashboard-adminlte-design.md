# Admin Dashboard AdminLTE Restyle — Design Spec

**Date:** 2026-07-05
**Status:** Approved by user, pending implementation plan

## Context

The user shared a reference screenshot (AdminLTE 4 admin theme): dark navy
sidebar with icon nav, 4 bright gradient KPI tiles ("150 New Orders", "53%
Bounce Rate", "44 User Registrations", "65 Unique Visitors"), a "Sales Value"
line/area chart card, and a second "Sales Value" card containing a world map
with location pins.

The ask (paraphrased from Darija): restyle the restaurant admin dashboard to
look like this reference, and reorganize the sidebar menu — currently a flat
list of 20+ items — into a consolidated, responsive structure.

This is a visual redesign, which the [[project-v1-freeze]] CTO directive
normally disallows without direct user request — this is a user-authorized
exception, same pattern as prior exceptions (see
`project_v1_freeze_exceptions.md`).

### Current state (confirmed via code exploration)

- **Dashboard** (`app/admin/dashboard/page.tsx`): flat white Tailwind KPI
  cards (`KpiCard` helper, ~line 542) in two rows of 4 (~lines 205-257); one
  `recharts` `LineChart` for revenue trend (~lines 260-274); hand-rolled
  inline-SVG donut charts and a CSS-bar "Peak Hours" mini chart; no map
  widget; light theme, no CSS-variable theming system.
- **Sidebar** (`app/admin/layout.tsx`): a flat `NAV` array (lines 21-42, 20
  items: Dashboard, Menu AI, Menu, Tables, Zones, Staff, Control, Attendance,
  Financials, Margins, Equipment, Invoices, Requisitions, Reservations,
  Loyalty, Certification, Marketing, Social, Billing, Settings) plus 2
  conditional items (Marketplace, Inventory) rendered separately, plus a
  "Staff Screens" block (Kitchen KDS, Waiter View, Mini POS, lines 44-48).
  Desktop `<aside>` (~line 525) and mobile drawer (~line 668) are two
  **separately duplicated renderings** of the same nav, not a shared
  component.
- **Charting**: `recharts ^2.15.4` is the only chart library in
  `package.json`. No map/geo library exists (no react-simple-maps, leaflet,
  etc.).
- **Cafe model** (`prisma/schema.prisma:182`) already has `city` (String),
  `lat`/`lng` (Float?) fields — usable for a weather lookup.
- **Theming**: no CSS-variable theme system in the admin panel; colors are
  hardcoded Tailwind utilities/hex. Only `app/admin/lang-context.tsx` exists
  (language/RTL), no color-theme context.
- **Responsive**: already has a working desktop-always-visible aside +
  mobile hamburger drawer pattern, but duplicated markup.

## Decisions (from brainstorming with visual mockups)

1. **Style direction**: full AdminLTE dark-navy sidebar + bright gradient KPI
   tiles (not the lighter direction used in the recent kitchen/waiter
   redesign — this is a deliberate, separate style choice for the admin
   dashboard specifically).
2. **Sidebar grouping**: accordion — 6 collapsible sections, only the section
   containing the active route open by default:
   - **Overview**: Dashboard
   - **Menu & Ordering**: Menu AI, Menu, Tables, Zones, Reservations
   - **Team**: Staff, Control, Attendance
   - **Finance**: Financials, Margins, Equipment, Invoices, Requisitions,
     Billing
   - **Growth & Marketing**: Marketing, Social, Loyalty, Certification,
     Marketplace
   - **Settings**: Inventory, Settings

   "Staff Screens" (Kitchen KDS, Waiter View, Mini POS) stays as its own
   block outside the accordion, unchanged.
3. **Map-widget replacement**: the reference's world-map card is replaced
   with a **live weather widget** for the cafe's city (user's explicit
   request, not one of the originally-proposed options), using a real
   external API (OpenWeatherMap, user confirmed "real API" over a static
   mock). Positioned at the top of the dashboard (near/above the chart row),
   using the same blue-gradient card chrome as the reference's map card.
4. **Scope**: dashboard page + sidebar only. Other admin pages (Menu, Tables,
   Staff, etc.) are NOT restyled — their content stays as-is. The sidebar is
   a shared layout component, so its new dark/accordion style will
   necessarily appear on every admin page (unavoidable side effect of
   changing a shared component), but that's the only cross-page impact.

## Component Changes

### 1. Sidebar (`app/admin/layout.tsx`)

- Extract nav rendering into a single shared component (e.g.
  `AdminSidebarNav`) used by both the desktop `<aside>` and the mobile
  drawer, eliminating the current duplication.
- Restructure `NAV` from a flat array into 6 named groups (array of
  `{ group: string, items: NavItem[] }`), keeping existing route/label/icon
  data — the underlying links themselves don't change, only their grouping
  and rendering.
- Each group renders as an accordion header (clickable, shows ▾/▸,
  toggles a `expandedGroup` state) + its items. Default expanded group =
  whichever group contains the current route (`usePathname()` match).
- Marketplace/Inventory conditional items move into their respective groups
  (Marketplace → Growth & Marketing; Inventory → Settings) instead of being
  appended separately.
- Visual: darker/richer AdminLTE-style active-item highlight (solid
  accent-colored background+left border on the active link), icon-first
  layout, uppercase small-caps group labels.

### 2. Dashboard page (`app/admin/dashboard/page.tsx`)

- The first 4 `KpiCard`s (Revenue Today, Today's Orders, Active Orders,
  Active Staff — the current top-row 4) get a new visual variant: solid
  gradient background per card (blue/emerald/amber/rose or similar mapped
  from existing `color` prop), white text, matching the reference
  screenshot's tile style. Remaining KPI cards (row 2: new customers,
  wallet balance, most-liked) keep their current flat-white styling —
  only the "headline 4" get the gradient treatment.
- New **Weather widget** card: shows current temperature + condition icon +
  short description for the cafe's `city`, in the same blue-gradient card
  chrome as the reference's map card. Placed in the charts row, alongside
  (or above) the existing revenue `LineChart`, replacing the map slot.
- Existing revenue `LineChart` (recharts) keeps its current data and library
  — only wrapped in updated card styling consistent with the new theme.
- All other dashboard sections (Most Liked, Peak Hours, recent orders table,
  alerts, `CertificationTracker`, `MarketplaceWidget`) remain functionally
  and visually unchanged.

### 3. Weather integration (new)

- **Backend**: new endpoint, e.g. `GET /api/admin/weather`, authenticated
  the same way as other `/api/admin/*` routes. Reads the current cafe's
  `city` (fallback to `lat`/`lng` if `city` is empty), calls OpenWeatherMap's
  current-weather endpoint server-side (API key stored in `.env`, never
  exposed to the client), returns `{ tempC, condition, icon, city }`.
- **Config**: add `OPENWEATHER_API_KEY` to `.env` / `.env.example`.
- **Frontend**: dashboard fetches `/api/admin/weather` once on load (no
  polling needed — weather doesn't need real-time updates), renders in the
  new widget card. Graceful failure: if the API call fails or the cafe has
  no city/coords, the widget shows a neutral placeholder ("—") rather than
  breaking the page.
- **Caching**: not required for this round — one call per dashboard load is
  low-volume; a caching layer can be added later if rate limits become an
  issue (out of scope now).

## Non-Goals / Explicit Deferrals

- No restyling of any admin page other than the dashboard + shared sidebar.
- No new color-theme/CSS-variable system beyond what's needed for this
  redesign (no dark-mode toggle, no theme context).
- No map library added — the map widget is fully replaced by weather, not
  reimplemented with real geography.
- No changes to KPI data sources, revenue chart data, or any backend
  business logic besides the new weather endpoint.
- No caching/rate-limit handling for the weather API beyond basic
  failure-graceful-degradation.
