---
name: verify
description: Build/launch/drive recipe for manually verifying UI changes in this repo (no test framework configured)
---

# Verifying this repo (Next.js + Express + Prisma/Mongo, POS/Comptoir surface)

No Jest/Vitest — verification is runtime observation via a live dev server.

## Launch

```bash
npm run dev   # starts Next.js + the Express API on :3000 (prisma db push runs first)
```

Wait for `✓ Compiled ... in Ns` in the log before hitting any route — hitting
a route mid-first-compile causes `_next/static/chunks/*.js` to 404 with a
misleading MIME-type console error. If you see that, it's almost always a
cold-compile race, not a real bug — reload once the server settles.

If a dev server appears to already be listening on :3000, check its `cwd`
before reusing it (`lsof -p <pid> | grep cwd`) — it may belong to a
different worktree.

## Demo login

Seeded demo cafe: subdomain `plage` ("Café de la Plage", Morocco, MAD).
Demo staff PINs (see `prisma/seed.ts`): Cashier `1234`, Waiter `2222`,
Supervisor `3333`.

The "no-PIN demo buttons" path (`/api/public/demo-staff`) only activates for
the subdomain in `DEMO_SUBDOMAIN` (`.env`, currently `welcome` — no cafe
exists under that subdomain locally), so for local verification use the PIN
form instead, not the demo-staff buttons.

`/comptoir` renders a text PIN input (`placeholder="PIN"`). `/pos` renders a
numpad (buttons `0`-`9`, no text input) — different UX by design, not a bug.

Both `/pos` and `/comptoir` gate on an open `CashierShift`: after PIN login,
if no shift is open you land on "Caisse de départ" (`Montant de départ`
number input + `Sortie prévue` **time** input, both required) before the
main screen appears.

## Driving it

No browser-automation tool is bundled. Playwright works but isn't a project
dependency — installing it into the project's own `node_modules` would
pollute `package.json`; instead:

```bash
mkdir -p /path/to/scratch/pw && cd /path/to/scratch/pw
npm init -y && npm install playwright@<version matching `npx playwright --version`>
npx playwright install chromium   # downloads to ~/Library/Caches/ms-playwright, one-time
```

Then write a `.mjs` script there (not inside the repo) that drives
`http://localhost:3000/...`. Screenshot to `/tmp/*.png` and Read them back.

## Gotchas hit during Comptoir POS verification (2026-07-06)

- A `CashierShift` left OPEN by a previous test run makes the next login
  skip straight to the main screen (no Caisse de départ) — close it first:
  `curl -X POST localhost:3000/api/pos/shift -d '{"subdomain":"plage","action":"close","pinCode":"1234","countedCash":<n>}'`.
- `/api/pos/menu` embeds product images as base64 data URIs — the payload
  is real (~180KB for 7 categories) but still resolves in ~1-2s locally;
  don't assume "0 categories rendered" after a 1.5s wait is a bug — wait
  ~3s before concluding the fetch failed.
- After merging a branch that adds Prisma schema fields, run
  `npx prisma generate` on the target branch/worktree before `tsc` — a
  stale generated client silently reports the new fields as
  type errors ("Object literal may only specify known properties...").
