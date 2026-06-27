# SmartRestau — Architecture

## Overview

SmartRestau is a **single-process monolith** that co-hosts a Next.js 13 frontend and an Express REST API.  
One `npm start` command runs everything. There is no microservice boundary to manage at launch.

```
                        ┌─────────────────────────────────────────┐
                        │          Node.js Process (Port 3000)     │
                        │                                           │
   Browser ────HTTP────►│  Express API     Next.js App Router       │
   Browser ────WS──────►│  Socket.io       (SSR + Static Pages)     │
                        │                                           │
                        │  Cron Jobs (4 scheduled tasks)            │
                        └──────────────┬────────────────────────────┘
                                       │ Prisma ORM
                                       ▼
                              MongoDB Atlas (cloud)
```

---

## Process Architecture

```
src/server.ts          Entry point — wires everything together
├── Express app
│   ├── Helmet (security headers)
│   ├── CORS (origin: FRONTEND_URL only)
│   ├── Rate limiting (auth: 10/15min, api: 60/min, optin: 5/hr)
│   ├── Request ID middleware (X-Request-Id header)
│   ├── API routes (all /api/* prefixed)
│   ├── /health  liveness probe
│   ├── /ready   readiness probe (+ DB ping)
│   └── Next.js handler (catch-all for pages)
│
├── Socket.io server
│   └── socket/handlers.ts — event registration
│
├── 4 Cron tasks
│   ├── dailyDebtDetection  (02:00 AM daily)
│   ├── nightly             (23:00 daily)
│   ├── weeklyBilling       (Monday 23:59)
│   └── certificationEval   (weekly)
│
└── Graceful shutdown
    SIGTERM/SIGINT → stop crons → drain HTTP → close WS → close streams → disconnect DB
```

---

## Data Flow

### Customer QR Order Flow

```
Customer scans QR ──► GET /api/client/menu?token=<qrToken>
                       │ resolves cafeId from qrToken
                       ▼
               Menu displayed in browser
                       │
Customer orders ──────► POST /api/orders
                         │ verifies token + prices against DB
                         │ prisma.$transaction → create Order + OrderItems
                         │ debits commission from wallet
                         ▼
                  Socket.io emit → room_<cafeId>
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Kitchen Display         Waiter App
        new_order event         new_order event
              │
        PATCH /api/kitchen/orders/:id (COOKING → READY)
              │
        Socket.io emit → order_status_updated
```

### Admin Magic Link Login Flow

```
POST /api/auth/magic-send
  │ validate email whitelist
  │ create VerificationToken (SHA-256 hashed, 15 min TTL)
  │ Resend API → email with link to /admin/magic?token=<raw>
  ▼
GET /api/auth/magic?token=<raw>
  │ hash raw token → compare with stored hash
  │ if match: create JWT (30m) + refresh token (30d, hashed in DB)
  │ store RefreshToken record
  ▼
Browser: localStorage.token + localStorage.refreshToken

POST /api/auth/refresh (when access token expires)
  │ hash incoming refresh token → lookup in DB
  │ verify not expired + not revoked
  │ issue new access token
  ▼
Continue session

POST /api/auth/logout
  │ delete RefreshToken from DB
  ▼
Session invalidated
```

### Billing Lifecycle

```
GRACE_PERIOD (free trial)
    │
    │ trial ends (trialEndsAt passes)
    ▼
COLLECTING_DEBT (commissions accumulate in wallet as negative balance)
    │
    │ daily 02:00 cron: walletBalance < 0 + trial ended
    ▼
PAST_DUE (gracePeriodEndsAt = now + 7 days)
    │
    │ admin pays → superadmin confirms PaymentRequest
    │ → status back to COLLECTING_DEBT (or GRACE_PERIOD)
    │ → BillingInvoice created (INV-YYYY-NNNNN)
    │
    │ OR: gracePeriodEndsAt passes without payment
    ▼
SUSPENDED (isActive = false, service halted)
    │
    │ superadmin manually reactivates (with optional debt clear)
    ▼
COLLECTING_DEBT
```

---

## Module Map

