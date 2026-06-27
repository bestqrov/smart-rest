# SmartRestau — Production Deployment Guide

> **Sprint reference:** SR-LR-002 / SR-LR-003 (Production Stability + Billing Audit)
> Last updated: 2026-06-27

---

## 1. MongoDB Atlas — Region Selection

**Rule:** Deploy the Atlas cluster in the same region as (or the region geographically closest to) your production VPS.

### Why this matters

Every database transaction is a network round-trip. Cross-region latency adds directly to user-facing response time:

| Atlas region vs VPS location | Typical RTT | p95 under 100-concurrent orders |
|---|---|---|
| Same region (e.g. both `eu-west-1`) | 2–5ms | ~200ms |
| Different region (e.g. US-East → Morocco) | 120–180ms | 4 000–5 000ms |

A single order creation involves at least 3 DB round-trips inside a transaction. At 150ms/RTT that is 450ms of pure network overhead per order — before any computation.

### Recommended regions by VPS location

| VPS provider / location | Recommended Atlas region |
|---|---|
| OVH / Paris | `eu-west-3` (Paris) or `eu-west-1` (Ireland) |
| Hetzner / Frankfurt | `eu-central-1` (Frankfurt) |
| DigitalOcean / Amsterdam | `eu-west-1` (Ireland) or `eu-central-1` (Frankfurt) |
| Railway (EU) | `eu-west-1` (Ireland) |
| Morocco / Africa | `eu-west-1` (Ireland) — closest available Atlas region |

### Steps to migrate an existing cluster

1. In Atlas: **Cluster → Modify → Provider & Region** → select target region
2. Atlas performs a live migration with no downtime (replica set rolling restart)
3. Verify: run `GET /ready` and confirm response time drops from ~1500ms to <100ms

---

## 2. Environment Variables — Required for Production

All variables below are validated at server startup. Missing required vars crash the process immediately.

```bash
# Database — see section 1 for region guidance
DATABASE_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/DBNAME?retryWrites=true&w=majority&serverSelectionTimeoutMS=5000

# JWT — generate: openssl rand -base64 48
JWT_SECRET=

# Access token lifetime (default 30 minutes, minimum 5 minutes recommended)
ACCESS_TOKEN_EXPIRY=30m

# Refresh token lifetime in days (default 30)
REFRESH_TOKEN_DAYS=30

# Your public domain (no trailing slash)
FRONTEND_URL=https://yourdomain.com

# Cloudinary (image uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend (transactional email)
RESEND_API_KEY=

# Internal service auth
INTERNAL_API_SECRET=
SUPERADMIN_EMAIL=
SUPERADMIN_SECRET=

# Runtime
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

---

## 3. Health Check Configuration

Two endpoints are available for infrastructure health monitoring.

### Endpoints

| Endpoint | Type | What it checks | Use for |
|---|---|---|---|
| `GET /health` | Liveness | Process is alive | Restart if down |
| `GET /ready` | Readiness | Process + MongoDB reachable | Route traffic |

**Always use `/ready` for load balancer routing.** Use `/health` only for the process restart check (e.g. Docker `HEALTHCHECK` or systemd `WatchdogUSec`).

### Recommended health check settings

```
Endpoint:           GET /ready
Interval:           10 seconds
Timeout:            5 seconds
Unhealthy threshold: 2 consecutive failures  → remove from rotation
Healthy threshold:   2 consecutive successes → restore to rotation
```

### nginx upstream example

```nginx
upstream smartrestau {
    server 127.0.0.1:3000;
    keepalive 32;
}

# Passive health check (nginx Plus) or use a separate active check:
server {
    location /ready {
        proxy_pass         http://smartrestau;
        proxy_read_timeout 5s;
    }
}
```

### Docker HEALTHCHECK

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=2 \
  CMD curl -sf http://localhost:3000/ready || exit 1
```

### Railway / Render / Fly.io

Set the health check path to `/ready` and the timeout to `5` seconds in the platform dashboard.

---

## 4. Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` with an ordered shutdown sequence:

