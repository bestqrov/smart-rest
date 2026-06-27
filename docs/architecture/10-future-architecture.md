# Future Architecture — SmartRestau OS

> These modules are **not yet built**. This document describes their intended design based on the current architecture patterns and V1 scope freeze.

## Certification Engine (Phase 2)

The Certification Engine's evaluation cron (`certificationEval.ts`) and the `certificationStatus` field on `Cafe` already exist. What is planned:

```mermaid
flowchart TD
    subgraph EXISTING["Exists Today"]
        CRON[Monthly Cron\n1st of month 02:00\ncertificationEval.ts]
        EVAL[Metrics Evaluator\nqrUsageRate ≥ 70%\naverageRating ≥ 4.5\navgPrepTime < 25 min\naccount ≥ 90 days]
        STATUS[Cafe.certificationStatus\nPENDING · ELIGIBLE\nCERTIFIED · REVOKED]
        N8N_CERT[n8n Certification Webhook\nN8N_CERTIFICATION_WEBHOOK_URL]
    end

    subgraph PLANNED["Planned — Phase 2"]
        BADGE[Certification Badge Service\n- Generate PDF certificate\n- Issue digital badge URL\n- Embed badge on QR menu page]
        DASHBOARD[Certification Dashboard\napp/admin/dashboard/CertificationTracker.tsx\n- Current metrics vs thresholds\n- Days until next evaluation\n- Historical trend]
        LEADERBOARD[Public Leaderboard\n- Top-rated certified cafes by city\n- Filterable by country / business type]
        REVOKE[Revocation Engine\n- Monthly re-evaluation\n- Automatic CERTIFIED → REVOKED\n- Owner notification via WhatsApp]
        TIER2[Certification Tiers\nBronze → Silver → Gold\nBased on sustained performance]
    end

    CRON --> EVAL --> STATUS
    STATUS -->|ELIGIBLE| N8N_CERT
    N8N_CERT -->|WhatsApp| BADGE
    BADGE --> DASHBOARD
    DASHBOARD --> LEADERBOARD
    EVAL --> REVOKE
    STATUS --> TIER2
```

**Integration points already wired:**
- `app/admin/dashboard/CertificationTracker.tsx` — UI component exists
- `src/routes/adminCertification.ts` — Admin endpoint exists
- `N8N_CERTIFICATION_WEBHOOK_URL` — Env variable in `.env.example`

**What needs to be built:**
- PDF / image certificate generation service
- Public badge endpoint (`GET /api/public/badge/:cafeId`)
- Embedded `CertifiedBadge.tsx` on QR menu (component shell exists)
- Tier progression logic
- Leaderboard page

---

## Analytics Module (Phase 3)

```mermaid
flowchart LR
    subgraph SOURCES["Data Sources (all exist)"]
        ORDERS[(Orders\ncafeId · amount · status\ncreatedAt · source)]
        PRODUCTS[(Products\ncategoryId · price)]
        WALLETLOGS[(WalletLog\ncommission events)]
        QRSCANS[(QrScan\nscannedAt · tableId)]
        FEEDBACK[(Feedback\nrating · comment)]
        LOYALTY[(LoyaltyAccount\npoints · totalSpent)]
        MARKETING_GEN[(marketing_generations\ntokens · cost · latencyMs)]
        CAMPAIGN_EXE[(campaign_executions\nSENT · FAILED stats)]
        DELIVERY_AUDIT[(delivery_audit_logs\nlatencyMs · retryable)]
    end

    subgraph ANALYTICS["Analytics Engine (Planned)"]
        AGG[Aggregation Layer\nMongoDB $aggregate pipelines]
        CACHE[Cache Layer\nResult TTL: 5 min]
        API2[Analytics API\nGET /api/analytics/**]
    end

    subgraph DASHBOARDS["Dashboards (Planned)"]
        REV[Revenue Dashboard\nDaily · Weekly · Monthly\nper-country breakdown]
        OPS[Operations Dashboard\nAvg prep time · Peak hours\nOrder source split QR vs POS]
        MKT[Marketing Dashboard\nGeneration success rate\nCampaign delivery rate\nCost per lead]
        CERT2[Certification Dashboard\nMetric trends over time]
    end

    subgraph EXPORT["Export (Planned)"]
        CSV[CSV Export]
        PDF2[PDF Reports]
        WEBHOOK_OUT[Webhook push to external BI]
    end

    SOURCES --> AGG
    AGG --> CACHE --> API2
    API2 --> REV & OPS & MKT & CERT2
    API2 --> CSV & PDF2 & WEBHOOK_OUT
```

**Key metrics to expose:**

