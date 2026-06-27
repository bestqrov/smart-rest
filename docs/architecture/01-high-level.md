# High-Level Architecture — SmartRestau OS

## System Overview

SmartRestau OS is a multi-tenant SaaS platform for food & beverage businesses in North Africa and the Gulf region. Each tenant (Cafe) is identified by a `subdomain` and isolated at the data layer via `cafeId` scoping on every query.

```mermaid
graph TB
    subgraph CLIENT["Client Layer"]
        B1[Admin Dashboard<br/>app/admin/**]
        B2[Customer QR Menu<br/>app/subdomain/menu]
        B3[Kitchen Display<br/>app/kitchen]
        B4[POS Interface<br/>app/pos]
        B5[Waiter App<br/>app/waiter]
        B6[Superadmin Panel<br/>app/superadmin]
    end

    subgraph SERVER["Server Layer (Express + Next.js)"]
        GW[API Gateway<br/>Express 5<br/>Helmet · CORS · Rate Limiter · Request ID]
        WS[Socket.io<br/>Real-time Events<br/>KDS · POS · Menu]
    end

    subgraph CORE["Restaurant Core"]
        OE[Order Engine]
        POS[POS Engine]
        KDS[Kitchen Display Service]
        RES[Reservations]
        LOY[Loyalty]
        INV[Inventory]
        PAY[Payment Gateway]
    end

    subgraph MB["Marketing Brain"]
        DE[Decision Engine]
        SE[Strategy Engine]
        PB[Prompt Builder]
        GEN[Generation Pipeline]
        AIP[AI Provider Manager]
        MG[MarketingGenerationService]
        CO[Campaign Orchestrator]
        AE[Automation Engine]
    end

    subgraph BE["Billing Engine"]
        BC[Commission Calculator]
        BD[Debt Detector]
        BW[Wallet Manager]
        BI[Invoice System]
    end

    subgraph CE["Certification Engine"]
        CV[Metrics Evaluator]
        CB[Badge Manager]
    end

    subgraph DB["Data Layer"]
        PRIS[(Prisma ORM<br/>MongoDB Atlas<br/>main database)]
        MONG[(Mongoose<br/>marketing_brain<br/>database)]
    end

    subgraph EXT["External Services"]
        GEMINI[Google Gemini]
        N8N[n8n Automation]
        STRIPE[Stripe]
        MOY[Moyasar]
        CLD[Cloudinary]
        RES2[Resend]
        EVO[Evolution API<br/>WhatsApp]
    end

    CLIENT --> GW
    GW --> CORE
    GW --> MB
    GW --> BE
    GW --> CE
    GW <--> WS
    CORE --> DB
    MB --> DB
    MB --> MONG
    BE --> DB
    CE --> DB
    MB --> EXT
    CORE --> EXT
    BE --> EXT
    CE --> N8N
```

## Module Inventory

| Module | Status | Purpose |
|---|---|---|
| **Restaurant Core** | ✅ Live | Orders, POS, KDS, tables, reservations, inventory, loyalty |
| **Marketing Brain** | ✅ Live (Phase A–D) | AI-driven lead generation and campaign delivery |
| **Billing Engine** | ✅ Live | Per-order commission, wallet, debt detection, invoicing |
| **Certification Engine** | ✅ Live | Monthly metrics evaluation → Smart Resto Certified badge |
| **AI Center** | ⚙️ Partial | Gemini active; Claude / OpenAI / Groq / OpenRouter as stubs |
| **Analytics** | 🔜 Planned | Cross-tenant insights, cohort analysis, revenue dashboards |
| **Marketplace** | 🔜 Future | Third-party app store for SmartRestau extensions |

## Deployment Topology

```mermaid
graph LR
    DNS[DNS / Cloudflare<br/>Wildcard *.smartrestau.com] --> VPS
    subgraph VPS["VPS (Ubuntu)"]
        PM2[PM2 Process Manager]
        APP[Node.js App<br/>Port 3000]
        PM2 --> APP
    end
    APP --> ATLAS[(MongoDB Atlas<br/>Shared Cluster)]
    APP --> N8N_SRV[n8n Server]
    APP --> EXT_APIS[External APIs<br/>Gemini · Stripe · Resend · ...]
```

- Single VPS running PM2 with the Node.js process
- Next.js SSR served by the same process on port 3000
- MongoDB Atlas handles primary data — replica set enables Change Streams
- `marketing_brain` is a separate database on the same Atlas cluster
- n8n runs as a separate service (self-hosted or n8n Cloud)
