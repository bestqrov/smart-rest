// ─── Local SEO & Google Business Automation (K29) ──────────────────────────
// Review data/analytics reuse the existing ReviewService (K21) and
// FeedbackService (K23) — this module adds no parallel review storage.
// AI-assisted reply "generation" is tracked through the existing
// AIJobService (services/aiJobService.ts) rather than a second job queue;
// actual LLM provider wiring is left for a follow-up (same "ready, not
// wired" posture as K23's SMS and K26's un-integrated SMS provider) — the
// suggestion text is composed from a simple rating-aware template for now,
// swappable later without touching callers since it's all behind
// generateReviewReplySuggestion.

import prisma from '../prisma'
import logger from '../logger'
import { publishStandardEvent } from '../core'
import { getRatingAnalytics, listOrderReviews } from '../reviews/ReviewService'
import { getSatisfactionScore } from '../feedback/FeedbackService'
import * as AIJobService from '../services/aiJobService'

// ─── Google Business Profile sync ──────────────────────────────────────────
// Real fetch attempt when a token is configured, graceful no-op otherwise —
// same posture already established for sendWhatsApp/sendEmail/sendSms.
export async function syncBusinessProfile(cafeId: string) {
  const cafe = await prisma.cafe.findUniqueOrThrow({
    where:  { id: cafeId },
    select: { name: true, city: true, country: true, ownerPhone: true, googleBusinessProfileId: true, googleBusinessAccessToken: true },
  })

  if (!cafe.googleBusinessAccessToken || !cafe.googleBusinessProfileId) {
    logger.warn({ msg: '[SeoService] Google Business Profile not connected — skipping sync', cafeId })
    publishStandardEvent('GbpSyncFailed', { tenantId: cafeId, resourceId: cafeId, metadata: { reason: 'not_connected' } }, 'seo-engine')
    return { synced: false, reason: 'not_connected' }
  }

  try {
    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${cafe.googleBusinessProfileId}`,
      {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${cafe.googleBusinessAccessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: cafe.name, phoneNumbers: { primaryPhone: cafe.ownerPhone } }),
      },
    )
    if (!res.ok) throw new Error(`GBP API returned ${res.status}`)

    await prisma.cafe.update({ where: { id: cafeId }, data: { gbpLastSyncedAt: new Date() } })
    publishStandardEvent('GbpProfileSynced', { tenantId: cafeId, resourceId: cafeId, metadata: {} }, 'seo-engine')
    return { synced: true }
  } catch (err: any) {
    logger.error({ msg: '[SeoService] GBP sync failed', cafeId, err: err.message })
    publishStandardEvent('GbpSyncFailed', { tenantId: cafeId, resourceId: cafeId, metadata: { reason: err.message } }, 'seo-engine')
    return { synced: false, reason: err.message }
  }
}

// ─── Review monitoring feed ─────────────────────────────────────────────────
// Merges order-review history (ReviewService, K21) with feedback-form entries
// (Feedback model, K23) into one chronological feed — reuses both, stores
// neither.
export async function getReviewMonitoringFeed(cafeId: string, limit = 30) {
  const [reviews, feedbacks] = await Promise.all([
    listOrderReviews(cafeId, { limit }),
    prisma.feedback.findMany({ where: { cafeId }, orderBy: { createdAt: 'desc' }, take: limit }),
  ])

  const feed = [
    ...reviews.items.map(r => ({ type: 'ORDER_REVIEW' as const, id: r.id, rating: r.rating, comment: r.reviewText, createdAt: r.createdAt })),
    ...feedbacks.map(f => ({ type: 'FEEDBACK' as const, id: f.id, rating: f.score, comment: f.comment, createdAt: f.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)

  return feed
}

// ─── AI-assisted review replies ─────────────────────────────────────────────
function composeReplyTemplate(rating: number, comment: string | null): string {
  if (rating >= 4) {
    return `Thank you so much for your kind words${comment ? ' about "' + comment.slice(0, 60) + '"' : ''}! We're thrilled you enjoyed your visit and look forward to welcoming you back soon.`
  }
  if (rating === 3) {
    return `Thank you for your feedback. We're glad parts of your visit went well, and we'd love to know how we can do better next time — please reach out to us directly.`
  }
  return `We're sorry to hear about your experience${comment ? ' regarding "' + comment.slice(0, 60) + '"' : ''}. This isn't the standard we hold ourselves to, and we'd appreciate the chance to make it right — please contact us directly.`
}

