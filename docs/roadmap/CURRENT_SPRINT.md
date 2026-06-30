# Current Sprint — Sprint 4.2: V1 Module Completion

**Phase:** Phase 4 — Billing Platform
**Sprint:** 4.2
**Started:** 2026-07-01
**Target:** Ready for Phase 7 Stabilization entry

---

## Objective

Wire and validate the four remaining V1 modules (Reservations, Loyalty, Marketing, Social) so every module shipped with SmartSuite OS works end-to-end in production. This sprint completes Phase 4 and unlocks the Phase 7 Stabilization sprint.

---

## Scope

| Module | Work Required | Status |
|--------|--------------|--------|
| **Reservations** | Live QA on QA restaurant — validate booking flow, calendar, notifications | ⏳ Waiting QA |
| **Loyalty** | Connect loyalty points engine to purchase events + UI validation | ⏳ Not started |
| **Marketing** | Wire Marketing module UI to backend + n8n automation triggers | ⏳ Not started |
| **Social** | Connect Social module to backend + automation schedule | ⏳ Not started |

---

## Out of Scope

- No new features
- No UI redesigns
- No new integrations beyond what these modules already have
- No payment gateway work (Phase 5)
- No Billing UI (Phase 5)

---

## Deliverables

1. Reservations module passes live QA (booking, cancellation, reminder notification confirmed working)
2. Loyalty module: points accumulate on order, can be redeemed, admin can view history
3. Marketing module: campaigns triggered from admin UI reach customers via n8n/WhatsApp
4. Social module: social posts scheduled and published via n8n automation

---

## Definition of Done

- Each module tested end-to-end on QA restaurant (real data, not seed data)
- Zero P0 bugs in any module
- `CHANGELOG.md` updated after each module completes
- `NEXT_SPRINT.md` prepared before this sprint closes

---

## Dependencies

- n8n environment configured with `N8N_WEBHOOK_SECRET` in Railway for Marketing and Social modules
- QA restaurant account active on staging

---

## Estimated Effort

- Reservations QA: 0.5 days
- Loyalty wiring: 1 day
- Marketing wiring: 1 day
- Social wiring: 1 day

**Total: ~3.5 days**
