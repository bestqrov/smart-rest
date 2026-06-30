# Next Sprint — Sprint 7.1: Platform Stabilization

**Phase:** Phase 7 — Stabilization
**Depends on:** Sprint 4.2 (V1 Module Completion) ✅

---

## Objective

Harden SmartSuite OS for the Closed Beta. Fix all P0/P1 issues identified in the Platform Audit V1 (2026-06-30). No new features — only hardening, security, and reliability.

---

## Scope

| Item | Source | Priority |
|------|--------|----------|
| Hash staff PINs (currently plain text) | Audit V1 — `src/routes/menuAdmin.ts:415,617` | P0 |
| Fix 10 missing SuperAdmin stub pages | Audit V1 | P1 |
| Fix AnalyticsAdapter field mismatch | Audit V1 | P1 |
| Full E2E test pass on QA restaurant | QA requirement | P0 |
| Rate limiting on auth + public endpoints | Security | P1 |
| Error monitoring setup (Sentry or Logtail) | Operations | P1 |
| Deployment runbook (Railway, env vars) | Operations | P2 |

---

## Out of Scope

- Payment gateway integration (Phase 5)
- New modules (Hotel, Clinic, Retail)
- UI redesigns
- Feature additions

---

## Definition of Done

- All P0 issues resolved and verified in production
- All P1 issues resolved or explicitly deferred with written justification
- Closed Beta entry criteria from MASTER_ROADMAP met
- CHANGELOG.md updated
