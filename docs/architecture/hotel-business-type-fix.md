# Hotel Business Type — Persistence + Mode-Aware Catalog

## Bugs reported

1. Signup offers a business-type selector (Café / Restaurant / Traiteur / Pastry / Food truck / **Hotel**). Selecting Hotel produced no visible difference from a regular restaurant, and onboarding step 5 re-asked the same question and silently defaulted back to Café.
2. The starter product catalog suggested for Hotel accounts was barely distinct from a regular restaurant's — `MOROCCO_HOTEL` had just 2 room-service items, everything else reused verbatim from Café/Restaurant.

## Root cause

`businessType` was captured at signup (`app/signup/page.tsx` → `POST /api/auth/magic-send` → `VerificationToken.cafeData`), but `magic-verify` only used it to derive a binary `accountMode` (`TRAITEUR` vs `RESTAURANT`) — the actual value was never written to `Cafe`. Onboarding had no way to know what was chosen, so its own `catalogType` state always defaulted to `'CAFE'`.

## What changed

**Schema** (`prisma/schema.prisma`, additive, non-destructive):
- `Cafe.businessType` (`String @default("RESTAURANT")`) — persists the type chosen at signup.
- `Cafe.hotelServiceMode` (`String?`) — only meaningful when `businessType === 'HOTEL'`: `ROOM_SERVICE` | `ON_SITE` | `BOTH`.

**Signup** (`app/signup/page.tsx`): when `businessType === 'HOTEL'`, a follow-up question appears asking whether the hotel needs room-service ordering, an on-site restaurant/café, or both. Also fixed an unrelated stale-closure bug in `handleSubmit`'s `useCallback` deps (was missing `businessType` entirely).

**Backend** (`src/routes/auth.ts`): `magic-send` validates and stores `hotelServiceMode` alongside `businessType` in `cafeData`; `magic-verify` now writes both onto the created `Cafe` row instead of discarding them.

**Profile API** (`src/routes/menuAdmin.ts`): `GET /api/admin/cafe/profile` now returns `businessType`/`hotelServiceMode`; `PUT /api/admin/cafe/profile` accepts `hotelServiceMode` updates (validated against the 3 known values) so legacy accounts can set it later.

**Onboarding** (`app/admin/onboarding/page.tsx`): step 5's catalog-type selector now pre-populates from the saved `businessType` instead of always defaulting to Café. If the account is Hotel and has no saved `hotelServiceMode` (legacy accounts), the same room-service/on-site/both question is asked here and persisted via `PUT /api/admin/cafe/profile` on launch.

**Product catalog** (`src/onboarding/ProductCatalog.ts`): `MOROCCO_HOTEL` split into two real catalogs:
- `MOROCCO_HOTEL_ROOM_SERVICE` — in-room breakfast, all-day in-room dining, minibar/snacks, late-night menu (~20 items across 4 categories, vs. the old 2-item stub).
- `MOROCCO_HOTEL_ON_SITE` — the hotel's own restaurant/café/bar (drinks, starters, mains, desserts, plus a dedicated hotel-bar category with mocktails/wine/beer).

`getProductCatalog(country, businessType, hotelServiceMode?)` now takes an optional third argument: for Hotel accounts it returns only the categories relevant to the chosen mode (`BOTH` = the union; missing/unrecognised mode falls back to the full combined list for legacy accounts created before this field existed). `resolveSelectedProducts()` takes the same optional argument so the apply-to-menu step re-resolves against the same scoped catalog, never trusting client-supplied data.

## Verification

`scripts/controlTestHotelBusinessType.ts` — self-cleaning integration test against the live shared DB: confirms `getProductCatalog` returns mode-isolated categories (no room-service items leak into ON_SITE and vice versa), confirms `BOTH` is the exact union, confirms the legacy no-mode fallback still returns content, confirms the room-service catalog is substantially richer than the old stub, confirms `resolveSelectedProducts` respects the mode boundary, and confirms `Cafe.businessType`/`Cafe.hotelServiceMode` round-trip correctly through Prisma for both Hotel and non-Hotel cafes. 14/14 passing. `npx tsc --noEmit` clean. `scripts/smokeSubscriptionMerge.ts` re-run to confirm no regression: 56/56 passing.

Run: `DATABASE_URL=... npx ts-node --transpile-only -r dotenv/config scripts/controlTestHotelBusinessType.ts dotenv_config_path=.env`
