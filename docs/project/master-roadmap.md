# SmartRestau — Master Roadmap

## Naming rule (binding, effective now)

**Sprint numbers are project-management identifiers only.**

Folders, namespaces, modules, packages, and services must never be named
after sprint numbers again. Name things after what they *are*
(`subscriptions/`, `rag/`, `scheduler/`), not the sprint that built them —
a sprint number belongs in a code comment ("K2 — Subscription Engine"), not
in a path, a Prisma model prefix, or an import specifier.

**Why:** this codebase has one continuous sprint-number sequence (K1→K70+)
spanning Billing, core platform, every feature module, and the Smart
Intelligence platform. Two recent tasks were verbally assigned numbers
("K47 — Knowledge Engine", "K48 — replace legacy scheduler") that were
*already permanently in use* by real, shipped, boot-wired modules
(`src/intelligence/skills/` = K47, `src/intelligence/orchestrator/` = K48) —
because sprint numbers had started leaking into folder/module naming
decisions made without cross-referencing this sequence. This document is
the single source of truth going forward specifically to prevent that.

---

## Completed Sprints

Reconstructed from code comments across the repo (`grep -rn "(K<n>)"`) —
this is the authoritative sequence. Titles are the module's own
self-description where a file exists; entries with no confirmed file are
marked as gaps, not asserted.

### Core Platform / Restaurant Features (K1–K29)

| # | Title | Primary module |
|---|---|---|
| K1 | Billing — Plan Management | `src/billing/plans/` |
| K2 | Billing — Subscription Engine | `src/billing/subscriptions/`, `src/billing/scheduler/` |
| K3 | Billing — Payment Integration | `src/billing/payments/` |
| K4–K8 | *(gap — not confirmed in codebase; verify before reuse)* | — |
| K9 | Billing — Usage Limits | `src/billing/limits/UsageLimitService.ts` |
| K10 | *(gap — referenced only as part of the "K7–K10" billing-integration convention in `src/affiliate/AffiliateService.ts`; no dedicated module found)* | — |
| K11 | Platform Event Standardization (+ Order Core, POS Core foundation) | `src/core/events/StandardEvent.ts`, `src/orders/`, `src/pos/` |
| K12 | Kitchen Display System (foundation) | `src/kitchen/` |
| K13 | Inventory Insight (stock rules) | `src/intelligence/business-skills/InventoryInsightRule.ts` |
| K14 | Tables Management | `src/tables/` |
| K15 | Reservation Management | `src/reservations/` |
| K16–K17 | *(gap — not confirmed)* | — |
| K18 | Multi-Branch Operations | `src/branches/` |
| K19 | CRM Foundation | `src/customers/` |
| K20 | Loyalty & Rewards | `src/loyalty/` |
| K21 | Reviews & Reputation Management | `src/reviews/` |
| K22 | *(gap — not confirmed)* | — |
| K23 | Customer Feedback Automation | `src/feedback/` |
| K24 | *(gap — not confirmed; feedback/support-ticket events exist in `PlatformEventName` but no dedicated K24 module found)* | — |
| K25 | WhatsApp Automation Engine | `src/whatsapp/` |
| K26 | Email Automation Engine | `src/email/`, `src/routes/emailWebhook.ts` |
| K27 | Social Media Automation Engine | `src/social/` |
| K28 | Referral & Affiliate Platform | `src/affiliate/` |
| K29 | Local SEO & Google Business Automation | `src/seo/` |

### Smart Intelligence Platform (K30–K70)

Infrastructure-first build order — each sprint reuses the previous ones'
primitives rather than introducing parallel stores. Full reuse rationale is
documented in `src/intelligence/index.ts`'s header comment.

