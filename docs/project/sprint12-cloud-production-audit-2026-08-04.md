# Sprint 12 Cloud Production Audit

**Date:** 2026-08-04
**Scope:** Production environment configuration · Deployment readiness (incl. Docker/Coolify) · Database reliability · API availability · Logging & monitoring readiness
**Method:** Read-only code audit. No code was modified.

---

## PASS/FAIL

| Area | Verdict |
|---|---|
| 1. Production environment configuration | **FAIL** — NODE_ENV has no fail-safe |
| 2. Deployment readiness (incl. Docker/Coolify) | **FAIL** — no Dockerfile, no Node version pin |
| 3. Database reliability | PASS (one low-impact P2 gap) |
| 4. API availability | PASS |
| 5. Logging and monitoring readiness | **FAIL** — no error alerting |

**Overall: FAIL** — no P0 (nothing catastrophic), but three P1s should close before this is called cloud-production-ready, particularly given the explicit question about Docker/Coolify.

---

## Findings

### P1-A — `NODE_ENV` has no fail-safe; a missing/misspelled value silently serves Next.js dev mode in production
**Evidence:** `src/server.ts:146` — `const dev = process.env.NODE_ENV !== 'production'`. This is the *only* gate between production and dev mode (`nextApp = next({ dev, dir: '.' })`). If the platform's env var UI simply doesn't have `NODE_ENV=production` set (a one-checkbox mistake, or a fresh Coolify service that doesn't inherit it by default), the app boots successfully, passes all other startup checks (`src/config.ts` doesn't validate `NODE_ENV` itself), and serves unminified dev-mode Next.js — slower, exposes React dev warnings/stack traces, no production optimizations. No crash, no log warning distinguishes this from a correct boot.
**Risk:** Silent production misconfiguration with no signal — this is exactly the class of issue "add a fail-fast startup check" (already the pattern used for `JWT_SECRET`/`DATABASE_URL` etc. in `src/config.ts:4-15`) is meant to prevent, but `NODE_ENV` itself was never added to that list.
**Recommended fix:** In `src/config.ts`, add a startup check: if `NODE_ENV` is not exactly `'production'` and no explicit `ALLOW_DEV_MODE`-style override is set, log a loud warning (or throw, depending on how strict launch wants to be) — at minimum, log `logger.warn` at boot stating which mode is active, so it's visible in the first lines of every deploy's logs.
**Estimated effort:** Small (1 hour).

---

### P1-B — No Dockerfile exists; Docker/Coolify compatibility is unverified, not confirmed
**Evidence:** Repo-wide search (`find . -iname "*docker*"` excluding `node_modules`) found **zero** `Dockerfile`, `docker-compose.yml`, or `.dockerignore` anywhere. The only build config present is `nixpacks.toml:1-8` (a Railway-style buildpack config: `npm ci --include=dev` → `npm run build` → `npm run start`). `docs/production-deployment.md:122-127` documents a `Docker HEALTHCHECK` snippet as *guidance for a Dockerfile you'd write*, but no such file exists to put it in — the doc's own Docker section is aspirational, not implemented. Coolify *does* support nixpacks as a build strategy, so this doesn't mean deployment is impossible — but it means Docker/Coolify compatibility has never actually been exercised or confirmed in this repo, despite being documented as a target platform pattern (VPS-oriented language throughout `.env.example` and `docs/production-deployment.md`).
**Compounding gap:** `package.json` has no `engines.node` field. Nixpacks auto-detects a Node version when none is pinned — this can silently drift between builds as nixpacks' own defaults update, which is a reproducibility risk independent of Docker vs. nixpacks (affects Railway too, but doubly relevant if Coolify's nixpacks detection differs from Railway's).
**Risk:** If Coolify is the actual target platform (the question that prompted this audit implies it might be), there is no verified, tested path to deploy this app there today — only an untested assumption that nixpacks-based build will work identically to Railway's.
**Recommended fix:** Either (a) confirm and document that Coolify will be configured to use the nixpacks build pack (matching what already works on Railway) and pin `"engines": { "node": ">=20 <21" }` in `package.json` to lock the version nixpacks selects, or (b) if Coolify's Docker-native path is preferred, add a minimal multi-stage `Dockerfile` (build stage: `npm ci && npx prisma generate && npm run build`; runtime stage: copy build output + `node_modules`, `CMD ["npm", "run", "start"]`, `EXPOSE 3000`) plus a `HEALTHCHECK` matching the snippet already written in the docs. Either path also needs the `engines.node` pin.
**Estimated effort:** Small if going the nixpacks+engines-pin route (1-2 hours); Medium if writing a real Dockerfile (0.5 day, plus one real deploy test).

