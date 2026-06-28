# Certification Dashboard — UI Documentation

## Overview

Two surfaces:
- `/admin/certification` — Restaurant owner's personal certification dashboard
- `/superadmin/certification` — Platform-wide certification management

Both consume the existing `CertificationEngine` via REST API. No business logic lives in the UI.

---

## Page Hierarchy

```
app/
├── admin/
│   └── certification/
│       └── page.tsx          ← restaurant owner view
└── superadmin/
    └── certification/
        └── page.tsx          ← platform management view
```

---

## Component Tree (Admin Dashboard)

```
CertificationPage
│
├── Toast (fixed, top-right / top-left RTL)
│
├── Header
│   ├── Title + subtitle
│   └── Evaluate Now button
│
├── EmptyState (when no result exists)
│   └── Evaluate Now CTA
│
└── [when result exists]
    │
    ├── ExpiredWarning banner (conditional)
    │
    ├── Hero Card (rounded-3xl, white, shadow-sm)
    │   ├── ScoreCircle (SVG, animated, level-colored)
    │   ├── CertificationBadge (level emoji + label + border)
    │   ├── LevelProgress (5-segment track: BRONZE → DIAMOND)
    │   ├── NextLevel indicator ("X points to GOLD")
    │   ├── Meta row (lastEval, expires, version)
    │   └── Score bar (full-width, level-colored gradient)
    │
    ├── Recommendations section
    │   └── RecommendationCard[] (sorted HIGH → LOW)
    │       ├── Priority badge
    │       ├── Title + description
    │       └── Action text (TrendingUp icon)
    │
    ├── Rule Breakdown section
    │   └── PackCard[] (one per active pack)
    │       ├── Pack icon (emoji) + name + passed/total
    │       ├── Progress bar (pack % score)
    │       └── [expanded] RuleCard[]
    │           ├── Pass/fail icon
    │           ├── Title + weight/earned
    │           └── [expanded] EvidenceCard
    │               ├── Raw value
    │               ├── Expected value
    │               ├── Score %
    │               └── Timestamp
    │
    ├── History section (last 4 evaluations)
    │   └── Row: emoji + level + % + date + expired tag
    │
    └── Coming Soon actions (disabled buttons)
        ├── Download Certificate
        ├── Share Badge
        ├── Public Verification
        └── Auto Evaluation
```

---

## Component Tree (SuperAdmin)

```
SuperAdminCertificationPage
│
├── Toast (fixed, top-right)
│
├── Header + Refresh button
│
├── StatsBar (4 KPI cards)
│   ├── Total Evaluated
│   ├── Completed
│   ├── Expired
│   └── Gold+
│
├── LevelDistribution (horizontal color bar)
│
├── Filters row
│   ├── Search input (debounced 350ms)
│   ├── Level filter dropdown
│   └── Bulk Evaluate button (when checkboxes selected)
│
└── Table
    ├── thead: checkbox, Restaurant, Level, Score, Evaluated, Expires, Actions
    └── tbody: one row per cafe
        ├── Checkbox (for bulk select)
        ├── Restaurant name + subdomain
        ├── LevelBadge (emoji + level + expired tag)
        ├── ScoreBar (mini progress + %)
        ├── Evaluated date (hidden on mobile)
        ├── Expiry date (highlighted amber if expired)
        └── Evaluate button (per-row)
```

---

## Data Flow

### Admin Dashboard

```
page load
  → GET /api/admin/certification/result
      ← { result, packBreakdown, evidenceMap, nextLevel, history }

evaluate button
  → POST /api/admin/certification/evaluate
      ← { ok, result }
  → re-load GET /api/admin/certification/result
```

### SuperAdmin

```
page load / filter change
  → GET /api/superadmin/certification?page&search&level
      ← { rows, total, page, stats }

per-row evaluate
  → POST /api/superadmin/certification/:tenantId/evaluate
      ← { ok, result }

bulk evaluate
  → POST /api/superadmin/certification/bulk-evaluate
      body: { tenantIds: string[] }
      ← { results, total, succeeded }
```

