import { Router, Request, Response } from 'express'
import prisma from '../prisma'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requireInternal } from '../middleware/requireInternal'

const router = Router()

// ── n8n W2: Create ReviewGallery after review form submission ─────────────────
// Called by n8n W2 — "HTTP — Create ReviewGallery + Update Cafe"
router.post('/api/v1/review-gallery', requireInternal, async (req: Request, res: Response) => {
  try {
    const {
      cafeId,
      reservationId,
      imageUrl,
      qrCodeUrl,
      reviewText,
      rating,
      userConsentGranted,
      brandColor,
      moderationStatus = 'pending',
    } = req.body

    if (!cafeId) return res.status(400).json({ error: 'cafeId required' })

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.reviewGallery.create({
        data: {
          cafeId,
          reservationId: reservationId ?? undefined,
          imageUrl: imageUrl ?? undefined,
          qrCodeUrl: qrCodeUrl ?? undefined,
          reviewText: reviewText ?? '',
          rating: Number(rating ?? 5),
          userConsentGranted: Boolean(userConsentGranted),
          moderationStatus,
        },
      })

      // Increment total reservations counter + save extracted brand color
      await tx.cafe.update({
        where: { id: cafeId },
        data: {
          totalReservationsCount: { increment: 1 },
          ...(brandColor ? { logoAccentColor: brandColor } : {}),
        },
      })

      // System notification so manager sees badge in dashboard
      await tx.systemNotification.create({
        data: {
          cafeId,
          type: 'NEW_REVIEW',
          title: 'تقييم جديد ⭐',
          body: `${rating ?? 5}/5 — ${(reviewText ?? '').slice(0, 60) || '(صورة فقط)'}`,
          refId: created.id,
          refType: 'ReviewGallery',
        },
      })

      return created
    })

    res.json({ reviewGalleryId: review.id })
  } catch (err: any) {
    console.error('[reviewGallery] POST error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── n8n W3: Full ReviewGallery + Cafe (for social posting) ───────────────────
// Called by n8n W3 — "HTTP — Fetch ReviewGallery + Cafe"
router.get('/api/v1/review-gallery/:id/full', requireInternal, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const review = await prisma.reviewGallery.findUnique({
      where: { id },
      include: { cafe: true },
    })
    if (!review) return res.status(404).json({ error: 'Not found' })
    res.json(review)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── n8n W3: Mark as published after social posting ───────────────────────────
// Called by n8n W3 — "HTTP — Mark ReviewGallery Published"
router.patch('/api/v1/review-gallery/:id/published', requireInternal, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const {
      isPublishedToClientSocial,
      publishedToClientSocialAt,
      isPublishedToSmartRestoBlog,
      publishedToSmartRestoBlogAt,
      moderationStatus,
      n8nExecutionId,
    } = req.body

    const updated = await prisma.reviewGallery.update({
      where: { id },
      data: {
        ...(isPublishedToClientSocial !== undefined && { isPublishedToClientSocial }),
        ...(publishedToClientSocialAt && { publishedToClientSocialAt: new Date(publishedToClientSocialAt) }),
        ...(isPublishedToSmartRestoBlog !== undefined && { isPublishedToSmartRestoBlog }),
        ...(publishedToSmartRestoBlogAt && { publishedToSmartRestoBlogAt: new Date(publishedToSmartRestoBlogAt) }),
        ...(moderationStatus && { moderationStatus }),
        ...(n8nExecutionId && { n8nExecutionId }),
        moderatedAt: new Date(),
      },
    })

    res.json({ success: true, id: updated.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Admin: List reviews for moderation dashboard ──────────────────────────────
router.get('/api/admin/review-gallery', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = (req as any).cafeId as string
    const { status = 'pending', page = '1', limit = '20' } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    const [reviews, total] = await Promise.all([
      prisma.reviewGallery.findMany({
        where: { cafeId, moderationStatus: String(status) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { reservation: { select: { name: true, phone: true } } },
      }),
      prisma.reviewGallery.count({
        where: { cafeId, moderationStatus: String(status) },
      }),
    ])

    res.json({ reviews, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Admin: Approve or reject a review ────────────────────────────────────────
// When moderationStatus → 'approved', Express fires n8n W3 webhook
router.patch('/api/admin/review-gallery/:id/moderate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const cafeId = (req as any).cafeId as string
    const { action } = req.body  // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' })
    }

    const review = await prisma.reviewGallery.findUnique({ where: { id } })
    if (!review || review.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Not found' })
    }

    const moderationStatus = action === 'approve' ? 'approved' : 'rejected'

    await prisma.reviewGallery.update({
      where: { id },
      data: { moderationStatus, moderatedAt: new Date() },
    })

    // Fire n8n W3 only on approval
    if (action === 'approve') {
      const n8nHook = process.env.N8N_WEBHOOK_REVIEW_APPROVED
      if (n8nHook) {
        fetch(n8nHook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewGalleryId: id, cafeId }),
        }).catch((e) => console.error('[n8n W3 trigger]', e))
      }
    }

    res.json({ success: true, moderationStatus })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── n8n W2: Push notification to manager ─────────────────────────────────────
router.post('/api/v1/notifications/manager', requireInternal, async (req: Request, res: Response) => {
  try {
    const { cafeId, type, title, body, refId, refType } = req.body
    if (!cafeId) return res.status(400).json({ error: 'cafeId required' })

    await prisma.systemNotification.create({
      data: { cafeId, type, title, body, refId, refType },
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
