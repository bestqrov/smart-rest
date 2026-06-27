# Folder Architecture — SmartRestau OS

## Repository Root

```
smartrestau/
├── app/                        # Next.js 13 App Router (UI)
├── docs/                       # Documentation
├── prisma/                     # Prisma schema + seed
├── public/                     # Static assets
├── scripts/                    # One-off and integration test scripts
├── src/                        # Express server + Marketing Brain
├── .env                        # Environment variables (gitignored)
├── .env.example                # Template for new deployments
├── next.config.js              # Next.js configuration
├── package.json
├── prisma.schema               # (→ prisma/schema.prisma)
└── tsconfig.json
```

## `app/` — Next.js Frontend

```
app/
├── [subdomain]/                # Tenant-scoped customer-facing pages
│   ├── menu/                   # QR digital menu (page.tsx + components)
│   │   ├── page.tsx            # Main menu page — reads cafeId from subdomain
│   │   ├── LanguageSwitcher.tsx
│   │   ├── ReviewPrompt.tsx
│   │   ├── SmartWifiCard.tsx
│   │   └── components/
│   │       ├── CertifiedBadge.tsx
│   │       ├── OfflineModal.tsx
│   │       └── PaymentGateway.tsx
│   ├── t/[tableNumber]/        # Table-scoped order tracking
│   │   ├── page.tsx
│   │   ├── LiveOrderTracker.tsx
│   │   └── s/[seatNumber]/     # Per-seat QR entry
│   └── event/[eventId]/        # Traiteur / event guest page
│       └── page.tsx
│
├── admin/                      # Owner / manager dashboard
│   ├── layout.tsx              # Auth guard + nav shell
│   ├── dashboard/              # KPIs, certification tracker
│   ├── menu/                   # Product & category management
│   ├── menu-gen/               # AI menu generation
│   ├── billing/                # Wallet, invoices, payment history
│   ├── financials/             # P&L, margins, expenses
│   ├── inventory/              # Stock, suppliers, purchase orders
│   ├── staff/                  # Staff management, shifts
│   ├── attendance/             # Shift history
│   ├── tables/                 # Table & zone management
│   ├── zones/                  # Zone editor
│   ├── reservations/           # Reservation calendar
│   ├── loyalty/                # Loyalty program config
│   ├── marketing/              # Marketing campaigns
│   ├── social/                 # Social media / reviews
│   ├── settings/               # Cafe profile, payments, WiFi
│   ├── onboarding/             # First-time setup wizard
│   ├── equipment/              # Equipment & maintenance
│   ├── invoices/               # Supplier invoices
│   ├── requisitions/           # Purchase requisitions
│   ├── traiteur/               # Event catering
│   │   ├── page.tsx
│   │   ├── events/[id]/
│   │   └── events/new/
│   ├── magic/                  # Magic link landing
│   └── lang-context.tsx        # i18n context provider
│
├── kitchen/                    # Kitchen Display System (KDS)
│   └── page.tsx
│
├── pos/                        # Point of Sale interface
│   └── ...
│
├── waiter/                     # Waiter mobile app
│   └── ...
│
├── supervisor/                 # Supervisor dashboard
│   └── ...
│
├── superadmin/                 # Platform superadmin panel
│   └── ...
│
├── login/                      # Auth pages
├── signup/
├── verify-success/
│
├── landing/                    # Public marketing landing page
├── demo/                       # Demo request form
├── legal/                      # Legal pages
├── privacy/
├── terms/
│
├── globals.css                 # Global Tailwind styles
└── layout.tsx                  # Root HTML shell
```

## `src/` — Express Backend

