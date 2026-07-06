# SmartSuite AI Core & Automation Engine — Phase 1 (AI Gateway) — Design Spec

> Ecosystem-level Blueprint. Compliant with the V1 freeze ("future modules
> via Blueprint docs"). Design only — no implementation until explicitly
> approved and scheduled; this doc is the approval artifact.

## Vision

SmartSuite is a planned multi-tenant SaaS ecosystem: **SmartRestau**
(restaurant management — exists, this repo), **SmartBarber**, **Jam3iyati**
(associations), **ArwaEduc** (schools). Each product needs AI capabilities
(advisors, content generation, copilots) and automation (event-driven
WhatsApp/Email/webhooks). Building these per-product would duplicate
infrastructure four times.

**SmartSuite AI Core** is an independent, reusable internal platform
service that centralizes AI access for every product. This spec covers
**Phase 1: the AI Gateway** — the foundation everything else plugs into.

## Ground truth this design builds on (not assumptions)

SmartRestau already contains a substantial embedded intelligence platform:

- `src/marketing-brain/providers/` — a complete, working AI provider layer:
  `AIProvider` interface, `ProviderRegistry`, `ProviderSelector` (priority +
  failover chains), `UsageTracker`, and **5 adapters** (Claude, Gemini,
  OpenAI, Groq, OpenRouter). Keys live in env vars.
- `src/intelligence/**` (~293 files, K30-K67) — agents, prompt engine,
  memory, skills, orchestrator, rule engine, knowledge engine, 9+ domain
  advisors, and a read-only HTTP gateway. Its AI layer (K42) **re-exports**
  `marketing-brain/providers` rather than reimplementing it.
- `AIProviderSettings` Prisma model — superadmin-managed provider
  enable/priority/fallback config (global, not per-tenant).
- `src/core` EventBus + WhatsAppEngine/EmailEngine + n8n workflows — the
  automation surface (Phase 2 concern, out of scope here).

The strategic decision (user-approved): **extract and generalize this
existing, battle-tested code** into the shared service; do not rebuild.

## Decisions log (user-approved during design)

| Decision | Choice |
|---|---|
| Relationship to SmartRestau's embedded platform | **Gradual extraction** — SmartRestau becomes the first consumer |
| Service framework | **NestJS** as the service shell; extracted logic lives in **framework-agnostic packages** |
| Phase 1 scope | **AI Gateway only** (providers, failover, quotas, usage/cost tracking) |
| Home | **New standalone git repo**, own Docker container on Coolify, own MongoDB database |
| Provider API keys | **Platform-owned** (env vars of the service). Per-product/per-tenant quotas. No BYOK in Phase 1 |

## 1. Requirements analysis

### Functional (Phase 1)

1. One HTTP endpoint for AI completions serving all 4 products.
2. Provider abstraction over the 5 existing adapters, extracted from
   `marketing-brain/providers` — same `AIProvider` interface, registry,
   selector/failover, untouched semantics.
3. Priority + failover-chain provider selection, admin-configurable at
   runtime (generalizes today's `AIProviderSettings`).
4. Two-level quotas: per **product** (e.g. all of SmartRestau) and per
   **tenant** (a specific cafe/salon/school), on requests and tokens per
   day/month. Product-level quota is the default; tenant-level rows
   override.
5. Usage + cost ledger: one record per request (tokens, cost, latency,
   provider, status), queryable by product (own data only) and by
   platform admin (cross-product).
6. Admin API: manage products + API keys (issue/rotate), provider config,
   quotas, and cross-product usage reporting.
7. `tenantId` is an **opaque string** supplied by the calling product
   (SmartRestau passes its `cafeId`). The core attributes usage/quotas by
   it but assigns it no meaning — products own their own tenancy models.

### Non-functional

- Independent deployment: own repo, own Dockerfile, Coolify service, own
  MongoDB database (`smartsuite_ai_core`) on the existing Atlas cluster.
- Service-to-service auth: one API key per product, SHA-256 hashed at
  rest, sent as `X-Api-Key`. Admin surface uses a separate superadmin
  token (same posture as SmartRestau's `SUPERADMIN_SECRET` header check).
- Rate limiting per API key (protects providers and the service itself):
  default 60 requests/minute per product key, overridable via service env
  (`RATE_LIMIT_PER_MINUTE`); distinct from quotas, which are longer-period
  business limits.
- **No streaming in Phase 1** — no current SmartRestau caller streams;
  YAGNI. Revisit in Phase 2/3 if a copilot UI needs it.
- Provider API keys in service env vars only, never in the database —
  matches today's practice.

### Explicitly out of scope (Phase 1)

- Prompt/Template Engine (central versioned prompts) → **Phase 2**.
- Automation Engine (event triggers → WhatsApp/Email/webhook/n8n actions)
  → **Phase 2**.
- Agents/Advisors runtime as a shared service → **Phase 3**.
- BYOK (tenant- or product-owned provider keys).
- Embeddings/RAG endpoints.
- Deleting `marketing-brain/providers` from SmartRestau (stays until the
  integration has proven itself in production).

## 2. Architecture

```
smartsuite-ai-core/                     ← new standalone repo
├── packages/
│   └── ai-providers/                   ← EXTRACTED from SmartRestau's
│       ├── src/                          src/marketing-brain/providers/
│       │   ├── AIProvider.ts             (interface — unchanged)
│       │   ├── ProviderRegistry.ts
│       │   ├── ProviderSelector.ts       (priority + failover)
│       │   ├── UsageTracker.ts
│       │   └── adapters/                 (Claude, Gemini, OpenAI, Groq,
│       │                                  OpenRouter — unchanged)
│       └── package.json                 ← zero NestJS/Express imports
├── src/                                 ← NestJS shell
│   ├── auth/       AuthModule           X-Api-Key guard → product identity
│   ├── gateway/    GatewayModule        POST /v1/ai/complete (hot path)
│   ├── quotas/     QuotasModule         two-level limit checks
│   ├── usage/      UsageModule          ledger writes + queries
│   ├── admin/      AdminModule          products/providers/quotas CRUD
│   └── health/     HealthModule         /health + provider status
├── prisma/schema.prisma                 ← own DB: smartsuite_ai_core
└── Dockerfile
```

Principles:

- **NestJS is the shell, not the brain.** All provider logic lives in
  `packages/ai-providers`, framework-agnostic, exactly as it is today in
  SmartRestau (where it already runs under Express) — proving the
  portability claim by construction.
- **Prisma over Mongoose** despite NestJS convention — the team's entire
  existing skill set and tooling is Prisma+MongoDB; consistency beats
  framework idiom here.
- Request flow (hot path):
  `AuthGuard (API key → product)` → `QuotaService.check(product, tenant)`
  → `ProviderSelector.execute(...)` → `UsageService.record(...)` →
  response. Quota check reads aggregates; usage write is fire-and-forget
  logged (a ledger write failure must not fail an otherwise successful
  completion — log loudly instead).

## 3. Modules

| Module | Single responsibility | Depends on |
|---|---|---|
| `AuthModule` | Validate `X-Api-Key`, attach product identity to request | Prisma (Product) |
| `GatewayModule` | `/v1/ai/complete`, `/v1/ai/providers` — orchestrates auth→quota→provider→ledger | ai-providers pkg, Quotas, Usage |
| `QuotasModule` | Enforce product-level then tenant-level limits (requests + tokens per period) | Prisma (Quota, UsageRecord aggregates) |
| `UsageModule` | Append-only `UsageRecord` ledger; `GET /v1/usage` (product-scoped) | Prisma (UsageRecord) |
| `AdminModule` | Products + key issue/rotate, ProviderConfig, Quotas CRUD, cross-product usage | Prisma (all models) |
| `HealthModule` | `/health`, per-provider reachability status | ai-providers pkg |

## 4. Database models (Prisma, database `smartsuite_ai_core`)

```prisma
model Product {          // SmartRestau, SmartBarber, Jam3iyati, ArwaEduc
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  slug        String   @unique          // "smartrestau"
  name        String
  apiKeyHash  String   @unique          // SHA-256(raw key); raw never stored
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model ProviderConfig {   // generalizes SmartRestau's AIProviderSettings
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  providerId    String   @unique        // 'claude'|'gemini'|'openai'|'groq'|'openrouter'
  isEnabled     Boolean  @default(true)
  priority      Int      @default(1)
  isDefault     Boolean  @default(false)
  fallbackChain String[] @default([])
  notes         String   @default("")
  updatedAt     DateTime @updatedAt
}                        // provider API keys live in service env vars, not here

model Quota {
  id          String  @id @default(auto()) @map("_id") @db.ObjectId
  productId   String  @db.ObjectId
  tenantId    String?                    // null = product-wide default
  period      String  @default("month")  // 'day' | 'month'
  maxRequests Int?                       // null = unlimited
  maxTokens   Int?
  @@unique([productId, tenantId, period])
  @@index([productId])
}

model UsageRecord {      // the ledger — one row per completion request
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  productId        String   @db.ObjectId
  tenantId         String
  providerId       String
  model            String
  promptTokens     Int
  completionTokens Int
  costUsd          Float    @default(0)
  latencyMs        Int
  status           String   // 'ok' | 'failed' | 'quota_exceeded'
  requestId        String   @unique
  createdAt        DateTime @default(now())
  @@index([productId, tenantId, createdAt])
  @@index([providerId, createdAt])
}
```

## 5. APIs

### Consumption surface (products; auth: `X-Api-Key`)

```
POST /v1/ai/complete
  { tenantId, messages[] | prompt, model?, providerId?,
    maxTokens?, temperature?, metadata? }
  → 200 { text, providerId, model,
          usage: { promptTokens, completionTokens, costUsd },
          requestId, latencyMs }
  → 401 invalid key · 402 quota_exceeded · 429 rate-limited
  → 503 all providers in the chain failed

GET  /v1/ai/providers                → enabled providers + health
GET  /v1/usage?tenantId=&from=&to=&groupBy=day|provider|tenant
GET  /health
```

### Admin surface (separate superadmin token)

```
POST/GET/PATCH  /admin/products        (+ POST /admin/products/:id/rotate-key)
GET/PATCH       /admin/providers
POST/GET/PATCH/DELETE /admin/quotas
GET             /admin/usage           (cross-product platform view)
```

## 6. Integration strategy

### SmartRestau (first consumer) — one adapter, zero caller changes

SmartRestau's every AI call already flows through the `AIProvider`
interface via `AIProviderManager`. Integration adds **one new adapter**,
`SmartSuiteCoreAdapter`, implementing that same interface but delegating
to `POST /v1/ai/complete` of the new service:

- `AI_CORE_URL` + `AI_CORE_API_KEY` set in env → all AI traffic routes
  through the core (centralized tracking, quotas, failover).
- Not set → local adapters keep working exactly as today. **Zero risk,
  instant rollback** by removing two env vars.
- No caller (advisors, marketing-brain, copilot, intelligence platform)
  changes a single line.

### Future products

A thin typed HTTP client package, `@smartsuite/ai-client`, published
internally; SmartBarber/Jam3iyati/ArwaEduc consume the gateway through it
from day one — they never embed provider adapters at all.

### Extraction mechanics

`src/marketing-brain/providers/` is **copied** into the new repo as
`packages/ai-providers` (adapters unchanged; the `UsageTracker` write
target becomes the new `UsageRecord` model). The original stays in
SmartRestau until the remote path has proven itself in production —
deletion is a later, separate decision.

### Migration of provider settings

`AIProviderSettings` rows (enable/priority/fallback) are re-entered into
the core's `ProviderConfig` via the admin API at cutover. No automated
migration needed — it's ~5 rows of superadmin config.

## Roadmap after Phase 1 (each phase = its own spec, own approval)

- **Phase 2 — Prompt Engine + Automation Engine**: central versioned
  prompt templates; event-trigger → action pipelines (WhatsApp, Email,
  webhooks, n8n hand-offs) generalizing SmartRestau's
  WhatsAppEngine/EmailEngine + `LoyaltyRewardEligible`-style event
  subscriptions.
- **Phase 3 — Shared Agents/Advisors runtime**: the K40/K45/K46 agent
  framework as a multi-product service.

## Testing approach

Per ecosystem convention (no Jest/Vitest in SmartRestau; the new repo MAY
adopt NestJS's default Jest for unit tests of quota math, but the
authoritative check stays integration-level): a `scripts/controlTestAiCore.ts`
script run against a live instance covering — product auth (valid/invalid/
rotated key), a real completion through at least one provider, failover
(disable the primary, expect the chain to advance), quota enforcement
(402 past the limit), usage-ledger correctness (tokens/cost recorded per
request), and the admin CRUD surface. Plus `tsc --noEmit` in both the
package and the service.
