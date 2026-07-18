# CRM Core (Shared Core)

## Status change (this sprint)

Per `docs/project/full-product-audit-2026-07-18.md` Part 1 §12 / Part 2: `src/customers/CustomerService.ts` and its full REST surface (`src/routes/customers.ts`) were fully built (search, tags, notes, favorites, derived order/visit history) but had **zero consuming frontend** — not even a sidebar nav entry. Fully built, invisible feature. Closed this gap.

## What changed

- **`app/admin/customers/page.tsx`** (new) — searchable customer list (name/phone), a detail drawer per customer showing loyalty points, visit count, tags (add/remove), notes (edit/save), favorite product count, and recent order history. Calls the pre-existing `/api/admin/customers*` endpoints as-is — no backend changes needed.
- **`app/admin/AdminSidebarNav.tsx`** — added a `/admin/customers` entry (key `customers`) to the `growth` group, alongside Loyalty.
- **`lib/adminI18n.ts`** — added the `customers` nav-label key to **all 4** language blocks (ar/en/fr/es) in the same pass, deliberately avoiding the known "4th language falls back silently" bug class flagged in this session's own full-product-audit and in prior project history (the Inventory page shipped with only 3 of 4 languages).

## Verification

`scripts/controlTestCrmCore.ts` — static checks (page file exists, nav wiring, all 4 i18n languages present) plus a live round-trip against `CustomerService` using a synthetic customer on a real, existing cafe (search/tag/untag/notes/favorite/unfavorite/profile), fully cleaned up after. 10/10 passing.

## Explicitly out of scope

No backend changes. No new "CRM" concept beyond what `CustomerService` already provides — segments/pipelines (mentioned in the audit as a CRM gap) would be new backend scope, not a frontend-only fix, and are not part of this sprint.
