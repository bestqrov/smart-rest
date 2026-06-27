# Marketing Pipeline — SmartRestau OS

## End-to-End Flow

```mermaid
flowchart TD
    LEAD([Lead / DemoRequest\nPrisma: DemoRequest model])

    subgraph TRIGGER["Trigger Layer"]
        HOOK[Fire-and-Forget Hook\nsrc/routes/demoRequests.ts\nmarketingGenerate().catch]
    end

    subgraph MGS["MarketingGenerationService\nsrc/marketing-brain/MarketingGenerationService.ts"]
        PENDING[(Create PENDING record\nmarketing_generations)]
        RETRY{Attempt 1–3\nExponential backoff\n1s · 2s · 4s}
    end

    subgraph DE["Decision Engine\ndecision-engine/DecisionEngine.ts"]
        DE1[Select Scenario\nscenarios collection]
        DE2[Select Template\nmessage_templates]
        DE3[Evaluate AI Rules\nai_rules]
        DE4[Confidence Score\n0–100]
    end

    subgraph SE["Strategy Engine\nstrategy/StrategyEngine.ts"]
        SE1[Plan Channel\nWHATSAPP · EMAIL · SMS]
        SE2[Plan Timing\ninitialDelaySeconds\nbestHourStart / End]
        SE3[Plan Followup Sequence\n0–N touchpoints]
        SE4[Plan Escalation\ndaysToEscalate]
        SE5[Stop Conditions\nMAX_ATTEMPTS · OPT_OUT · CONVERTED]
    end

    subgraph PB["Prompt Builder\nprompt-builder/PromptBuilder.ts"]
        PB1[Build System Prompt\nRole · Rules · Forbidden words]
        PB2[Build User Prompt\nLead profile · Template · Variables]
        PB3[Interpolate Variables\nname · cafeName · city · ...]
        PB4[Generate Version Hash\nSHA-256 of template + vars]
        PB5[Estimate Tokens\nsystemTokens · userTokens · total]
    end

    subgraph PRE["Pre-flight Validation\ngeneration/GenerationPipeline.ts"]
        V1[Safety Check\nSafetyChecks.ts\nHate · Violence · Privacy]
        V2[Compliance Check\nComplianceValidator.ts\nForbidden patterns in template]
        V3[Brand Check\nBrandValidator.ts\nTone · Length · CTA]
    end

    subgraph AIP["AI Provider Manager\nproviders/AIProviderManager.ts"]
        AIP1[Select Provider\nLowest priority active]
        GEM[Gemini Adapter\ngoogle/gemini-2.5-flash\nNative fetch · REST API]
        AIP2[Usage Tracker\nTokens · Cost · Latency]
        FALL{Fallback?\nRetryable error}
    end

    subgraph OV["Output Validation\ngeneration/OutputValidator.ts"]
        OV1[Length Check\nMin / Max chars]
        OV2[Language Check\nExpected language present]
        OV3[CTA Check\nCall-to-action present]
        OV4[Banned Words\nPost-generation filter]
    end

    subgraph STORE["MarketingGeneration Record\nmarketing_brain.marketing_generations"]
        ST1[status: COMPLETED\ngeneratedMessage\nprovider · promptVersion\nconfidenceScore · tokens\nestimatedCost · latencyMs\nvalidationStatus]
    end

    subgraph CO["Campaign Orchestrator\nCampaignOrchestratorService.ts"]
        CO1[Create PRIMARY execution\nscheduledAt = now + initialDelay\nstatus: READY or QUEUED]
        CO2[Create FOLLOWUP executions\n1 per touchpoint\nscheduledAt = triggerTime + delayDays]
    end

    subgraph CEDB[(campaign_executions\ncollection)]
    end

    subgraph AE["Automation Engine\nautomation/AutomationEngineService.ts"]
        AE1[tickReady\nQUEUED → READY]
        AE2[getReadyExecutions\nsorted by priority]
        AE3[deliverWithRetry\nmaxAttempts=3\nbaseDelay=1s]
        AUDIT[(delivery_audit_logs\none record per attempt)]
    end

    subgraph N8N["n8n Webhook\nautomation/providers/N8nAdapter.ts"]
        N8N1[POST JSON payload\nexecutionId · channel · message\nleadId · metadata]
        N8N_R{HTTP response}
    end

    subgraph CHANNEL["Delivery Channel"]
        WA[WhatsApp\nEvolution API]
        EM[Email]
        SM[SMS]
    end

    LEAD --> TRIGGER
    TRIGGER --> PENDING
    PENDING --> RETRY
    RETRY --> DE1
    DE1 --> DE2 --> DE3 --> DE4

    DE4 --> SE1 --> SE2 --> SE3 --> SE4 --> SE5

    SE5 --> PB1 --> PB2 --> PB3 --> PB4 --> PB5

    PB5 --> V1 --> V2 --> V3

    V3 -->|All pass| AIP1
    AIP1 --> GEM
    GEM --> AIP2
    AIP2 --> FALL
    FALL -->|Yes, try next provider| AIP1
    FALL -->|No, propagate error| RETRY

    GEM -->|Raw text| OV1 --> OV2 --> OV3 --> OV4

    OV4 -->|VALID| ST1
    RETRY -->|All attempts failed| STORE_FAIL[(status: FAILED\nerror message stored)]

    ST1 --> CO1
    ST1 --> CO2
    CO1 --> CEDB
    CO2 --> CEDB

    CEDB --> AE1 --> AE2 --> AE3
    AE3 --> AUDIT
    AE3 --> N8N1
    N8N1 --> N8N_R
    N8N_R -->|2xx| WA
    N8N_R -->|2xx| EM
    N8N_R -->|2xx| SM
    N8N_R -->|5xx / timeout| AE3
```