| # | Title | Module |
|---|---|---|
| K30 | Agent contract/registry foundation | `src/intelligence/AgentRegistry.ts` |
| K31 | Event normalization/categorization/persistence/replay | `src/intelligence/Event*.ts` |
| K32 | Data Hub (pull-based tenant metrics) | `src/intelligence/data/` |
| K33 | Context Engine | `src/intelligence/context/` |
| K34 | *(gap — not confirmed)* | — |
| K35 | Recommendation Engine | `src/intelligence/recommendations/` |
| K36 | Insight Engine | `src/intelligence/insights/` |
| K37 | Action Engine (explicit queue/run only) | `src/intelligence/actions/` |
| K38 | Decision Engine Foundation | `src/intelligence/decisions/` |
| K39 | Knowledge Engine — versioned tenant facts, **no vectors/RAG** | `src/intelligence/knowledge/` |
| K40 | Agent Framework (capabilities/permissions/lifecycle/health) | `src/intelligence/agents/` |
| K41 | Rule Engine (declarative, persisted, tenant-overridable) | `src/intelligence/rules/` |
| K42 | AI Provider Layer | `src/intelligence/ai/` |
| K43 | Prompt Engine | `src/intelligence/prompts/` |
| K44 | Memory Engine | `src/intelligence/memory/` |
| K45 | Agent Runtime | `src/intelligence/runtime/` |
| K46 | Business Advisor Foundation | `src/intelligence/advisor/` |
| K47 | Skill System | `src/intelligence/skills/` |
| K48 | Orchestrator (declarative workflows) | `src/intelligence/orchestrator/` |
| K49 | Capability Engine | `src/intelligence/capabilities/` |
| K50 | API Gateway (read-only HTTP surface) | `src/intelligence/gateway/`, `src/routes/intelligenceGateway.ts` |
| K51 | Observability | `src/intelligence/observability/` |
| K52 | Business Skills Pack (content — 7 Insight rules) | `src/intelligence/business-skills/` |
| K53 | Business Advisor v1 (content — 3 Recommendation rules + advisor) | `src/intelligence/business-advisor/` |
| K54 | Automation Advisor | `src/intelligence/automation-advisor/` |
| K55 | Executive Dashboard | `src/intelligence/executive-dashboard/` |
| K56 | Notification Advisor | `src/intelligence/notification-advisor/` |
| K57 | Dashboard Integration (intelligence overview) | `src/intelligence/dashboard-integration/` |
| K58 | AI Readiness | `src/intelligence/ai-readiness/` |
| K59 | *(gap — not confirmed)* | — |
| K60 | Inventory Advisor | `src/intelligence/inventory-advisor/` |
| K61 | Customer Advisor | `src/intelligence/customer-advisor/` |
| K62 | Marketing Advisor | `src/intelligence/marketing-advisor/` |
| K63 | Reservation Advisor | `src/intelligence/reservation-advisor/` |
| K64 | Staff Advisor | `src/intelligence/staff-advisor/` |
| K65 | Financial Advisor | `src/intelligence/financial-advisor/` |
| K66 | Executive AI Advisor | `src/intelligence/executive-ai-advisor/` |
| K67 | AI Chat Copilot Foundation — session, prompt template | `src/intelligence/ai-copilot/` |
| K67–K68 | AI Copilot — intent routing, service | `src/intelligence/ai-copilot/` |
| K68 | AI Copilot — response composition, multi-intent | `src/intelligence/ai-copilot/` |
| K69 | AI Copilot — actions (catalog, intent detection, confirmation, risk assessment) | `src/intelligence/ai-copilot/` |
| K70 | AI Copilot — workflows (preview, rollback, monitoring, approval, automation suggestions) | `src/intelligence/ai-copilot/` |

### Recently completed, renumbered from colliding ad-hoc labels (this cycle)

