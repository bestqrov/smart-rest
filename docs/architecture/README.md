# SmartRestau OS — Architecture Documentation

> Generated: 2026-06-27 · Based on actual codebase inspection

## Index

| Document | Contents |
|---|---|
| [01-high-level.md](01-high-level.md) | System overview, module map |
| [02-module-relationships.md](02-module-relationships.md) | Detailed inter-module dependency graph |
| [03-marketing-pipeline.md](03-marketing-pipeline.md) | End-to-end marketing generation and delivery pipeline |
| [04-billing-lifecycle.md](04-billing-lifecycle.md) | Billing engine, commission model, cron jobs |
| [05-authentication-flow.md](05-authentication-flow.md) | JWT + magic link auth, middleware stack |
| [06-database-overview.md](06-database-overview.md) | Prisma (MongoDB), marketing_brain (Mongoose), collections |
| [07-external-integrations.md](07-external-integrations.md) | Gemini, n8n, Stripe, Moyasar, Cloudinary, Resend, Evolution API |
| [08-folder-architecture.md](08-folder-architecture.md) | Full repository tree with purpose of every directory |
| [09-request-lifecycle.md](09-request-lifecycle.md) | Browser → Express → middleware → service → DB → response |
| [10-future-architecture.md](10-future-architecture.md) | Certification Engine, Analytics, Marketplace placeholders |

## Stack at a Glance

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Web framework | Express 5 + Next.js 13 (App Router) |
| Primary ORM | Prisma 4 → MongoDB Atlas |
| Marketing Brain ORM | Mongoose 9 → separate `marketing_brain` DB |
| Real-time | Socket.io 4 |
| Auth | JWT (30 min) + Refresh Token (30 days) + Magic Link |
| Scheduled jobs | node-cron (4 crons) |
| AI provider | Google Gemini (active) · Claude / OpenAI / Groq / OpenRouter (stubs) |
| Email | Resend REST API |
| Payments | Stripe (Gulf) · Moyasar (Gulf) · Mobile Money (Africa) |
| Image CDN | Cloudinary |
| Automation | n8n webhooks |
| WhatsApp | Evolution API |