1. Stop all cron jobs
2. Close HTTP server (drain in-flight requests)
3. Close Socket.io connections
4. Close MongoDB change streams
5. Disconnect Prisma (closes connection pool)

**No manual intervention required.** Kubernetes, Docker, and Railway all send `SIGTERM` before stopping a container. The server will finish serving active requests before exiting.

If a forced kill is needed use `SIGKILL` — the process exits immediately with no cleanup.

---

## 5. MongoDB Atlas — Backup Prerequisites

Atlas automated backup must be enabled before going live. Verify the following:

- [ ] Cluster tier is **M10 or higher** (M0/M2/M5 do not support backups)
- [ ] **Continuous backup** or **Scheduled snapshots** enabled in: Cluster → Backup
- [ ] Retention policy set to minimum **7 days** (30 days recommended)
- [ ] A test restore has been performed at least once before launch
- [ ] **Point-in-Time Recovery (PITR)** enabled if available on your tier

### Manual backup command (emergency)

```bash
mongodump \
  --uri="$DATABASE_URL" \
  --out=backup-$(date +%Y%m%d-%H%M%S) \
  --gzip
```

### Restore from dump

```bash
mongorestore \
  --uri="$DATABASE_URL" \
  --gzip \
  --drop \
  backup-YYYYMMDD-HHMMSS/
```

---

## 6. Cron Job Schedule

| Cron | Schedule | Responsibility |
|---|---|---|
| `dailyDebtDetection` | Daily **02:00 AM** | Detect negative-balance cafes → `PAST_DUE`; check elapsed grace periods → `SUSPENDED` |
| `nightly` | Daily **23:00** | Anti-fraud, session expiry, refresh-token purge, QR scan cleanup |
| `weeklyBilling` | **Monday 23:59** | Trial-expiry analysis — pre-generate AI billing package for cafes whose trial ends within 7 days |
| `certificationEval` | Weekly | Certification badge evaluation |

### Billing lifecycle triggered by `dailyDebtDetection`

```
Day 1  — cron detects walletBalance < 0 (trial ended)
         status → PAST_DUE
         gracePeriodEndsAt = now + 7 days
         webhook → CAFE_PAST_DUE (WhatsApp/n8n alert sent)

Days 2–7 — cron runs daily, no action (grace period still active)
           Admin can pay at any time → SuperAdmin confirms → status back to COLLECTING_DEBT

Day 8  — cron detects PAST_DUE + gracePeriodEndsAt in the past
         status → SUSPENDED  (isActive = false)
         suspendedAt = now
         webhook → CAFE_SUSPENDED
```

### Environment variables required for billing notifications

```bash
# n8n webhook that receives CAFE_PAST_DUE and CAFE_SUSPENDED events
N8N_BILLING_WEBHOOK=https://your-n8n.example.com/webhook/billing
```

If `N8N_BILLING_WEBHOOK` is not set, the cron still runs and transitions state correctly — only the WhatsApp notification is skipped.

---

## 7. First-Deploy Checklist

- [ ] Atlas cluster deployed in the correct region (see section 1)
- [ ] All required env vars set (see section 2)
- [ ] `MOYASAR_SECRET_KEY` set if Moyasar is enabled (webhook signature required)
- [ ] `STRIPE_WEBHOOK_SECRET` set if Stripe is enabled
- [ ] `N8N_BILLING_WEBHOOK` set for debt/suspension WhatsApp alerts (see section 6)
- [ ] `npm run build` completes without errors
- [ ] `npx prisma generate` run on the production server after deploy
- [ ] Server starts: `npm start` — look for `Server started` in logs
- [ ] `GET /ready` returns `{ "ok": true, "db": true }` within 5 seconds
- [ ] `GET /health` returns `{ "ok": true }` immediately
- [ ] Health check configured in load balancer / platform (see section 3)
- [ ] Atlas backup enabled (see section 5)
- [ ] Demo seed ran: `DEMO_SEED=true npm start` on first boot
- [ ] Verify cron fires: `dailyDebtDetection` at 02:00, `weeklyBilling` Monday 23:59