export async function generateReviewReplySuggestion(
  cafeId: string,
  sourceType: 'FEEDBACK' | 'ORDER_REVIEW',
  sourceId:   string,
  rating:     number,
  comment:    string | null,
) {
  const jobId = await AIJobService.createJob({
    module: 'seo', jobType: 'review_reply_generation', inputReference: sourceId,
    metadata: { cafeId, sourceType, rating },
  })
  await AIJobService.startJob(jobId)

  const suggestedReply = composeReplyTemplate(rating, comment)

  await AIJobService.completeJob(jobId, { outputReference: sourceId })

  const reply = await prisma.seoReviewReply.create({
    data: { cafeId, sourceType, sourceId, suggestedReply, aiJobId: jobId },
  })

  publishStandardEvent('ReviewReplyGenerated', {
    tenantId: cafeId, resourceId: reply.id, metadata: { sourceType, sourceId, aiJobId: jobId },
  }, 'seo-engine')

  return reply
}

// ─── Local SEO score ─────────────────────────────────────────────────────────
// Weighted composite from existing signals — no new data collection.
export async function calculateLocalSeoScore(cafeId: string) {
  const [cafe, ratingAnalytics, csat, citations] = await Promise.all([
    prisma.cafe.findUniqueOrThrow({ where: { id: cafeId }, select: { googleReviewLink: true, gbpSyncEnabled: true, gbpLastSyncedAt: true } }),
    getRatingAnalytics(cafeId),
    getSatisfactionScore(cafeId),
    prisma.seoCitation.findMany({ where: { cafeId } }),
  ])

  const googleLinkScore = cafe.googleReviewLink ? 20 : 0
  const gbpScore        = cafe.gbpSyncEnabled && cafe.gbpLastSyncedAt ? 20 : 0
  const ratingScore     = Math.min(30, (ratingAnalytics.averageRating / 5) * 30)
  const csatScore       = Math.min(20, (csat.csat / 100) * 20)
  const citationScore   = citations.length > 0
    ? Math.min(10, (citations.filter(c => c.status === 'LISTED').length / citations.length) * 10)
    : 0

  const score = Math.round(googleLinkScore + gbpScore + ratingScore + csatScore + citationScore)

  publishStandardEvent('SeoScoreCalculated', { tenantId: cafeId, resourceId: cafeId, metadata: { score } }, 'seo-engine')

  return {
    score,
    breakdown: { googleLinkScore, gbpScore, ratingScore, csatScore, citationScore },
  }
}

// ─── Citation management hooks ─────────────────────────────────────────────
// Manual/foundation tracking — not an automated directory scanner.
export async function upsertCitation(cafeId: string, source: string, url?: string, status: 'LISTED' | 'MISSING' | 'INCONSISTENT' = 'MISSING') {
  const citation = await prisma.seoCitation.upsert({
    where:  { cafeId_source: { cafeId, source } },
    update: { url, status, lastCheckedAt: new Date() },
    create: { cafeId, source, url, status, lastCheckedAt: new Date() },
  })
  publishStandardEvent('CitationChecked', { tenantId: cafeId, resourceId: citation.id, metadata: { source, status } }, 'seo-engine')
  return citation
}

export async function listCitations(cafeId: string) {
  return prisma.seoCitation.findMany({ where: { cafeId } })
}

// ─── Performance insights ───────────────────────────────────────────────────
// Pure composition of the above — no new business logic.
export async function getPerformanceInsights(cafeId: string) {
  const [seo, ratingAnalytics, csat, citations] = await Promise.all([
    calculateLocalSeoScore(cafeId),
    getRatingAnalytics(cafeId),
    getSatisfactionScore(cafeId),
    listCitations(cafeId),
  ])
  return { seo, ratingAnalytics, csat, citations }
}
