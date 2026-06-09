# Smart Resto n8n — Environment Variables & Credentials Checklist

Set these in **n8n Settings → Variables** (or as Docker env vars if self-hosting).

---

## Shared across all workflows

| Variable | Example | Where to get it |
|---|---|---|
| `API_BASE_URL` | `https://api.smartrestau.digima.cloud` | Your Coolify Express service URL |
| `INTERNAL_API_SECRET` | `sr_internal_abc123xyz` | Generate with `openssl rand -hex 32`; set in Express too |
| `QR_ENGINE_URL` | `http://qr-service:8000` | Internal Coolify network hostname |

---

## W1 — WhatsApp (Twilio)

| Variable | Note |
|---|---|
| `TWILIO_ACCOUNT_SID` | console.twilio.com → Account Info |
| `TWILIO_AUTH_TOKEN` | console.twilio.com → Account Info |
| `TWILIO_WHATSAPP_NUMBER` | Without `+`, e.g. `14155238886` (sandbox) or your approved number |

**n8n Credential to create:**
- Type: `HTTP Basic Auth`
- Name: `Twilio Basic Auth`
- Username: `{{ TWILIO_ACCOUNT_SID }}`
- Password: `{{ TWILIO_AUTH_TOKEN }}`

**Alternative (no Twilio approval):** WATI.io — POST `https://app.wati.io/api/v1/sendTemplateMessage` with `Authorization: Bearer <WATI_API_TOKEN>`.

---

## W2 — Cloudinary

| Variable | Note |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Settings |
| `CLOUDINARY_API_KEY` | Used as HTTP Basic Auth **username** |
| `CLOUDINARY_API_SECRET` | Used as HTTP Basic Auth **password** |

**n8n Credential to create:**
- Type: `HTTP Basic Auth`
- Name: `Cloudinary Basic Auth`
- Username: `{{ CLOUDINARY_API_KEY }}`
- Password: `{{ CLOUDINARY_API_SECRET }}`

**Upload presets to create in Cloudinary dashboard:**
- `smartresto_qr` — folder: `qr-codes`, unsigned
- `smartresto_reviews` — folder: `review-photos`, unsigned

---

## W3 — Social Media (Per-Cafe, stored in Cafe document)

These are stored **per cafe** in MongoDB (not as global env vars).
Add the following fields to the `Cafe` Prisma model:

```prisma
fbPageId          String  @default("")
fbAccessToken     String  @default("")  // long-lived FB page token (~60 days)
igUserId          String  @default("")  // Instagram Business account ID
tiktokAccessToken String  @default("")  // TikTok OAuth2 access token
snapAccessToken   String  @default("")  // Snapchat OAuth2 access token
```

**Smart Resto's own channels** (global env vars for free-tier posts):

| Variable | Note |
|---|---|
| `SMARTRESTO_FB_PAGE_ID` | Smart Resto's own Facebook Page numeric ID |
| `SMARTRESTO_FB_ACCESS_TOKEN` | Long-lived page access token for Smart Resto |

---

## New Express Routes Required

Add these to your Express backend for the n8n workflows to call:

```
POST  /api/v1/review-gallery
      Body: { cafeId, reservationId, imageUrl, qrCodeUrl, reviewText,
              rating, userConsentGranted, brandColor, moderationStatus }
      Action: create ReviewGallery + increment cafe.totalReservationsCount
              + update cafe.logoAccentColor + create SystemNotification

GET   /api/v1/review-gallery/:id/full
      Action: ReviewGallery.findUnique({ include: { cafe: true } })

PATCH /api/v1/review-gallery/:id/published
      Body: { isPublishedToClientSocial, publishedToClientSocialAt,
              isPublishedToSmartRestoBlog, publishedToSmartRestoBlogAt,
              moderationStatus, n8nExecutionId }

POST  /api/v1/blog/posts
      Body: { title, slug, body, city, cafeName, imageUrl,
              rating, seoKeywords[], cafeId, reviewGalleryId }

POST  /api/v1/notifications/manager
      Body: { cafeId, type, title, body, refId, refType }
      Action: create SystemNotification in MongoDB
```

---

## Webhook URLs (set in your Express backend)

After activating the n8n workflows, copy the webhook URLs from n8n and set them in your Express `.env`:

```env
N8N_WEBHOOK_RESERVATION_COMPLETED=https://n8n.yourdomain.com/webhook/reservation-completed
N8N_WEBHOOK_REVIEW_APPROVED=https://n8n.yourdomain.com/webhook/review-approved
```

The review-submitted webhook URL goes into your Next.js review page:
```env
NEXT_PUBLIC_N8N_REVIEW_HOOK=https://n8n.yourdomain.com/webhook/review-submitted
```
