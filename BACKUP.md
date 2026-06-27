# SmartRestau — Backup & Recovery

## Database (MongoDB Atlas)

### Prerequisites

Atlas automated backup requires **M10 or higher** cluster tier. M0/M2/M5 free tiers do not support backups.

### Setup (do this before launch)

1. In Atlas: **Cluster → Backup → Enable**
2. Choose **Continuous Cloud Backup** or **Scheduled Snapshots**
3. Set retention to minimum **7 days** (30 days recommended)
4. Enable **Point-in-Time Recovery (PITR)** if available on your tier
5. Run a test restore before going live

### Verify backups are running

Atlas dashboard → **Data Services → Clusters → [your cluster] → Backup** — confirm last snapshot timestamp is recent.

### Manual backup (emergency)

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

> `--drop` removes existing collections before restore. Omit it if you want to merge rather than replace.

### Point-in-time restore (Atlas UI)

Atlas → **Backup → Restore** → choose timestamp → select target cluster → confirm.

---

## Media Files (Cloudinary)

Menu images and logos are stored in Cloudinary, not in the database. Cloudinary provides its own backup and redundancy — no additional action required.

To export all assets: Cloudinary dashboard → **Media Library → Bulk Export**.

---

## Environment Variables

Back up your `.env` file separately from the codebase. Store it in a secrets manager (AWS Secrets Manager, 1Password, Bitwarden) — never commit it to git.

---

## Disaster Recovery Runbook

### Scenario: Database corrupted or accidentally dropped

1. Stop the production server (`SIGTERM` or platform stop)
2. Restore from Atlas backup (see above) to a point before the incident
3. Restart the server — `prisma db push` runs on startup and validates schema
4. Verify: `GET /ready` returns `{"ok":true,"db":true}`

### Scenario: Server unreachable

1. Check `GET /health` — if it returns, the process is alive but DB may be down
2. Check `GET /ready` — if `{"db":false}`, Atlas is unreachable (check IP whitelist, region, Atlas status)
3. If Atlas is down, enable Atlas maintenance mode and notify users
4. Once Atlas recovers, the server auto-reconnects (no restart needed)

### Scenario: Stripe/Moyasar webhook replay creates duplicates

All webhooks are idempotent via `ProcessedWebhook` model. A duplicate event returns HTTP 200 without processing. No manual intervention needed.

---

## Recovery Time Objectives

| Component | RTO | Notes |
|-----------|-----|-------|
| Database (Atlas) | < 1 hour | PITR restore to any minute |
| Media (Cloudinary) | < 15 min | Cloudinary SLA 99.9% |
| Application server | < 5 min | Redeploy from git |
| Full system | < 2 hours | DB restore + redeploy |
