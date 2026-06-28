# SmartSuite Operations Layer

## Overview

The Operations Layer provides enterprise-grade observability and control for SmartSuite OS. It allows a SuperAdmin to understand the health of the entire platform without connecting to the server manually.

---

## Folder Structure

```
src/ops/
├── types/
│   └── index.ts                — All Operations types
├── health/
│   └── HealthService.ts        — Module health checks (healthy/warning/critical/unavailable)
├── diagnostics/
│   └── DiagnosticsService.ts  — Full platform diagnostic suite (11 checks)
├── metrics/
│   └── SystemMetrics.ts        — CPU, RAM, uptime, DB latency, job counters
├── logs/
│   └── LogService.ts           — Unified log query over AuditEntry
├── backup/
│   └── BackupService.ts        — Manual backup trigger + history (storage-agnostic)
├── runtime/
│   └── RuntimeConfig.ts        — In-memory + DB-backed runtime settings
├── security/
│   └── SecurityService.ts      — Fraud alerts, sessions, audit activity, security score
└── index.ts                    — Public API

app/superadmin/ops/
├── page.tsx                    — Operations Hub (6 cards)
├── health/page.tsx             — Module health grid
├── diagnostics/page.tsx        — Diagnostic runner with results
├── logs/page.tsx               — Unified log viewer (search, filter, paginate)
├── backups/page.tsx            — Backup management
├── runtime/page.tsx            — Runtime config editor
└── security/page.tsx           — Security overview

src/routes/
├── opsSystem.ts    — /api/superadmin/system/health, /metrics, /diagnostics
├── opsLogs.ts      — /api/superadmin/ops/logs
├── opsBackup.ts    — /api/superadmin/ops/backup
├── opsRuntime.ts   — /api/superadmin/ops/runtime
└── opsSecurity.ts  — /api/superadmin/ops/security
```

---

## Health Flow

```
GET /api/superadmin/system/health
  → getSystemHealth()
      ↓
  [parallel] checkCoreServices()     — feature flags loaded
             checkDatabase()         — prisma.$queryRaw latency
             checkAICenter()         — RUNNING/QUEUED/COMPLETED job counts
             checkMarketing()        — campaign fail rate (24h)
             checkBilling()          — active vs suspended
             checkCertification()    — certificationResult count
             checkAnalytics()        — metricSnapshot count (1h)
             checkN8N()              — HEAD request to N8N origin
             checkStorage()          — os.freemem() / os.totalmem()
      ↓
  calculateOverall(modules[]) → 'healthy' | 'warning' | 'critical'
      ↓
  { overall, modules[], checkedAt, uptimeMs }
```

### Health Status Rules
| Status | Trigger |
|--------|---------|
| `healthy` | All checks green |
| `warning` | Any module has elevated metrics (e.g. latency > 500ms, queue > 50) |
| `critical` | Any module is down or queue > 200 |
| `unavailable` | Module threw an exception during check |

Overall: `critical` if any module is `critical` or `unavailable`, else `warning` if any is `warning`, else `healthy`.

---

## Diagnostics Flow

```
POST /api/superadmin/system/diagnostics
  → runDiagnostics()
      ↓
  [parallel] 11 checks:
    Database Connection      — connectivity
    Database Latency         — connectivity (>500ms = warning)
    Memory Usage             — resources (>80% = warning, >95% = error)
    Node.js Heap             — resources
    N8N Webhook              — connectivity (env var check + HEAD request)
    AI Provider              — configuration (API key presence)
    Environment Variables    — configuration (required + optional)
    AI Job Backlog           — data (>20 queued = warning, >100 = error)
    Certification Expiry     — data
    Suspended Accounts       — data
    Security Alerts          — security (unreviewed FraudAlerts)
      ↓
  { passed, warnings, errors, checks[], recommendations[], durationMs }
```

Each check:
- Runs in isolation — one failure never prevents others
- Reports `status: 'passed' | 'warning' | 'error'`
- Includes optional `recommendation` string for actionable guidance

---

## Logging Flow

Platform logs are served from the existing `AuditEntry` collection. No duplication.