| Module | Pages | API Routes | Notes |
|--------|-------|-----------|-------|
| Customer QR Menu | `app/[subdomain]/menu/` | `/api/client/menu`, `/api/orders` | Public — no auth |
| Table QR | `app/[subdomain]/t/[tableNumber]/` | `/api/zones/scan` | Token-based auth |
| Kitchen Display | `app/kitchen/` | `/api/kitchen/*` | Kitchen JWT |
| POS Terminal | `app/pos/` | `/api/pos/*` | POS JWT (PIN login) |
| Waiter App | `app/waiter/` | `/api/waiters/*` | Waiter JWT |
| Staff App | `app/staff/` | `/api/pos/waiter/*` | Waiter/Staff JWT |
| Admin Dashboard | `app/admin/` | `/api/admin/*` | Admin JWT |
| SuperAdmin | `app/superadmin/` | `/api/superadmin/*` | Header-based auth |
| Catering | `app/admin/traiteur/` | `/api/traiteur/*` | Admin JWT |
| Landing / Signup | `app/landing/`, `app/signup/` | `/api/auth/magic-send` | Public |
| Demo | `app/demo/` | `/api/demo-login` | Public |

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | Next.js App Router | 13.5 |
| Backend framework | Express | 5.x |
| Database ORM | Prisma | 4.x |
| Database | MongoDB Atlas | 7.x |
| Real-time | Socket.io | 4.x |
| Auth | JWT (jsonwebtoken) | 9.x |
| Email | Resend REST API | — |
| Images | Cloudinary | 2.x |
| AI | Groq (llama-4-scout) | 1.x |
| Scheduling | node-cron | 4.x |
| Logging | Pino structured JSON | 8.x |
| Payments | Stripe + Moyasar + Mobile Money | — |
| WhatsApp | Evolution API + n8n | — |
| Styling | Tailwind CSS | 3.x |
| Animations | Framer Motion | 11.x |

---

## Key Design Decisions

**Single-process monolith** — One `npm start` serves both the API and the Next.js frontend. This avoids CORS complexity, simplifies deployment (one dyno on Railway), and is appropriate for the current traffic scale. Split when a single service needs independent scaling.

**MongoDB + Prisma** — Document model fits the menu/order tree structure well. Prisma provides type safety without the overhead of a traditional ORM. MongoDB Atlas handles replication and backups.

**Wallet commission model** — Orders debit a floating `walletBalance` on the cafe record. Negative balance triggers the billing lifecycle rather than blocking real-time order flow. This allows restaurants to operate during brief outages in payment collection.

**SHA-256 hashed tokens** — Magic links and refresh tokens are stored only as hashes. Plaintext never touches the database. Rotation invalidates all sessions.

**Webhook idempotency** — All Stripe and Moyasar webhooks are deduplicated via `ProcessedWebhook(provider, eventId)` unique constraint. Second delivery returns 200 without processing.

**Graceful shutdown** — `SIGTERM` triggers an ordered teardown: crons stop first (no new job runs), then HTTP drains (in-flight requests complete), then WebSocket closes, then DB disconnects. Zero dropped requests on standard platform redeploys.

---

## File Structure

```
/
├── app/                      Next.js pages (App Router)
│   ├── [subdomain]/          Customer-facing QR pages
│   │   ├── menu/             QR menu + ordering
│   │   └── t/[tableNumber]/  Table QR entry
│   ├── admin/                Restaurant owner dashboard (17 modules)
│   ├── kitchen/              Kitchen Display System
│   ├── pos/                  Point-of-Sale terminal
│   ├── waiter/               Waiter mobile interface
│   ├── staff/                Staff quick-access
│   └── superadmin/           Platform admin
│
├── src/
│   ├── server.ts             Entry point
│   ├── config.ts             Env var validation (fail-fast in prod)
│   ├── logger.ts             Pino structured logger
│   ├── prisma.ts             Prisma singleton
│   ├── routes/               Express route handlers (one file per domain)
│   │   └── pos/              POS-specific routes (auth-gated separately)
│   ├── middleware/            Auth guards, validation, request ID
│   ├── cron/                 Scheduled jobs (4 tasks)
│   ├── services/             Pure business logic
│   │   ├── billing.ts        Commission calculation + tier suggestion
│   │   ├── email.ts          Resend API wrapper
│   │   ├── changeStreams.ts   MongoDB change stream listeners
│   │   └── kds.ts            Kitchen display helpers
│   ├── socket/               Socket.io event handlers
│   ├── auth/                 bcrypt hash helpers
│   ├── lib/                  Shared utilities (i18n, POS i18n)
│   └── types/                TypeScript types (Order, Staff, ZoneSession)
│
├── prisma/
│   ├── schema.prisma         Data model (MongoDB)
│   └── seed.ts               Demo data seeder
│
└── docs/
    ├── API.md                All API endpoints
    ├── ARCHITECTURE.md       This file
    └── production-deployment.md  Deployment + ops guide
```

---

## Security Model

| Concern | Implementation |
|---------|---------------|
| SQL/NoSQL injection | Prisma parameterized queries — no raw string interpolation |
| XSS | Helmet CSP + Next.js default escaping |
| CSRF | JWT in localStorage (not cookies) — no CSRF surface |
| Token theft | Short-lived access tokens (30m) + hashed refresh tokens |
| Webhook replay | ProcessedWebhook idempotency table |
| Webhook forgery | HMAC-SHA256 signature verification (Stripe + Moyasar) |
| Brute force | Rate limiter: 10 auth attempts / 15 min per IP |
| Sensitive data | Pino redact config strips Authorization headers + passwords from logs |
| Secret leakage | No secrets in frontend bundle — all secret env vars are server-side only |
