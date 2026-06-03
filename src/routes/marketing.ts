import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'

const router = express.Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Social channels per country: Gulf → TikTok + Snapchat, Morocco → IG + FB */
function platformsFor(country: string): string[] {
  const upper = country.toUpperCase()
  if (upper === 'SA' || upper === 'AE') return ['tiktok', 'snapchat']
  return ['instagram', 'facebook']
}

/** True when the cafe is still within its free-trial window */
function isOnTrial(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false
  return new Date() < trialEndsAt
}

// ─── POST /api/marketing/generate-video ──────────────────────────────────────
// Picks a random published dish, creates a MarketingCampaign record (pending),
// and fires the n8n webhook asynchronously. Returns immediately with the
// campaign ID so the frontend can poll /api/marketing/campaigns.

router.post('/generate-video', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!

  try {
    // ── 1. Load cafe — need country, trial state, and table count ─────────────
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: {
        id: true,
        name: true,
        country: true,
        trialEndsAt: true,
        billingStatus: true,
        tables: { where: { isActive: true }, select: { id: true } },
      },
    })

    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (cafe.tables.length === 0) {
      return res.status(400).json({
        error: 'No active tables provisioned. Add at least one table before generating promos.',
      })
    }

    // ── 2. Pick a random published product with an image ──────────────────────
    const products = await prisma.product.findMany({
      where: {
        category: { cafeId },
        status: 'published',
        isAvailable: true,
        imageUrl: { not: null },
      },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        price: true,
        imageUrl: true,
      },
    })

    if (products.length === 0) {
      return res.status(400).json({
        error: 'No published products with images found. Upload product photos first.',
      })
    }

    // Allow the caller to pin a specific productId
    let product = products[Math.floor(Math.random() * products.length)]
    if (req.body.productId) {
      const pinned = products.find(p => p.id === req.body.productId)
      if (pinned) product = pinned
    }

    // ── 3. Watermark rule: trial = watermark, paid = clean ────────────────────
    const hasWatermark = isOnTrial(cafe.trialEndsAt)
    const platforms    = platformsFor(cafe.country)

    // ── 4. Create MarketingCampaign record (status: pending) ──────────────────
    const campaign = await prisma.marketingCampaign.create({
      data: {
        cafeId,
        productId:    product.id,
        productName:  product.nameAr || product.nameEn,
        productPrice: product.price,
        imageUrl:     product.imageUrl ?? undefined,
        country:      cafe.country,
        hasWatermark,
        platforms,
        status:       'pending',
      },
    })

    // ── 5. Fire n8n webhook (non-blocking — respond to client immediately) ─────
    const n8nWebhookUrl = process.env.N8N_MARKETING_WEBHOOK_URL
    if (!n8nWebhookUrl) {
      logger.warn({ msg: 'N8N_MARKETING_WEBHOOK_URL not set — skipping webhook trigger' })
      return res.status(202).json({ campaign, warning: 'n8n webhook not configured' })
    }

    // We intentionally do NOT await this — the n8n workflow is async and will
    // call back via PATCH /api/marketing/campaigns/:id/status when done.
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId:   campaign.id,
        cafeName:     cafe.name,
        country:      cafe.country,
        productName:  campaign.productName,
        productPrice: campaign.productPrice,
        imageUrl:     campaign.imageUrl,
        hasWatermark,
        platforms,
        // n8n will use this URL to call back when the video is ready
        callbackUrl: `${process.env.NEXT_PUBLIC_SOCKET_URL || ''}/api/marketing/campaigns/${campaign.id}/status`,
      }),
    }).catch(err => logger.error({ msg: 'n8n webhook fire failed', err, campaignId: campaign.id }))

    return res.status(202).json({ campaign })
  } catch (err) {
    logger.error({ msg: 'generate-video error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/marketing/campaigns ────────────────────────────────────────────
// Returns paginated campaign history for the authenticated cafe.

router.get('/campaigns', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const limit  = Math.min(Number(req.query.limit  ?? 20), 50)
  const cursor = req.query.cursor as string | undefined

  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        productName: true,
        productPrice: true,
        imageUrl: true,
        country: true,
        caption: true,
        videoUrl: true,
        hasWatermark: true,
        status: true,
        platforms: true,
        socialLinks: true,
        createdAt: true,
      },
    })

    const hasMore = campaigns.length > limit
    const items   = hasMore ? campaigns.slice(0, limit) : campaigns
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return res.json({ items, nextCursor })
  } catch (err) {
    logger.error({ msg: 'list campaigns error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/marketing/subscription-status ──────────────────────────────────
// Returns whether the cafe is on trial + watermark status (used by the UI).

router.get('/subscription-status', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!

  try {
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { trialEndsAt: true, billingStatus: true, country: true },
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const trial = isOnTrial(cafe.trialEndsAt)
    const daysLeft = cafe.trialEndsAt
      ? Math.max(0, Math.ceil((cafe.trialEndsAt.getTime() - Date.now()) / 86_400_000))
      : 0

    return res.json({
      isTrial:     trial,
      daysLeft,
      hasWatermark: trial,
      billingStatus: cafe.billingStatus,
      country: cafe.country,
      platforms: platformsFor(cafe.country),
    })
  } catch (err) {
    logger.error({ msg: 'subscription-status error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── PATCH /api/marketing/campaigns/:id/status ───────────────────────────────
// n8n calls this webhook when the video is ready (or failed).
// Secured by a shared secret in the X-Callback-Secret header.

router.patch('/campaigns/:id/status', async (req: Request, res: Response) => {
  const secret = req.headers['x-callback-secret']
  if (!secret || secret !== process.env.MARKETING_CALLBACK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized callback' })
  }

  const { id } = req.params
  const {
    status,
    videoUrl,
    caption,
    creatomateId,
    uploadPostJobId,
    socialLinks,
    n8nExecutionId,
  } = req.body as {
    status:          string
    videoUrl?:       string
    caption?:        string
    creatomateId?:   string
    uploadPostJobId?: string
    socialLinks?:    Record<string, string>
    n8nExecutionId?: string
  }

  const allowed = ['rendering', 'published', 'failed']
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` })
  }

  try {
    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        status,
        ...(videoUrl        ? { videoUrl }        : {}),
        ...(caption         ? { caption }          : {}),
        ...(creatomateId    ? { creatomateId }     : {}),
        ...(uploadPostJobId ? { uploadPostJobId }  : {}),
        ...(socialLinks     ? { socialLinks }      : {}),
        ...(n8nExecutionId  ? { n8nExecutionId }   : {}),
      },
    })

    logger.info({ msg: 'campaign status updated', id, status })
    return res.json({ ok: true, campaign })
  } catch (err) {
    logger.error({ msg: 'campaign status update error', err, id })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
