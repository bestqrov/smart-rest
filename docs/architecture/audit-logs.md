# Audit Logs (Shared Core)

## Status change (this sprint)

Per `docs/project/full-product-audit-2026-07-18.md` Part 1 §11: `AuditService` (`src/core/audit/AuditService.ts`) was a real, generic, working service with zero HTTP-route adoption and no viewer UI — "the data is being written into a void." Both gaps addressed:

## What changed

1. **Route-level adoption in `src/routes/menuAdmin.ts`** — the module the audit specifically called out (settings changes "silent and unlogged"). Now calls `AuditService.createAudit` for:
   - `PUT /api/admin/cafe/profile` → `UPDATE_PROFILE`
   - `PUT /api/admin/cafe/payment-config` → `UPDATE_PAYMENT_CONFIG` (logs which fields changed, never the actual credential values)
   - `PUT /api/admin/cafe/wifi` → `UPDATE_WIFI` (logs `enabled`/whether ssid or password changed, never the password value)
   - `POST /api/admin/staff` → `CREATE`
   - `DELETE /api/admin/staff/:id` → `DEACTIVATE`
   - `PATCH /api/admin/staff/:id/pin` → `PIN_CHANGE` (never logs the actual PIN)

   All under `module: 'CAFE_SETTINGS'` (settings) or `module: 'STAFF'`, via a local `auditSettings()` helper matching the existing project-wide pattern (e.g. `orchestrator/WorkflowEngine.ts`'s `audit()` helper) — best-effort, `.catch(() => undefined)`, never blocks the response.

2. **Generic SuperAdmin viewer** — `src/routes/auditLogsSA.ts`:
   - `GET /api/superadmin/audit-logs?module=&entity=&entityId=&action=&performedBy=&from=&to=&page=&limit=` — thin wrapper over `AuditService.getAuditHistory`, gated by the existing `requireSuperAdmin` guard (`src/routes/_billingAuthGuard.ts`).
   - `GET /api/superadmin/audit-logs/modules` — distinct module names for a filter dropdown.

   Distinct from `src/routes/billingAuditSA.ts` (billing-module-scoped) — this is the cross-module viewer.

3. **`app/superadmin/activity/page.tsx`** — the "Activity Log" nav item in `app/superadmin/layout.tsx` has pointed here with no page behind it since at least the 2026-06-30 prior audit (`docs/platform/platform-audit-v1.md`'s "10 missing superadmin pages" P0). Filled in: filterable table (module/action/performedBy), pagination, dark-theme consistent with the rest of `app/superadmin/`.

## Still not adopted (deliberately out of scope this sprint — flagged, not silently dropped)

Per the audit, `AuditService` is called from 25 files but *zero* HTTP routes did before this sprint. This sprint added adoption to `menuAdmin.ts`'s settings/staff endpoints specifically, since those were the audit's named example ("who changed this menu item price"). Still not adopted: table/zone management, POS shift actions, requisitions, and most other high-traffic admin mutation routes. Extending this same `auditSettings()`/inline-`AuditService.createAudit()` pattern to those is a natural follow-up sprint — same shape, no new architecture.

## Verification

`scripts/controlTestAuditLogs.ts` — self-cleaning, run against the live shared DB: `AuditService` round-trip (create/filter by module/entity/user), static confirmation of all 6 new `menuAdmin.ts` call sites (including that none of the payment-config/wifi/PIN entries leak the actual secret value), route/server wiring, and that the "Activity Log" page file now exists. 19/19 passing.