```
GET /api/superadmin/ops/logs?module=ai&severity=error&search=FAIL&page=1&limit=50
  → getLogs(filter)
      ↓
  prisma.auditEntry.findMany({ where, orderBy: timestamp desc })
      ↓
  auditToLog(row) — maps action name to severity level:
    action contains 'FAIL'/'ERROR'  → severity: 'error'
    action contains 'SUSPEND'/'OVERDUE' → severity: 'warn'
    everything else → severity: 'info'
      ↓
  { entries[], total, page, pages }
```

### Filter Parameters
| Param | Description |
|-------|-------------|
| `module` | Filter by audit module (billing, ai, certification, ...) |
| `severity` | info, warn, error (derived from action name) |
| `source` | audit, ai, billing, certification, analytics, system |
| `search` | Free-text search across action, entity, entityId, performedBy |
| `from` / `to` | ISO date range |
| `page` / `limit` | Pagination (max 200 per page) |

---

## Backup Flow

Backups are entity-count snapshots (not full DB dumps). This is intentional — it avoids cloud provider lock-in and keeps the backup trigger fast.

```
POST /api/superadmin/ops/backup/trigger
  → triggerBackup(label, triggeredBy)
      ↓
  1. Create PlatformBackup record (status: 'running')
  2. Return immediately (non-blocking)
  3. [async] collectEntityCounts() — prisma.X.count() for each model
  4. Update record: status: 'completed', entities: JSON, sizeBytes
      ↓
  { id, label, status: 'running', ... }
```

### Why storage-agnostic?
`BackupService` only writes metadata to `platform_backups`. When full backup is needed:
- Swap `collectEntityCounts()` with a mongodump call
- Write to S3/GCS/Azure Blob by implementing a `BackupProvider` interface
- Keep the rest of the flow identical

---

## Runtime Configuration

Settings are loaded from DB once on first access and cached in-memory. Writes go to both cache and DB.

```
GET /api/superadmin/ops/runtime
  → getAllSettings() → in-memory cache (DB-seeded on startup)

PATCH /api/superadmin/ops/runtime/:key
  body: { value: boolean | number | string }
  → updateSetting(key, value, email)
      ↓
  cache.set(key, value)          — instant effect, no restart needed
  prisma.runtimeSetting.upsert() — persists across restarts
```

### Built-in Settings
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `system.maintenance_mode` | boolean | false | Block non-SA traffic with 503 |
| `system.debug_mode` | boolean | false | Verbose logging |
| `ai.timeout_ms` | number | 60000 | AI request timeout |
| `ai.max_retries` | number | 3 | AI job retry count |
| `ai.job_concurrency` | number | 5 | Max concurrent AI jobs |
| `billing.grace_period_days` | number | 7 | Days from PAST_DUE to SUSPENDED |
| `certification.validity_days` | number | 90 | Cert validity window |
| `analytics.snapshot_retention_days` | number | 90 | Snapshot pruning |
| `marketing.max_campaigns_per_day` | number | 10 | Rate limit per restaurant |
| `ops.diagnostics_enabled` | boolean | true | Enable auto-diagnostics |

---

## Security Overview

Read-only aggregation — no auth system modifications.

```
GET /api/superadmin/ops/security
  → getSecurityOverview()
      ↓
  [parallel]
    prisma.activeSession.count()          → activeSessions
    prisma.fraudAlert.count(pending)      → fraudAlerts.pending
    prisma.fraudAlert.count(last 1h)      → fraudAlerts.recent
    prisma.auditEntry.count(last 24h)     → auditActivity.last24h
    prisma.auditEntry.count(last 7d)      → auditActivity.last7d
    prisma.auditEntry.groupBy(module)     → topModules
      ↓
  calculateScore() → 0–100 (deduct for pending alerts, high volume)
  detectSuspiciousPatterns() → string[] (human-readable warnings)
      ↓
  { activeSessions, fraudAlerts, auditActivity, suspiciousPatterns, securityScore }
```

### Security Score Formula
```
Start: 100
- Unreviewed fraud alerts:  -2 per alert (max -20)
- High recent alert volume: -(recentAlerts - 10) (max -15)
Floor: 0
```

---

## Frontend Pages