```
src/
├── server.ts                   # Entry point — Express app + Socket.io + Next.js
├── config.ts                   # JWT_SECRET and env validation
├── prisma.ts                   # Prisma client singleton
├── logger.ts                   # Pino logger singleton
│
├── auth/
│   └── hash.ts                 # bcrypt helpers (hashPassword, verifyPassword)
│
├── middleware/
│   ├── authorizeAdmin.ts       # JWT verify + cafeId scope guard
│   ├── authorizeKitchen.ts     # Kitchen role guard
│   ├── authorizePOS.ts         # POS role guard
│   ├── errorHandler.ts         # Global Express error handler
│   ├── requestId.ts            # X-Request-ID header injection
│   ├── requireInternal.ts      # x-internal-secret guard
│   ├── validate.ts             # Zod request body validation helper
│   ├── validateSeatQR.ts       # Seat QR token validation
│   └── verifyLocation.ts       # Geo-fence check
│
├── routes/                     # Express route handlers (one file per domain)
│   ├── auth.ts                 # Login · logout · magic link · refresh
│   ├── orders.ts               # Order CRUD + status transitions
│   ├── kitchen.ts              # Kitchen order view + status updates
│   ├── billRequests.ts         # Bill request lifecycle
│   ├── payment.ts              # Stripe + Moyasar + Mobile Money
│   ├── clientMenu.ts           # Public QR menu API
│   ├── publicCafe.ts           # Public cafe info + landing config
│   ├── menuAdmin.ts            # Admin menu management
│   ├── menuGeneration.ts       # AI menu / recipe generation
│   ├── tables.ts               # Table management
│   ├── zones.ts                # Zone management
│   ├── waiterCalls.ts          # Waiter call requests
│   ├── waiterQR.ts             # Waiter QR token management
│   ├── finance.ts              # Financial overview + wallet
│   ├── adminStats.ts           # KPI dashboards
│   ├── adminExpenses.ts        # Expense tracking
│   ├── adminPayroll.ts         # Payroll management
│   ├── adminWaitersPerf.ts     # Waiter performance analytics
│   ├── superadmin.ts           # Platform admin endpoints
│   ├── reservations.ts         # Reservation CRUD
│   ├── loyalty.ts              # Loyalty points + rewards
│   ├── marketing.ts            # Marketing campaign management
│   ├── demoRequests.ts         # Demo request + Marketing Brain hook
│   ├── customers.ts            # CafeCustomer + WhatsApp opt-in
│   ├── reviews.ts              # Customer reviews
│   ├── reviewGallery.ts        # Photo review gallery
│   ├── feedback.ts             # Order feedback (ratings)
│   ├── suppliers.ts            # Supplier management
│   ├── supplierInvoices.ts     # Supplier invoice tracking
│   ├── inventoryAdmin.ts       # Stock management
│   ├── requisitions.ts         # Purchase requisitions
│   ├── equipment.ts            # Equipment + maintenance
│   ├── recipes.ts              # Recipe management
│   ├── traiteur.ts             # Catering / event orders
│   ├── antiFraud.ts            # Fraud detection alerts
│   ├── landingConfig.ts        # Landing page config
│   ├── adminCertification.ts   # Certification management endpoints
│   ├── productInteractions.ts  # Product click / view tracking
│   ├── posParser.ts            # POS receipt parsing
│   ├── whatsappWebhook.ts      # Evolution API inbound webhook
│   └── pos/                    # POS-specific routes
│       ├── checkout.ts         # POS checkout flow
│       ├── checkoutBySeats.ts  # Per-seat checkout
│       ├── orders.ts           # POS order management
│       ├── shift.ts            # Cashier shift management
│       ├── supervisorTables.ts # Supervisor table overview
│       ├── tablesStatus.ts     # Real-time table status
│       ├── waiter.ts           # Waiter duty management
│       └── waiterShifts.ts     # Waiter shift tracking
│
├── services/                   # Business logic services
│   ├── billing.ts              # Commission tier calculator
│   ├── smartBilling.ts         # Per-order billing deduction
│   ├── email.ts                # Resend email delivery
│   ├── changeStreams.ts         # MongoDB Change Stream → Socket.io
│   ├── inventoryDeduction.ts   # Stock deduction on order complete
│   ├── kds.ts                  # KDS event emission
│   └── mobileMoneyQR.ts        # Mobile money QR generation
│
├── cron/                       # Scheduled jobs
│   ├── weeklyBilling.ts        # Mon 23:59 — trial expiry analysis
│   ├── dailyDebtDetection.ts   # Daily 02:00 — debt sweep + alerts
│   ├── nightly.ts              # Daily 03:00 — housekeeping
│   └── certificationEval.ts   # 1st of month 02:00 — cert evaluation
│
├── socket/
│   └── handlers.ts             # Socket.io room management + auth
│
├── hooks/
│   └── useZoneSocket.ts        # Zone socket hook (server-side)
│
├── lib/
│   ├── i18n.ts                 # Server-side i18n (ar/fr/en/es)
│   └── posI18n.ts              # POS-specific translations
│
├── types/
│   ├── order.ts                # Order type extensions
│   ├── staff.ts                # Staff type extensions
│   └── zone-session.ts         # Zone session types
│
└── marketing-brain/            # Marketing Brain (isolated module)
    ├── index.ts                # Public API surface (barrel export)
    ├── connection.ts           # Mongoose connection (idempotent)
    │
    ├── MarketingGenerationService.ts   # Phase B: end-to-end generation
    ├── CampaignOrchestratorService.ts  # Phase C: execution scheduling
    │
    ├── decision-engine/        # Phase A: deterministic scenario selection
    │   ├── DecisionEngine.ts
    │   ├── DecisionContext.ts
    │   ├── DecisionResult.ts
    │   ├── RuleEvaluator.ts
    │   ├── ConfidenceScore.ts
    │   └── index.ts
    │
    ├── strategy/               # Phase A: outreach strategy planning
    │   ├── StrategyEngine.ts
    │   ├── ChannelPlanner.ts
    │   ├── TimingPlanner.ts
    │   ├── SequencePlanner.ts
    │   ├── EscalationPlanner.ts
    │   ├── StopConditions.ts
    │   ├── StrategyContext.ts
    │   ├── StrategyResult.ts
    │   └── index.ts
    │
    ├── prompt-builder/         # Phase A: AI prompt assembly
    │   ├── PromptBuilder.ts
    │   ├── SystemPromptBuilder.ts
    │   ├── UserPromptBuilder.ts
    │   ├── VariableInterpolator.ts
    │   ├── PromptValidator.ts
    │   ├── PromptVersion.ts
    │   ├── PromptContext.ts
    │   ├── PromptResult.ts
    │   └── index.ts
    │
    ├── generation/             # Phase A: pre-flight + output validation pipeline
    │   ├── GenerationPipeline.ts
    │   ├── SafetyChecks.ts
    │   ├── ComplianceValidator.ts
    │   ├── BrandValidator.ts
    │   ├── OutputValidator.ts
    │   ├── RetryPolicy.ts
    │   ├── PipelineContext.ts
    │   ├── PipelineResult.ts
    │   └── index.ts
    │
    ├── providers/              # Phase A: AI provider abstraction
    │   ├── AIProvider.ts           # Interface definition
    │   ├── AIProviderManager.ts    # Orchestration + fallback
    │   ├── ProviderRegistry.ts     # Provider registration store
    │   ├── ProviderSelector.ts     # Priority-based selection
    │   ├── ProviderErrors.ts       # Error hierarchy (9 error types)
    │   ├── ProviderConfig.ts       # Config type definitions
    │   ├── UsageTracker.ts         # Usage hook system
    │   ├── adapters/
    │   │   ├── GeminiAdapter.ts    # ✅ Active
    │   │   ├── ClaudeAdapter.ts    # 🔜 Stub
    │   │   ├── OpenAIAdapter.ts    # 🔜 Stub
    │   │   ├── GroqAdapter.ts      # 🔜 Stub (SDK installed)
    │   │   └── OpenRouterAdapter.ts# 🔜 Stub
    │   └── index.ts
    │
    ├── automation/             # Phase D: execution delivery
    │   ├── AutomationEngineService.ts  # Polling, retry, audit
    │   ├── providers/
    │   │   ├── DeliveryProvider.ts     # Interface + DeliveryResult type
    │   │   └── N8nAdapter.ts           # ✅ Active n8n webhook adapter
    │   └── models/
    │       └── DeliveryAuditLog.ts     # Mongoose audit log model
    │
    ├── models/                 # Mongoose models (marketing_brain DB)
    │   ├── Language.ts
    │   ├── Country.ts
    │   ├── BusinessType.ts
    │   ├── Persona.ts
    │   ├── Scenario.ts
    │   ├── Objection.ts
    │   ├── MessageTemplate.ts
    │   ├── FollowupSequence.ts
    │   ├── AIRule.ts
    │   ├── Variable.ts
    │   ├── TemplatePerformance.ts
    │   ├── MarketingGeneration.ts
    │   ├── CampaignExecution.ts
    │   └── index.ts
    │
    ├── knowledge/              # Knowledge layer (country/persona/scenario profiles)
    │   ├── CountryKnowledgeService.ts
    │   ├── PersonaKnowledgeService.ts
    │   ├── ScenarioKnowledgeService.ts
    │   ├── ObjectionKnowledgeService.ts
    │   ├── BusinessTypeKnowledgeService.ts
    │   ├── cache.ts
    │   ├── types.ts
    │   ├── profiles/
    │   │   ├── country.ts      # Cultural norms, contact channels per country
    │   │   ├── persona.ts      # Owner persona profiles
    │   │   ├── scenario.ts     # Scenario metadata
    │   │   ├── businessType.ts # Business type profiles
    │   │   └── objection.ts    # Objection handling
    │   └── index.ts
    │
    ├── selectors/              # DB query layer for Decision Engine
    │   ├── ScenarioSelector.ts
    │   ├── TemplateSelector.ts
    │   ├── AIRuleSelector.ts
    │   ├── FollowupSelector.ts
    │   ├── VariableSelector.ts
    │   └── index.ts
    │
    ├── services/               # Legacy service layer (Sprint 1–2)
    │   ├── DecisionEngine.ts
    │   ├── PromptBuilder.ts
    │   ├── TemplateSelector.ts
    │   ├── VariableResolver.ts
    │   ├── AIRuleResolver.ts
    │   ├── FollowupPlanner.ts
    │   ├── Validators.ts
    │   └── index.ts
    │
    ├── validators/             # Input validators
    │   ├── DecisionValidator.ts
    │   ├── VariableValidator.ts
    │   └── index.ts
    │
    ├── types/                  # Shared Marketing Brain types
    │   └── index.ts
    │
    └── seed/                   # MongoDB seed data
        ├── index.ts            # seedMarketingBrain() orchestrator
        ├── languages.ts
        ├── countries.ts
        ├── businessTypes.ts
        ├── personas.ts
        ├── scenarios.ts
        ├── objections.ts
        ├── messageTemplates.ts
        ├── followupSequences.ts
        ├── aiRules.ts
        └── variables.ts
```

