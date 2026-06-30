# SmartSuite OS — Release Plan

---

## Internal Alpha

**Target:** End of Phase 4 (Billing Platform complete)
**Goal:** All V1 modules working, billing engine live, team can demo any feature
**Criteria:**
- All Phase 1–4 sprints complete
- QA restaurant functional end-to-end
- Zero P0 open bugs
- Team-only access

---

## Internal Demo

**Target:** End of Phase 5 (Payment Platform)
**Goal:** Full demo with live payment flow — any investor or stakeholder can be shown the product
**Criteria:**
- Moyasar payment gateway integrated and tested
- Subscription billing working end-to-end (invoice → payment → renewal)
- SuperAdmin can manage plans, invoices, and tenants from the UI
- Demo script written and rehearsed

---

## Closed Beta — 10 Restaurants

**Target:** End of Phase 7 (Stabilization)
**Goal:** Real restaurants using the platform in production, paying for subscriptions
**Criteria:**
- Phase 7 Stabilization complete (all P0/P1 audit findings fixed)
- Staff PIN security hardened
- Monitoring + alerting configured
- Support runbook written
- 10 restaurants onboarded manually by team
- Feedback collected and triaged after 2 weeks

---

## Open Beta — 50 Restaurants

**Target:** End of Phase 9
**Goal:** Self-serve signup available. 50 restaurants onboarded with minimal manual help
**Criteria:**
- Self-serve onboarding flow complete (signup → trial → subscription)
- Landing page with live demo working
- Payment fully automated (webhook → invoice paid)
- Support ticket system configured

---

## Version 1.0

**Target:** Phase 10 — Commercial Launch
**Goal:** Public release. Paid plans active. Marketing campaign begins.
**Criteria:**
- Open Beta passed with < 3 critical bugs
- Revenue model validated (at least 5 paying restaurants)
- SLA commitments defined (uptime, support response time)
- Terms of Service + Privacy Policy published
- All 18 V1 modules production-stable

---

## Version 1.1

**Target:** ~3 months after V1.0
**Goal:** Polish pass based on real user feedback. No new major modules.
**Likely scope:**
- Performance improvements
- UX improvements based on feedback
- Additional payment providers
- Fulfillment Platform (Phase 6) completion
- Advanced notification channels

---

## Version 2.0

**Target:** ~6 months after V1.0
**Goal:** Expansion. New modules, new markets.
**Likely scope:**
- Hotel Module
- Clinic Module
- IAM (multi-role, fine-grained permissions)
- Public API
- Plugin SDK
- Advanced BI dashboard
- SSO / OAuth / OpenID