| Metric | Source |
|---|---|
| Revenue per day / week / month | `WalletLog` aggregation |
| Commission rate (%) | `BillingInvoice` + `Order.total` |
| QR vs POS order split | `Order.source` |
| Average prep time | `Order.createdAt` → `Order.preparedAt` |
| Customer return rate | `LoyaltyAccount.totalSpent` trend |
| AI generation cost per lead | `marketing_generations.estimatedCost` |
| Campaign delivery rate | `campaign_executions` SENT / total |
| Top products by revenue | `OrderItem` grouped by `productId` |

---

## Marketplace (Phase 4+)

```mermaid
flowchart TD
    subgraph MARKETPLACE["SmartRestau Marketplace (Future)"]
        REGISTRY[Extension Registry\n- Third-party integrations\n- Verified publishers\n- Version management]
        BILLING2[Extension Billing\n- Per-use or subscription\n- Revenue share with publisher]
        SANDBOX[Sandbox Environment\n- Isolated execution context\n- Webhook-only API surface]
        STORE[App Store UI\n- Browse, install, configure\n- per-cafe enable/disable]
    end

    subgraph EXTENSION_TYPES["Extension Types"]
        PAYMENT_EXT[Payment Providers\n- New mobile money wallets\n- Local card processors]
        AI_EXT[AI Providers\n- Custom models\n- Fine-tuned adapters]
        CHANNEL_EXT[Delivery Channels\n- SMS providers\n- Telegram\n- Push notifications]
        INTEGRATION_EXT[CRM Integrations\n- HubSpot · Zoho\n- Custom CRMs]
        REPORT_EXT[Custom Reports\n- Publisher-defined analytics\n- Embedded dashboards]
    end

    subgraph EXISTING_HOOKS["Existing Extension Points"]
        DELIVERY_IF[DeliveryProvider interface\nsrc/marketing-brain/automation/providers/]
        AI_IF[AIProvider interface\nsrc/marketing-brain/providers/]
        N8N_WEBHOOK[n8n Webhooks\nGeneric automation trigger]
    end

    MARKETPLACE --> EXTENSION_TYPES
    PAYMENT_EXT -.->|implements| DELIVERY_IF
    AI_EXT -.->|implements| AI_IF
    CHANNEL_EXT -.->|implements| DELIVERY_IF
    INTEGRATION_EXT -.->|via| N8N_WEBHOOK
```

**Architecture principles for Marketplace:**
- Extensions communicate only via defined interfaces — they cannot access the DB directly
- The `DeliveryProvider` interface (Phase D) and `AIProvider` interface (Phase A) are already the correct extension points
- New payment providers would implement a `PaymentProvider` interface (not yet defined)
- All extensions are webhook-based — no npm packages loaded at runtime

---

## Planned Module Timeline

```mermaid
gantt
    title SmartRestau OS — Module Roadmap
    dateFormat YYYY-MM
    section Live (V1)
    Restaurant Core      :done,    2025-01, 2025-06
    Billing Engine       :done,    2025-04, 2025-07
    Marketing Brain A–D  :done,    2026-04, 2026-06
    Certification Engine :done,    2026-05, 2026-06

    section Phase 2
    Certification V2 (badge + tiers)    :active, 2026-07, 2026-09
    Analytics Module                     :        2026-08, 2026-11

    section Phase 3
    Loyalty V2 (advanced rewards)        :        2026-10, 2027-01
    Marketing Brain E (WhatsApp send)    :        2026-09, 2026-11

    section Phase 4
    Marketplace MVP                      :        2027-01, 2027-06
```

---

## How to Add a New Delivery Channel

The `DeliveryProvider` interface is already stable. To add a new channel (e.g. SMS, Telegram):

```typescript
// src/marketing-brain/automation/providers/TelegramAdapter.ts

import type { DeliveryProvider, DeliveryResult } from './DeliveryProvider'
import type { ICampaignExecution } from '../../models/CampaignExecution'

export class TelegramAdapter implements DeliveryProvider {
  readonly id       = 'telegram'
  readonly name     = 'Telegram Bot'
  readonly isActive = true

  async send(execution: ICampaignExecution): Promise<DeliveryResult> {
    // POST to Telegram Bot API
    // Return DeliveryResult
  }

  async healthCheck(): Promise<boolean> {
    // Check bot is reachable
  }
}
```

Then register it in `AutomationEngineService`:

```typescript
const engine = new AutomationEngineService({
  providers: [
    new N8nAdapter({ webhookUrl: process.env.N8N_WEBHOOK_URL! }),
    new TelegramAdapter({ botToken: process.env.TELEGRAM_BOT_TOKEN! }),
  ],
})
```

## How to Activate a New AI Provider

All AI provider stubs are already registered. To activate Claude:

1. Set `isActive = true` in `ClaudeAdapter.ts`
2. Add `CLAUDE_API_KEY` to `.env`
3. Pass `claude: { apiKey: process.env.CLAUDE_API_KEY }` to `createAIProviderManager()`

The fallback chain (`Gemini → Claude → OpenAI → Groq → OpenRouter`) will automatically try Claude if Gemini fails.
