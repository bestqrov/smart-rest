// ─── Reviews & Reputation Management (K21) ─────────────────────────────────
// Internal review storage (Order.rating/reviewText + the richer ReviewGallery
// model), the ≥4/≤3 star branching, and review-request automation (n8n W2
// pipeline, triggered on Reservation COMPLETED) already exist and are
// untouched — reused, not duplicated. Genuinely missing: a configurable
// Google review link, rating analytics, review history, and a persisted
// (not just ephemeral-socket) negative-review alert.

import prisma from '../prisma'
import { publishStandardEvent } from '../core'

// ─── Google review link ───────────────────────────────────────────────────
export async function getGoogleReviewLink(cafeId: string): Promise<string | null> {
  const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { googleReviewLink: true } })
  return cafe?.googleReviewLink ?? null
}

export async function setGoogleReviewLink(cafeId: string, link: string) {
  const updated = await prisma.cafe.update({ where: { id: cafeId }, data: { googleReviewLink: link } })
  publishStandardEvent('GoogleReviewLinkUpdated', {
    tenantId: cafeId, resourceId: cafeId, metadata: { link },
  }, 'reviews')
  return updated.googleReviewLink
}

// ─── Negative review alert (persisted, in addition to the existing ────────
// ephemeral socket 'internal_alert' emitted inline in routes/reviews.ts) ──
export async function flagNegativeReview(cafeId: string, orderId: string, rating: number, reviewText?: string | null) {
  await prisma.systemNotification.create({
    data: {
      cafeId,
      type:    'NEGATIVE_REVIEW',
      title:   `Negative review: ${rating}★`,
      body:    reviewText?.trim() || 'No comment left.',
      refId:   orderId,
      refType: 'order',
    },
  })

  publishStandardEvent('ReviewFlaggedNegative', {
    tenantId: cafeId, resourceId: orderId, metadata: { rating },
  }, 'reviews')
}

export async function notifyReviewSubmitted(cafeId: string, orderId: string, rating: number) {
  publishStandardEvent('ReviewSubmitted', {
    tenantId: cafeId, resourceId: orderId, metadata: { rating },
  }, 'reviews')
}

// ─── Review history (Order.rating reviews — distinct from the ReviewGallery ─
// admin listing in routes/reviewGallery.ts, which covers the richer photo/
// consent workflow) ──────────────────────────────────────────────────────────
export async function listOrderReviews(
  cafeId: string,
  filter: { minRating?: number; maxRating?: number; page?: number; limit?: number } = {},
) {
  const page  = Math.max(1, filter.page ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit

  const where = {
    cafeId,
    rating: { not: null, ...(filter.minRating != null ? { gte: filter.minRating } : {}), ...(filter.maxRating != null ? { lte: filter.maxRating } : {}) },
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: limit,
      select: { id: true, rating: true, reviewText: true, createdAt: true, customerPhone: true },
    }),
    prisma.order.count({ where }),
  ])

  return { items, total, page, limit, pages: Math.ceil(total / limit) }
}

// ─── Rating analytics ─────────────────────────────────────────────────────────
export async function getRatingAnalytics(cafeId: string, from?: Date, to?: Date) {
  const dateFilter = (from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}
  const where = { cafeId, rating: { not: null }, ...dateFilter }

  const [count, agg, distribution] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _avg: { rating: true } }),
    // MongoDB doesn't support groupBy in this Prisma setup — same convention
    // already used in routes/reservations.ts's counts endpoint.
    Promise.all([1, 2, 3, 4, 5].map(r => prisma.order.count({ where: { ...where, rating: r } }))),
  ])

  return {
    count,
    averageRating: agg._avg.rating ?? 0,
    distribution: { 1: distribution[0], 2: distribution[1], 3: distribution[2], 4: distribution[3], 5: distribution[4] },
  }
}
