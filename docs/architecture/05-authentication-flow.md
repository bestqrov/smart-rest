# Authentication Flow — SmartRestau OS

## Authentication Modes

| Mode | Who uses it | Mechanism |
|---|---|---|
| Password login | Admin (cafe owner / staff) | JWT access token + rotating refresh token |
| Magic link | Admin (passwordless) | Secure token emailed via Resend, 15-min TTL |
| QR token | Waiter QR scanning | Short-lived `WaiterQRToken` in DB |
| POS PIN | Cashier / POS | Local device PIN checked against hashed DB value |
| Public routes | Customer QR menu | No auth — scoped by `subdomain` + `tableNumber` |
| Superadmin | Internal ops | `x-superadmin-secret` + `x-superadmin-email` headers |
| Internal service | Cron-to-API | `x-internal-secret` header (`INTERNAL_API_SECRET` env) |
| n8n callbacks | Automation webhooks | `x-n8n-secret` header (`N8N_WEBHOOK_SECRET` env) |

## Standard Login Flow (Password)

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as POST /api/auth/login
    participant DB as MongoDB (Prisma)

    B->>API: { email, password, cafeId }
    API->>DB: User.findUnique({ email, cafeId })
    DB-->>API: User record
    API->>API: bcrypt.compare(password, hash)

    alt Credentials valid
        API->>API: jwt.sign({ userId, cafeId }, JWT_SECRET, { expiresIn: '30m' })
        API->>API: crypto.randomBytes(32) → refreshToken
        API->>DB: RefreshToken.create({ hash: sha256(rawToken), cafeId, userId })
        API-->>B: { accessToken, refreshToken }
        B->>B: Store tokens (memory + httpOnly cookie)
    else Invalid
        API-->>B: 401 Unauthorized
    end
```

## Magic Link Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API_REQ as POST /api/auth/magic-link/request
    participant API_VER as GET /api/auth/magic-link/verify?token=...
    participant DB as MongoDB
    participant RESEND as Resend API

    B->>API_REQ: { email }
    API_REQ->>API_REQ: Validate email domain whitelist
    API_REQ->>DB: VerificationToken.create({ hash: sha256(token), expiresAt: now+15m })
    API_REQ->>RESEND: POST /emails { to, subject, html: magic link }
    API_REQ-->>B: 200 OK (email sent)

    Note over B: User clicks link in email

    B->>API_VER: GET ?token=raw_token
    API_VER->>DB: VerificationToken.findFirst({ hash: sha256(token) })
    API_VER->>API_VER: Check expiresAt > now
    API_VER->>DB: VerificationToken.delete (one-time use)
    API_VER->>API_VER: Issue JWT + refresh token pair
    API_VER-->>B: Redirect to /admin/dashboard with tokens
```

## Token Refresh Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as POST /api/auth/refresh
    participant DB as MongoDB

    Note over B: Access token expires (30m)
    B->>API: { refreshToken: raw_token }
    API->>API: sha256(raw_token) → hash
    API->>DB: RefreshToken.findFirst({ hash, expiresAt > now })

    alt Valid refresh token
        API->>DB: RefreshToken.delete (rotate)
        API->>API: Issue new access + refresh token pair
        API->>DB: RefreshToken.create (new hash)
        API-->>B: { accessToken, refreshToken }
    else Expired or not found
        API-->>B: 401 → redirect to login
    end
```

## Middleware Stack

Every protected API route passes through one or more middleware:

```mermaid
graph LR
    REQ[Incoming Request] --> RL[Rate Limiter\nauth: 10/15min\napi: 60/min]
    RL --> RID[requestId\nX-Request-ID header]
    RID --> BODY[Body Parser\nbodyParser.json · 10mb limit]
    BODY --> MW{Route Middleware}

    MW --> AA[authorizeAdmin\nsrc/middleware/authorizeAdmin.ts\nJWT verify + cafeId scope check]
    MW --> AK[authorizeKitchen\nJWT verify + kitchen role]
    MW --> APOS[authorizePOS\nJWT verify + POS role]
    MW --> VSQ[validateSeatQR\nQR token validation]
    MW --> VL[verifyLocation\nGeo-fence check]
    MW --> RI[requireInternal\nx-internal-secret header]
    MW --> NONE[No Auth\nPublic: /menu · /demo-request]

    AA --> ROUTE[Route Handler]
    AK --> ROUTE
    APOS --> ROUTE
    VSQ --> ROUTE
    VL --> ROUTE
    RI --> ROUTE
    NONE --> ROUTE

    ROUTE --> EH[errorHandler\nsrc/middleware/errorHandler.ts\nStructured JSON error response]
```

## JWT Token Structure

```json
{
  "userId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "cafeId": "64a1b2c3d4e5f6a7b8c9d0e2",
  "iat": 1719484800,
  "exp": 1719486600
}
```

- Signed with `JWT_SECRET` (HS256)
- `expiresIn`: 30 minutes (configurable via `ACCESS_TOKEN_EXPIRY` env)
- Refresh token: 30 days (configurable via `REFRESH_TOKEN_DAYS` env)
- Stored as SHA-256 hash only — raw token never persisted

## Multi-Role Authorization

| Middleware | Token claim checked | Additional guard |
|---|---|---|
| `authorizeAdmin` | `userId + cafeId` | Order / body `cafeId` must match token |
| `authorizeKitchen` | `userId + cafeId + role=KITCHEN` | — |
| `authorizePOS` | `userId + cafeId + role=POS` | Shift must be OPEN |
| `validateSeatQR` | `WaiterQRToken` in DB | Token must not be expired |
| `requireInternal` | `x-internal-secret` header | Must match `INTERNAL_API_SECRET` env |