## `prisma/` — Data Layer

```
prisma/
├── schema.prisma               # 50+ models, MongoDB provider
└── seed.ts                     # Demo data seed (Morocco cafe)
```

## `scripts/` — Dev & Test Scripts

```
scripts/
├── marketing-brain-e2e.ts      # 9-step smoke test (Decision → Gemini → Validate)
├── marketing-brain-integration.ts  # Phase B integration test (36 assertions)
├── marketing-brain-campaign.ts     # Phase C integration test (Campaign Orchestrator)
└── marketing-brain-automation.ts   # Phase D integration test (54 assertions)
```

## `docs/` — Documentation

```
docs/
├── API.md                      # REST API reference
├── ARCHITECTURE.md             # Legacy architecture notes
├── demo-accounts.md            # Demo account credentials
├── n8n-env-vars.md             # n8n environment variable guide
├── n8n-*.json                  # n8n workflow exports
├── production-deployment.md    # VPS deployment guide
├── superpowers/                # Implementation plans (internal)
└── architecture/               # ← You are here
    ├── README.md
    ├── 01-high-level.md
    ├── 02-module-relationships.md
    ├── 03-marketing-pipeline.md
    ├── 04-billing-lifecycle.md
    ├── 05-authentication-flow.md
    ├── 06-database-overview.md
    ├── 07-external-integrations.md
    ├── 08-folder-architecture.md   ← this file
    ├── 09-request-lifecycle.md
    └── 10-future-architecture.md
```