## Stage Details

### 1. Decision Engine

**File:** `src/marketing-brain/decision-engine/DecisionEngine.ts`

Selects the best scenario, template, and AI rules for a lead profile. Fully deterministic — same input always produces same output. Scores each option against:
- Funnel stage match
- Business type compatibility
- Country / language fit
- AI rule applicability

Output: `DecisionResult` with `confidenceScore` (0–100) and full `ReasoningTrail`.

### 2. Strategy Engine

**File:** `src/marketing-brain/strategy/StrategyEngine.ts`

Plans the **when** and **how many** without generating any content:

| Sub-planner | File | Output |
|---|---|---|
| Channel Planner | `ChannelPlanner.ts` | `primaryChannel`, `secondaryChannel` |
| Timing Planner | `TimingPlanner.ts` | `recommendedSendTime` (delays, best hours) |
| Sequence Planner | `SequencePlanner.ts` | `followupPlan` (0–N touchpoints) |
| Escalation Planner | `EscalationPlanner.ts` | `escalationPlan` (triggers + actions) |
| Stop Conditions | `StopConditions.ts` | `stopConditions[]` (MAX_DAYS, OPT_OUT, etc.) |

### 3. Prompt Builder

**File:** `src/marketing-brain/prompt-builder/PromptBuilder.ts`

Assembles the two-part prompt sent to the AI:

- **System prompt** — AI role, brand rules, language constraints, forbidden word list
- **User prompt** — Rendered template with interpolated variables (lead name, business name, city, phone, agent name, ...)

Generates a version hash (`v1-{sha256[:8]}`) for traceability. Estimates tokens before calling the AI to detect context-too-long early.

### 4. Pre-flight Validation

Three sequential validators run before any API call is made:

| Validator | What it checks |
|---|---|
| `SafetyChecks.ts` | Hate speech, violence, personal data exposure |
| `ComplianceValidator.ts` | Forbidden patterns in the rendered template body |
| `BrandValidator.ts` | Brand tone, required CTA, message length limits |

Any failure aborts the pipeline before spending tokens.

### 5. AI Provider Manager

**File:** `src/marketing-brain/providers/AIProviderManager.ts`

Priority-ordered provider registry:

| Priority | Provider | Status |
|---|---|---|
| 1 | Gemini (`gemini-2.5-flash`) | ✅ Active |
| 2 | Claude | 🔜 Stub |
| 3 | OpenAI | 🔜 Stub |
| 4 | Groq | 🔜 Stub |
| 5 | OpenRouter | 🔜 Stub |

`executeWithFallback()` iterates active providers in priority order. Retryable errors (rate limit, server error, timeout) try the next provider; permanent errors (auth, safety) propagate immediately.

### 6. Output Validation

**File:** `src/marketing-brain/generation/OutputValidator.ts`

Post-generation checks on the raw AI text:
- Minimum / maximum character count
- Correct language detected
- At least one call-to-action present
- No banned words slipped through

### 7. MarketingGeneration Record

Stored in `marketing_brain.marketing_generations`. Every generation attempt produces a record — `COMPLETED` or `FAILED`. Fields include:

```
generationId · leadId · scenario · channel · language · country · businessType
status · attempts · generatedMessage · provider · promptVersion · confidenceScore
tokens · estimatedCost · latencyMs · validationStatus · error · generatedAt
```

### 8. Campaign Orchestrator

**File:** `src/marketing-brain/CampaignOrchestratorService.ts`

Transforms one `MarketingGeneration` into `N` `CampaignExecution` records:

- **1 PRIMARY** — the initial message, scheduled immediately or after `initialDelaySeconds`
- **0–N FOLLOWUP** — one per touchpoint in the strategy's `followupPlan`

Scheduling:
- `PRIMARY.scheduledAt = generation.generatedAt + initialDelaySeconds`
- `FOLLOWUP[i].scheduledAt = generation.generatedAt + delayDays × 86400s + delayHours × 3600s`

Status at creation: `READY` (if `scheduledAt ≤ now`) or `QUEUED`.

### 9. Automation Engine

**File:** `src/marketing-brain/automation/AutomationEngineService.ts`

Polling loop (production) or single-pass (tests) that:
1. Calls `tickReady()` to promote past-due QUEUED → READY
2. Gets all READY executions sorted by `priority asc, scheduledAt asc`
3. For each: calls `deliverWithRetry(execution)` with exponential backoff (1s / 2s / 4s)
4. Writes one `DeliveryAuditLog` record per attempt
5. Marks execution `SENT` or `FAILED` in MongoDB

### 10. n8n Delivery

The `N8nAdapter` POSTs a `DeliveryPayload` JSON to the configured webhook URL. n8n receives it and routes to the appropriate channel (WhatsApp via Evolution API, Email, etc.).

**Payload:**
```json
{
  "executionId": "...",
  "campaignId":  "...",
  "generationId":"...",
  "leadId":      "...",
  "channel":     "WHATSAPP",
  "message":     "Si Youssef, votre démo SmartRestau est prête !",
  "goal":        "Initial outreach — qualify and book demo",
  "scheduledAt": "2026-06-27T09:00:00.000Z",
  "priority":    1,
  "metadata":    { "scenario": "demo_request_submitted", "language": "fr" }
}
```
