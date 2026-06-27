# SmartRestau — Local Development Setup

> Target: up and running in under 10 minutes.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.x | https://nodejs.org |
| npm | ≥ 9.x | bundled with Node |
| MongoDB Atlas | any | https://cloud.mongodb.com (free M0 tier works) |

## Steps

### 1. Clone and install

```bash
git clone <repo-url>
cd "SaaS restau"
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the minimum required for local dev:

```bash
DATABASE_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/DBNAME?retryWrites=true&w=majority&serverSelectionTimeoutMS=5000
JWT_SECRET=any-random-string-here
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
INTERNAL_API_SECRET=dev-internal-secret
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_SECRET=dev-superadmin-secret
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
RESEND_API_KEY=re_...
NODE_ENV=development
```

All other variables are optional for local dev (payment providers, WhatsApp, n8n, etc.).

### 3. Push schema and generate client

```bash
npx prisma db push
npx prisma generate
```

### 4. (Optional) Seed demo data

```bash
DEMO_SEED=true npm run dev
```

This creates a demo cafe at subdomain `plage` with sample menu, staff, and orders. The server seeds once on boot and continues normally.

### 5. Start the dev server

```bash
npm run dev
```

The server starts at **http://localhost:3000**.

### 6. Log in

- **Admin dashboard:** http://localhost:3000/login  
  Use the magic-link flow with any email, or use the demo credentials shown on the login page.

- **Kitchen display:** http://localhost:3000/kitchen

- **POS terminal:** http://localhost:3000/pos

- **Customer QR menu:** http://localhost:3000/plage/menu (if demo seeded)

## Common Issues

| Symptom | Fix |
|---------|-----|
| `Missing required env: JWT_SECRET` | Set `JWT_SECRET` in `.env` |
| `Cannot connect to MongoDB` | Check `DATABASE_URL` — confirm Atlas IP whitelist includes your IP (or use 0.0.0.0/0 for dev) |
| `prisma generate` error | Run `npx prisma generate` after any schema change |
| `next build` error | Run `npx prisma generate` first — the build script does this automatically |
| Email not sending | Leave `RESEND_API_KEY` empty in dev — the server logs the magic link to console instead |
| Image uploads failing | Cloudinary credentials required; alternatively use the URL input field |

## Project Structure

```
├── app/                  Next.js 13 App Router pages
│   ├── [subdomain]/      Customer-facing QR menu pages
│   ├── admin/            Restaurant owner dashboard
│   ├── kitchen/          Kitchen Display System (KDS)
│   ├── pos/              Point-of-Sale terminal
│   └── superadmin/       Platform admin (SmartRestau team only)
├── src/
│   ├── routes/           Express API route handlers
│   ├── cron/             Scheduled jobs
│   ├── middleware/        Auth, validation, rate limiting
│   ├── services/         Business logic (billing, email, AI)
│   └── socket/           Socket.io event handlers
├── prisma/
│   ├── schema.prisma     MongoDB data model
│   └── seed.ts           Demo data seeder
└── docs/                 Additional documentation
```
