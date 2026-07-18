# Billing Notifications — i18n Fix (Shared Core)

## Status change (this sprint)

Per `docs/project/full-product-audit-2026-07-18.md` Part 1 §7: `src/billing/notifications/BillingNotifications.ts` hardcoded Arabic strings directly, bypassing the project's own `T[lang]` i18n convention used everywhere else — flagged as a known recurring bug class (the same pattern that shipped the Inventory admin page with only 3 of 4 languages).

## What changed

Every function in `BillingNotifications.ts` (`notifyTrialEnding`, `notifyInvoiceGenerated`, `notifyInvoicePaid`, `notifyQuotaExceeded`, `notifySubscriptionSuspended`, `notifySubscriptionRenewed`) now:
1. Looks up the tenant's `TenantProfile.defaultLanguage` (`src/tenant/`, already the source of truth for tenant language preference — set at signup via the `CafeCreated` auto-provisioning hook).
2. Selects title/message from a 4-language (`ar`/`en`/`fr`/`es`) table, matching the `T[lang]` convention used throughout `app/admin/**`.
3. **Fails open to Arabic** if no `TenantProfile` exists or the language lookup fails for any reason — this matches `TenantProfile.defaultLanguage`'s own schema default (`@default("ar")`), so behavior is unchanged for any tenant that previously had no explicit language set.

## Verification

`scripts/controlTestBillingNotificationsI18n.ts` — self-cleaning, against the live shared DB: creates a synthetic `TenantProfile` with `defaultLanguage: 'en'`, calls `notifyTrialEnding`, confirms the stored notification is genuinely in English; separately confirms a tenant with no `TenantProfile` at all still gets a notification, correctly falling back to Arabic. 5/5 passing.

## Scope note

This fix is contained to `BillingNotifications.ts`. The audit's broader observation — that this bug class ("skips one of the 4 languages") has recurred more than once in this codebase (also seen on `app/admin/inventory/page.tsx`) — is not fully closed by this sprint; a systematic sweep of every admin-facing page/notification source for the same pattern is flagged as a follow-up, not attempted here (out of scope for a single-file i18n bug fix).
