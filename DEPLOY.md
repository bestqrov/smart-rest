# SmartRestau — Production Deployment

> For the full production guide including MongoDB region selection, health check configuration, cron schedules, and billing lifecycle, see [docs/production-deployment.md](docs/production-deployment.md).

## Quick Reference

### Recommended stack

| Layer | Service |
|-------|---------|
| Hosting | Railway, Render, Fly.io, or any VPS with Node 18+ |
| Database | MongoDB Atlas M10+ (same region as VPS) |
| Images | Cloudinary |
| Email | Resend |
| WhatsApp | Evolution API |
| Automation | n8n (self-hosted or cloud) |

### Deploy steps

```bash
# 1. Set all required environment variables (see ENVIRONMENT.md)

# 2. Build
npm run build          # runs prisma generate + next build

# 3. Push schema to production DB (first deploy only)
npx prisma db push

# 4. Start
npm start              # runs prisma db push + ts-node src/server.ts
```

### Health checks

Configure your load balancer or platform:

| Endpoint | Use | Settings |
|----------|-----|---------|
| `GET /ready` | Readiness (route traffic) | Interval 10s · Timeout 5s · 2 failures → remove · 2 successes → restore |
| `GET /health` | Liveness (restart check) | Interval 30s · Timeout 3s |

### First-deploy checklist

- [ ] All required env vars set (see ENVIRONMENT.md)
- [ ] `MOYASAR_SECRET_KEY` configured if Moyasar payments enabled
- [ ] `STRIPE_WEBHOOK_SECRET` configured if Stripe enabled
- [ ] `N8N_BILLING_WEBHOOK` set for debt/suspension WhatsApp alerts
- [ ] Atlas cluster in the same region as VPS
- [ ] Atlas backup enabled (M10+ required — see BACKUP.md)
- [ ] `GET /ready` returns `{"ok":true,"db":true}` within 5 seconds
- [ ] Demo seed ran: `DEMO_SEED=true npm start` on first boot

### Cron jobs (automatic — no action required)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `dailyDebtDetection` | Daily 02:00 AM | Detect negative balances → PAST_DUE / SUSPENDED |
| `nightly` | Daily 23:00 | Token expiry, QR cleanup, anti-fraud |
| `weeklyBilling` | Monday 23:59 | Trial-expiry analysis |
| `certificationEval` | Weekly | Certification badge evaluation |

All cron tasks stop gracefully on `SIGTERM`/`SIGINT`.

### Graceful shutdown

The server handles `SIGTERM` in order: stop crons → drain HTTP → close WebSockets → close change streams → disconnect DB. Kubernetes, Docker, Railway all send `SIGTERM` before stopping — no manual intervention needed.

### Rollback

```bash
# Roll back to previous deploy
git revert HEAD
npm run build && npm start

# Or restore from DB backup (see BACKUP.md)
```