---

## Level Color System

| Level | Color | Emoji | Min % |
|-------|-------|-------|-------|
| NONE | gray | — | 0 |
| BRONZE | amber-700 | 🥉 | 30 |
| SILVER | slate-600 | 🥈 | 50 |
| GOLD | yellow-700 | 🥇 | 70 |
| PLATINUM | violet-700 | 💜 | 85 |
| DIAMOND | sky-700 | 💎 | 95 |

Admin dashboard: light theme (white/gray-50 backgrounds)
SuperAdmin: dark theme (zinc-950/zinc-900 backgrounds)

---

## Pack Icons

| Pack | Emoji |
|------|-------|
| operations-pack | ⚙️ |
| billing-pack | 💳 |
| marketing-pack | 📣 |
| automation-pack | 🤖 |
| customer-pack | 🤝 |
| reservation-pack | 📅 |
| inventory-pack | 📦 |
| ai-pack | ✨ |
| security-pack | 🔒 |
| compliance-pack | 📋 |

---

## RTL Support

- All pages use `dir={isRTL ? 'rtl' : 'ltr'}` on the root container
- Arabic is the default language (`lang="ar"` in root layout)
- Toast placement flips: `right-5` → `left-5` in RTL mode
- Rule cards use `text-start` (not `text-left`) throughout
- Score circles and progress bars are directionally neutral (SVG)
- No hardcoded `margin-left` / `padding-left` — always `gap-*` or `p-*`
- Recommendation priority badge uses `flex-wrap` to avoid overflow

### RTL Checklist
- [x] Root dir attribute
- [x] Toast positioning
- [x] Text alignment (`text-start`)
- [x] Icon order respects flex direction
- [x] No `ml-*`/`mr-*` in layout-critical paths

---

## API Routes

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/certification` | Admin JWT | Legacy widget endpoint |
| GET | `/api/admin/certification/result` | Admin JWT | Full result + pack breakdown |
| POST | `/api/admin/certification/evaluate` | Admin JWT | Trigger evaluation |

### SuperAdmin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/superadmin/certification` | SA headers | List all with cert status |
| GET | `/api/superadmin/certification/:tenantId` | SA headers | Single tenant detail |
| POST | `/api/superadmin/certification/:tenantId/evaluate` | SA headers | Evaluate one |
| POST | `/api/superadmin/certification/bulk-evaluate` | SA headers | Evaluate up to 50 |

---

## Future Extensions

### Phase H3 — PDF Certificate
```typescript
// Route (not yet built):
GET /api/admin/certification/pdf
→ application/pdf download

// Button is already present (disabled, "Coming Soon")
```

### Phase H4 — Public Verification
```
/verify/cert/:certificationCode
```
Static page — no auth required. Shows level, name, validity, QR code.
Button already present in admin dashboard (disabled).

### Phase H5 — Share Badge
Social sharing card with level, percentage, restaurant name.
Pre-built card dimensions: 1200×630 (og:image compatible).

### Phase H6 — Auto Evaluation
Configure periodic evaluation (weekly/monthly) via admin settings.
Toggle already reserved as "Coming Soon" button.

---

## Responsive Behavior

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Hero card | stacked (circle top) | side-by-side | side-by-side |
| Pack cards | full-width | full-width | full-width (max-w-3xl) |
| SA table: Evaluated/Expires | hidden | hidden | visible |
| SA filters | stacked | row | row |
| Score circle | centered | left-aligned | left-aligned |

---

## Accessibility

- All interactive elements have focus rings (`focus:outline-none focus:border-*`)
- Progress bars use `title` attribute for screen readers (SA table)
- Disabled buttons use `disabled` attribute (not just visual opacity)
- Color is never the only indicator (emojis + text labels always present)
- `aria-label` on icon-only buttons where present