---

### P1-C — No error-tracking/alerting integration; production crashes are only visible to someone actively reading logs
**Evidence:** `grep -rli sentry|datadog|newrelic` across `src/` and `package.json` found only a comment placeholder — `src/components/ErrorBoundary.tsx:20`, `// Client-side reporting can be added here (Sentry/Logs)` — never implemented. No such dependency exists in `package.json`. Logging itself is solid (`src/logger.ts` — structured pino JSON to stdout, correct for Coolify's log viewer, sensitive-field redaction configured) but there is no mechanism that pushes a notification to a human when something goes wrong — only the `/health`/`/ready` endpoints (`src/server.ts:308-322`, confirmed present and correctly differentiated in the prior audit pass) exist, and those only help if the hosting platform is configured to poll them and auto-restart on failure — they don't alert anyone.
**Risk:** For a live pilot restaurant, a crash or a spike in 500s during dinner rush would be invisible until a human happens to check logs or a restaurant owner complains. No mean-time-to-detection guarantee at all right now.
**Recommended fix:** At minimum, wire a lightweight alerting hook (e.g. a `logger.error` → webhook-to-Slack/WhatsApp bridge reusing the existing `N8N_BILLING_WEBHOOK`-style pattern already used for billing alerts) for unhandled errors and process crashes. A full APM tool (Sentry etc.) is a larger integration and can follow post-pilot, but *some* automated "something broke" signal should exist before a real restaurant depends on this daily.
**Estimated effort:** Small for a webhook-based alert on crash/5xx-spike (0.5 day); Medium-Large for a full Sentry integration (not required for launch).

---

### P2 Improvements

| # | Issue | Evidence | Fix direction | Effort |
|---|---|---|---|---|
| P2-1 | `ecosystem.config.js` is dead configuration — not referenced by `package.json` scripts, `nixpacks.toml`, or any doc; `pm2` isn't even a dependency. The earlier Sprint 12 audit's "single-instance" finding cited this file, but `npm start` never invokes PM2 — actual instance-count enforcement is whatever the hosting platform's replica setting is (Coolify/Railway service config), not this file. | `package.json` scripts (no `pm2`), `ecosystem.config.js` (unreferenced) | Either wire it up for real (if PM2 is actually wanted) or delete it to stop it misleading future ops work | Small (1 hour) |
| P2-2 | MongoDB change-stream (price sync) has no resume/reconnect logic on error — `stream.on('error', ...)` only logs. Low impact: a route-level `price_updated` emit (`src/routes/menuAdmin.ts:153-155`) already covers the same event on the primary code path, so this is a redundant/defense-in-depth channel going silently dark, not a functional break. | `src/services/changeStreams.ts:84-86` vs. `src/routes/menuAdmin.ts:153-155` | Add a resume-with-`resumeToken` retry loop, or accept the redundant-channel risk as-is | Small (2-3 hours) |
| P2-3 | No wait/retry before `prisma db push` at boot — if MongoDB is momentarily unreachable at the exact boot instant, the process exits rather than retrying. Only relevant if self-hosting MongoDB as a sibling container (Atlas, the documented default, is external and doesn't share a startup race with the app container). | `package.json:6` (`"start": "prisma db push && ts-node ..."`) | Add a small retry-with-backoff wrapper around the `db push` step if self-hosted Mongo topology is ever used | Small (2-3 hours), only if self-hosted Mongo is adopted |
| P2-4 | `FRONTEND_URL` isn't validated to actually be an `https://` URL — HSTS/upgrade-insecure-requests are enforced assuming a TLS-terminating reverse proxy sits in front, which is correct for Coolify's typical Traefik setup, but nothing in code catches an accidental `http://` misconfiguration | `src/server.ts:188-195` | Add a startup warning if `FRONTEND_URL` doesn't start with `https://` and `NODE_ENV===production` | Small (<1 hour) |
| P2-5 | No log rotation/retention policy in the app itself | `src/logger.ts` | Not the app's responsibility under Docker/Coolify (platform handles container log rotation) — informational only, no action needed | None |

---

## Verified Working (re-confirmed this pass, no changes since the prior Sprint 12 audit)

- **Secrets exposure**: `.env` is gitignored (`.gitignore`) and confirmed via `git log --all -- .env` to have **never** been committed — only `.env.example` (template, no real values) is tracked.
- **Required env var fail-fast**: `src/config.ts:4-15` throws at startup listing every missing var among `JWT_SECRET, DATABASE_URL, SUPERADMIN_SECRET, SUPERADMIN_EMAIL, FRONTEND_URL, CLOUDINARY_*, RESEND_API_KEY, INTERNAL_API_SECRET`.
- **Container networking correctness**: binds `0.0.0.0` not `localhost` (`src/server.ts:405`), reads `PORT` from env with a sane fallback (`server.ts:359`), and sets `app.set('trust proxy', 1)` (`server.ts:156`) — all three are exactly what's needed to run correctly behind Coolify's Traefik reverse proxy or any container platform's port mapping.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` correctly execute the full documented sequence (crons stop → HTTP drains → sockets close → change streams close → Prisma disconnects) — read the actual handler code, not just the doc comment, confirms this.
- **CORS**: locked to a single explicit origin from `FRONTEND_URL`, fails closed (throws) in production if unset — no wildcard, no reflected-origin pattern.
- **Security headers**: Helmet applies HSTS (1 year, includeSubDomains, preload) + CSP + frame-options + upgrade-insecure-requests globally (both API and Next.js page responses), assuming correct platform-level TLS termination.
- **Prisma connection handling**: singleton client (`src/prisma.ts`) used everywhere in the running process; no risk of connection-pool exhaustion from duplicate client instances.
- **Logging fundamentals**: structured JSON to stdout via pino (correct for container log aggregation), sensitive-field redaction configured (`password`, `token`, `pinCode`, etc.).
- **No hardcoded secrets** in production code (reconfirmed via grep for common secret patterns).

---

## Launch Impact

None of the three P1s found here are launch-blocking in the sense of "the app won't run" — the current known-working deployment path (Railway via nixpacks, `NODE_ENV=production` set correctly in that platform's dashboard today) is presumably fine as-is. The impact is specifically on **the question this audit was asked to answer**: is Docker/Coolify compatibility confirmed? No — it's untested, and two of the three P1s (NODE_ENV fail-safe, missing engines pin) are exactly the kind of gap that surfaces as a confusing failure *during* a first Coolify deployment attempt rather than being caught in review beforehand. The third (no error alerting) is a standing operational risk independent of which platform is used, and matters more once a real restaurant depends on this daily.

**Recommendation**: before attempting an actual Coolify deployment, close P1-A (NODE_ENV fail-safe) and P1-B (pin `engines.node`, decide nixpacks-vs-Dockerfile explicitly) — both are small, and closing them first turns "let's try deploying to Coolify and see what breaks" into a much more predictable exercise. P1-C (alerting) can follow in parallel or immediately after, before the pilot restaurant's first live service.