| Route | Description | Key Features |
|-------|-------------|--------------|
| `/superadmin/ops` | Hub | 6 cards linking to sub-pages |
| `/superadmin/ops/health` | Health grid | Color-coded module cards, overall banner, uptime |
| `/superadmin/ops/diagnostics` | Diagnostic runner | "Run Diagnostics" button, check list with recommendations |
| `/superadmin/ops/logs` | Log viewer | Search, module filter, severity filter, pagination |
| `/superadmin/ops/backups` | Backup manager | Trigger backup, history table, delete |
| `/superadmin/ops/runtime` | Runtime editor | Toggle switches for booleans, number inputs, per-row save |
| `/superadmin/ops/security` | Security overview | Score ring, fraud alerts, audit activity, suspicious patterns |

All pages:
- Dark theme (zinc-950 background)
- Arabic-first, RTL (`dir={isRTL ? 'rtl' : 'ltr'}`)
- `useSAAuth()` for auth headers
- No business logic — pure API consumers

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/superadmin/system/health` | System health check |
| GET | `/api/superadmin/system/metrics` | CPU, RAM, DB latency, job counts |
| POST | `/api/superadmin/system/diagnostics` | Run full diagnostic suite |
| GET | `/api/superadmin/ops/logs` | Query platform logs |
| GET | `/api/superadmin/ops/logs/modules` | List available log modules |
| GET | `/api/superadmin/ops/backup` | List backup history |
| GET | `/api/superadmin/ops/backup/:id` | Single backup record |
| POST | `/api/superadmin/ops/backup/trigger` | Trigger manual backup |
| DELETE | `/api/superadmin/ops/backup/:id` | Delete backup record |
| GET | `/api/superadmin/ops/runtime` | Get all runtime settings |
| PATCH | `/api/superadmin/ops/runtime/:key` | Update a runtime setting |
| GET | `/api/superadmin/ops/security` | Security overview |

All routes require `x-superadmin-secret` + `x-superadmin-email` headers.

---

## Prisma Models

### RuntimeSetting
```
id          ObjectId
key         String @unique     — e.g. 'ai.timeout_ms'
value       String              — JSON-serialized
updatedBy   String?
updatedAt   DateTime
```

### PlatformBackup
```
id          ObjectId
label       String              — human-readable label
status      String              — pending | running | completed | failed
sizeBytes   Int?
entities    String              — JSON: { cafes: N, orders: N, ... }
triggeredBy String              — SA email address
error       String?
createdAt   DateTime
completedAt DateTime?
```

---

## Future: Kubernetes Compatibility

The Operations Layer is designed to work in containerized environments:

### Health Endpoints → Kubernetes Probes
```yaml
livenessProbe:
  httpGet:
    path: /api/superadmin/system/health
    httpHeaders:
      - name: x-superadmin-secret
        value: $(SUPERADMIN_SECRET)

readinessProbe:
  httpGet:
    path: /ready              # existing Express endpoint
```

### Runtime Config → ConfigMap Integration
Replace `RuntimeConfig`'s in-memory cache with a Kubernetes `ConfigMap` watcher:
```typescript
// future: watch for ConfigMap changes and update cache
watch.watch('/api/v1/namespaces/default/configmaps/smartrestau-runtime', ...)
```

### Health Aggregation → Prometheus
`/api/superadmin/system/metrics` output can be scraped by Prometheus by adding a `/metrics` endpoint with `prom-client` that forwards the same data.

### Logs → Centralized Logging
Replace `LogService`'s AuditEntry query with an ELK/Datadog/Loki sink:
```typescript
// future LogService providers:
export function setLogProvider(provider: LogProvider): void
// Built-in: PrismaLogProvider (current)
// Future: ElasticsearchLogProvider, DatadogLogProvider
```

---

## Quality Properties

| Property | Implementation |
|----------|---------------|
| **Non-blocking** | Health checks run in parallel via `Promise.all` |
| **Fault-isolated** | Each diagnostic check catches its own errors |
| **Read-only** | All services read data only; never modify business records |
| **Provider-agnostic** | Backup, logging, metrics are all abstracted |
| **Zero duplication** | Logs read from existing `AuditEntry`; no separate log table |
| **Fast** | Health check returns in ~300ms (all checks parallel) |
