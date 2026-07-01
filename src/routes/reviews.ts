import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import {
  getGoogleReviewLink, setGoogleReviewLink, flagNegativeReview, notifyReviewSubmitted,
  listOrderReviews, getRatingAnalytics,
} from '../reviews/ReviewService'

const router = express.Router()

// POST /api/orders/:orderId/review
// Public — validated by seatToken or tableToken (same pattern as notify-waiter).
// ≥4 stars: fires n8n webhook for social media automation.
// ≤3 stars: emits 'internal_alert' socket event to the cafe's POS room.
router.post('/api/orders/:orderId/review', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string
    const { rating, reviewText, seatToken, tableToken } = req.body as {
      rating: number
      reviewText?: string
      seatToken?: string
      tableToken?: string
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1–5' })
    }
    if (!seatToken && !tableToken) {
      return res.status(400).json({ error: 'Provide seatToken or tableToken' })
    }

    // Verify token ownership
    let order
    if (seatToken) {
      const seat = await prisma.seat.findUnique({
        where: { qrToken: seatToken },
        select: { id: true },
      })
      if (!seat) return res.status(403).json({ error: 'Invalid seatToken' })
      order = await prisma.order.findFirst({
        where: { id: orderId, seatId: seat.id },
        select: { id: true, cafeId: true, tableId: true, rating: true },
      })
    } else {
      const table = await prisma.table.findUnique({
        where: { qrToken: tableToken! },
        select: { id: true },
      })
      if (!table) return res.status(403).json({ error: 'Invalid tableToken' })
      order = await prisma.order.findFirst({
        where: { id: orderId, tableId: table.id },
        select: { id: true, cafeId: true, tableId: true, rating: true },
      })
    }

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.rating != null) {
      return res.status(409).json({ error: 'Order already reviewed' })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { rating, reviewText: reviewText ?? null },
    })

    // High-rating path: fire n8n webhook for social media automation
    let googleReviewLink: string | null = null
    if (rating >= 4) {
      const webhookUrl = process.env.N8N_WEBHOOK_URL
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, cafeId: order.cafeId, rating, reviewText }),
        }).catch((err) => logger.warn('n8n webhook failed:', err))
      }
      // K21 — funnel high ratings toward the cafe's Google review link, if configured
      googleReviewLink = await getGoogleReviewLink(order.cafeId).catch(() => null)
    }

    // Low-rating path: alert waiter via socket
    if (rating <= 3) {
      const io = req.app.get('io') as SocketIOServer | undefined
      if (io) {
        io.to(`room_${order.cafeId}`).emit('internal_alert', {
          type: 'low_rating',
          orderId,
          tableId: order.tableId,
          rating,
          reviewText,
        })
      }
      // K21 — persisted alert (the socket emit above is ephemeral; this survives
      // even if no one's watching live), reusing the existing SystemNotification model.
      await flagNegativeReview(order.cafeId, orderId, rating, reviewText).catch((err) => logger.warn('flagNegativeReview failed:', err))
    }

    await notifyReviewSubmitted(order.cafeId, orderId, rating).catch(() => undefined)

    return res.json({ success: true, googleReviewLink })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── K21 — admin endpoints ────────────────────────────────────────────────────

// GET /api/admin/reviews?minRating=&maxRating=&page=&limit=
router.get('/api/admin/reviews', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { minRating, maxRating, page, limit } = req.query as Record<string, string>
    const result = await listOrderReviews(cafeId, {
      minRating: minRating ? Number(minRating) : undefined,
      maxRating: maxRating ? Number(maxRating) : undefined,
      page:      page  ? Number(page)  : undefined,
      limit:     limit ? Number(limit) : undefined,
    })
    return res.json(result)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

// GET /api/admin/reviews/analytics?from=&to=
router.get('/api/admin/reviews/analytics', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { from, to } = req.query as Record<string, string>
    const analytics = await getRatingAnalytics(cafeId, from ? new Date(from) : undefined, to ? new Date(to) : undefined)
    return res.json(analytics)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Failed to fetch rating analytics' })
  }
})

// GET/PATCH /api/admin/reviews/google-link
router.get('/api/admin/reviews/google-link', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const link = await getGoogleReviewLink(req.admin!.cafeId)
    return res.json({ googleReviewLink: link })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Failed to fetch link' })
  }
})

router.patch('/api/admin/reviews/google-link', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { link } = req.body as { link?: string }
    if (!link?.trim()) return res.status(400).json({ error: 'link is required' })
    const updated = await setGoogleReviewLink(req.admin!.cafeId, link.trim())
    return res.json({ googleReviewLink: updated })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Failed to update link' })
  }
})

export default router
