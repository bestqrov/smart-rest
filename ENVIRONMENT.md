# SmartRestau — Environment Variables Reference

All variables must be set in `.env` (local dev) or as platform environment variables (production).  
Copy `.env.example` as a starting point.

Variables marked **Required** will crash the server on startup if missing in `NODE_ENV=production`.

---

## Core (Required)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | MongoDB Atlas connection string. Must include `retryWrites=true&w=majority&serverSelectionTimeoutMS=5000` |
| `JWT_SECRET` | ✅ | Signs access tokens. Generate: `openssl rand -base64 48` |
| `FRONTEND_URL` | ✅ | Public app URL, no trailing slash. E.g. `https://smartrestau.digima.cloud` |
| `INTERNAL_API_SECRET` | ✅ | Shared secret for internal service-to-service calls |
| `SUPERADMIN_EMAIL` | ✅ | Platform admin email (SmartRestau team) |
| `SUPERADMIN_SECRET` | ✅ | Platform admin API secret |
| `NODE_ENV` | ✅ | `production` or `development` |

## JWT Tuning (Optional — have defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `ACCESS_TOKEN_EXPIRY` | `30m` | Access token lifetime. Minimum recommended: `5m` |
| `REFRESH_TOKEN_DAYS` | `30` | Refresh token lifetime in days |
| `LOG_LEVEL` | `info` | Pino log level: `trace` · `debug` · `info` · `warn` · `error` |
| `PORT` | `3000` | HTTP server port |

## Frontend Public Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | WebSocket server URL (same as `FRONTEND_URL` in single-server deploy) |
| `NEXT_PUBLIC_BASE_URL` | Base URL for client-side API calls |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp number shown on landing page |

## Cloudinary — Image Uploads (Required)

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Cloud name from Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |

## Email — Resend (Required)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key (re_...). Get from resend.com |
| `RESEND_FROM` | Verified sender address. E.g. `SmartRestau <noreply@yourdomain.com>` |

## WhatsApp — Evolution API (Optional)

Used for magic-link WhatsApp delivery and n8n automation notifications.

| Variable | Description |
|----------|-------------|
| `EVOLUTION_API_URL` | Evolution API base URL |
| `EVOLUTION_INSTANCE` | Instance name |
| `EVOLUTION_API_KEY` | API key |
| `EVOLUTION_WEBHOOK_TOKEN` | Webhook verification token |

## AI — Groq (Required if using Menu AI or Recipe AI)

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key. Used by menu generation and recipe AI features |

## Automation — n8n Webhooks (Optional)

| Variable | Used by | Description |
|----------|---------|-------------|
| `N8N_BILLING_WEBHOOK` | Daily debt cron | Receives `CAFE_PAST_DUE` and `CAFE_SUSPENDED` events → sends WhatsApp alert |
| `N8N_WHATSAPP_WEBHOOK` | Auth, cron fallback | General WhatsApp notification webhook |
| `N8N_MARKETING_WEBHOOK_URL` | Marketing route | Triggers AI video generation workflow |
| `N8N_WEBHOOK_URL` | Reviews route | Fires after a customer review is submitted |
| `N8N_WEBHOOK_REVIEW_APPROVED` | Review gallery | Fires after review is approved by admin |
| `N8N_CERTIFICATION_WEBHOOK_URL` | Certification cron | Fires when a cafe earns/loses a certification badge |
| `N8N_WEBHOOK_SECRET` | Customers opt-in | Verifies n8n webhook calls via `x-n8n-secret` header |
| `NEXT_PUBLIC_N8N_REVIEW_HOOK` | Review page (browser) | Client-side review submission webhook |
| `MARKETING_CALLBACK_SECRET` | Marketing route | Verifies callbacks from the marketing automation |

## Payments — Stripe (Optional — Gulf pack)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_...). **Required** when Stripe is enabled |

## Payments — Moyasar (Optional — Gulf pack)

| Variable | Description |
|----------|-------------|
| `MOYASAR_SECRET_KEY` | Moyasar secret key. **Required** when Moyasar is enabled — signature verification is enforced |

## Payments — Mobile Money (Optional — Africa pack)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PAYMENT_BANK_NAME` | Bank name for bank transfer display |
| `NEXT_PUBLIC_PAYMENT_BANK_ACCOUNT` | Account number |
| `NEXT_PUBLIC_PAYMENT_BANK_IBAN` | IBAN |
| `NEXT_PUBLIC_PAYMENT_BANK_SWIFT` | SWIFT code |
| `NEXT_PUBLIC_PAYMENT_WU_NAME` | Western Union recipient name |
| `NEXT_PUBLIC_PAYMENT_WU_CITY` | Western Union city |
| `NEXT_PUBLIC_PAYMENT_WU_COUNTRY` | Western Union country |
| `NEXT_PUBLIC_PAYPAL_LINK` | PayPal.me link for manual payment |

## Misc / Integrations

| Variable | Description |
|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Google Places API for maps/location features |
| `POSBRIDGE_SECRET` | Shared secret for POS Bridge integration |
| `INVENTORY_WEBHOOK_SECRET` | Verifies inventory automation webhook calls |
| `DEMO_SEED` | Set to `true` to auto-seed demo data on boot |
| `DEMO_SUBDOMAIN` | Subdomain of the protected demo cafe (default: `plage`) |

---

## Security Notes

- Never commit `.env` to git — it is in `.gitignore`
- Rotate `JWT_SECRET` to invalidate all active sessions system-wide
- `SUPERADMIN_SECRET` must be kept off any frontend — it is backend-only
- `MOYASAR_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are required in production; the server rejects unsigned webhooks when they are configured
- Store production secrets in a secrets manager, not in plain text files