These were verbally assigned numbers already taken by K47/K48 above. Real
work, correctly shipped — only the *label* was wrong. Renumbered here into
the next free slots; **do not** rename their actual folders to match
(that's exactly the mistake the naming rule at the top exists to prevent).

| # | Title | Module | Was mislabeled |
|---|---|---|---|
| K71 | BillingSubscription Scheduler — real automatic lifecycle sweep (trial reminders, expiry, grace period, suspension), replacing the deleted legacy TenantProfile-era stub | `src/billing/scheduler/` | ad-hoc "K48" |
| K72 | Tenant Access Migration — Phase 1 (BillingSubscription as an additive, fail-open access gate alongside `Cafe.isActive`; auto-provisioning; backfill script) + Release Patch P0 (wiring `CafeCreated` publishing into all 4 real signup flows) | `src/billing/subscriptions/` (`isAccessAllowed`/`isCafeAccessAllowed`), `src/tenant/index.ts`, `scripts/backfillBillingSubscriptions.ts` | — (untitled "Tenant Access Migration" + "Release Patch P0") |
| K73 | RAG Knowledge Layer — Repository/Document/Chunk storage, keyword-search abstraction, retrieval, permissions, REST API. RAG-ready, not RAG-complete (no embeddings/AI providers) | `src/intelligence/rag/` | ad-hoc "K47" |

---

## Current Sprint Number

**K73** (RAG Knowledge Layer) is the most recently completed sprint, shipped
this cycle. No sprint is currently in progress.

## Next Available Sprint Number

**K74.**

## Reserved Sprint Numbers

No numbers are deliberately reserved for a specific future purpose today.
The gaps below are **not** confirmed reservations — they're numbers with no
matching module found in the codebase. Before assigning a *new* sprint one
of these numbers, search the codebase for it first; it may already be
informally in use somewhere this document's `grep` pass missed.

`K4, K5, K6, K7, K8, K10, K16, K17, K22, K24, K34, K59`

## Deprecated Sprint Numbers

These labels were used verbally/in PM messages but must not appear in any
new code, doc, or commit — the real number is already permanently owned by
the module listed:

| Deprecated label | Was used for | Actual owner of that number |
|---|---|---|
| "K47 — Knowledge Engine" | RAG document/chunk retrieval layer | **K47 = Skill System** (`src/intelligence/skills/`) — real work renumbered to **K73** |
| "K48 — replace legacy TenantProfile scheduler" | BillingSubscription automatic lifecycle scheduler | **K48 = Orchestrator** (`src/intelligence/orchestrator/`) — real work renumbered to **K71** |

Also superseded (not a collision, just retired): the pre-K2.2
`SubscriptionLifecycleJobs.ts` compatibility-adapter approach to the
scheduler (built, then explicitly reverted for architecture cleanliness,
then rebuilt for real as K71) — no number was ever attached to that
intermediate stub; nothing to deprecate beyond the file itself, which is
deleted.

---

## Active Epics

| Epic | Status | Scope |
|---|---|---|
| **Epic K — Billing Platform** | K1–K3 done; K71–K72 done (scheduler + access migration Phase 1); **Phase 2 open** | Subscription lifecycle, payments, and — per explicit direction — fully replacing the legacy `Cafe.isActive`/`billingStatus` wallet-debt system. Phase 2: migrate 11 `Cafe.isActive` write sites + ~6 more read sites, retire wallet fields, disable `dailyDebtDetection.ts`, unify the two SuperAdmin suspend endpoints. See `docs/architecture/billing-platform.md` § Phase 2. |
| **Smart Intelligence Platform** | K30–K70 done; **K73 (RAG) is the first step toward real RAG** | Agent/advisor/skill/workflow infrastructure, business-domain advisors, AI Copilot. K73 added document/chunk retrieval scaffolding; embeddings + a real vector search provider + LLM prompt-assembly wiring are the explicit next step, not yet started. |
| **Core Restaurant Platform** | K1–K29 done, no open phase tracked here | Orders, POS, Kitchen, Tables, Reservations, Branches, CRM, Loyalty, Reviews, Feedback, WhatsApp/Email/Social automation, Affiliate, SEO. Stable; changes now come as bug fixes, not new sprints, unless a new epic is opened. |

---

## Module Ownership

"Ownership" here means **the directory that is the single source of truth
for that concern** — where to look first, and where new work in that domain
belongs, not a person/team assignment (single-engineer project).

| Domain | Directory | Notes |
|---|---|---|
| Billing — plans, subscriptions, payments, invoices, taxes, quotas | `src/billing/` | `subscriptions/` is the single source of truth for subscription lifecycle (K2); `scheduler/` (K71) is the only automatic-lifecycle driver |
| Tenant provisioning (metadata only, not billing authority) | `src/tenant/` | `TenantProfile.state` has near-zero real enforcement — do not treat it as an access gate; see `docs/architecture/billing-platform.md` |
| Platform core (events, audit, notifications) | `src/core/` | `AuditService` is the *one* audit mechanism for the whole app — every module reuses it, never a new audit table |
| Smart Intelligence platform | `src/intelligence/` | See the K30–K73 table above for per-submodule ownership; `index.ts`'s header comment is the authoritative cross-module reuse map |
| RAG Knowledge Layer | `src/intelligence/rag/` | K73. Distinct from `src/intelligence/knowledge/` (K39, versioned facts) — do not conflate |
| Orders / POS / Kitchen | `src/orders/`, `src/pos/`, `src/kitchen/` | K11/K12 foundations |
| Tables / Reservations / Branches | `src/tables/`, `src/reservations/`, `src/branches/` | K14/K15/K18 |
| CRM / Loyalty / Reviews / Feedback | `src/customers/`, `src/loyalty/`, `src/reviews/`, `src/feedback/` | K19/K20/K21/K23 |
| Marketing automation (WhatsApp/Email/Social/Affiliate/SEO) | `src/whatsapp/`, `src/email/`, `src/social/`, `src/affiliate/`, `src/seo/` | K25–K29 |
| Superadmin surface | `src/routes/superadmin*.ts`, `app/superadmin/` | Cross-cutting — touches Billing, Tenant, and Core modules; not a domain of its own |
| Admin panel (tenant-facing UI) | `app/admin/` | Consumes Billing/Core/domain-module REST APIs; owns no backend logic itself |

---

## Maintenance

Regenerate the Completed Sprints tables by re-running:
```
grep -rhoE "\(K[0-9]+[a-zA-Z-]*\)" src/ docs/ --include="*.ts" --include="*.md" | sort -u -V
```
and cross-checking against this document before assigning any new sprint
number. Update this file at the end of every sprint (add the row, update
"Current"/"Next Available") as part of that sprint's own "READY FOR REVIEW"
report — don't let it drift.
