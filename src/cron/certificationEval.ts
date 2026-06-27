/**
 * Smart Resto Certified — Monthly Evaluation Cron
 *
 * Runs on the 1st of every month at 02:00.
 * Evaluates every active cafe that is at least 90 days old against
 * four hard eligibility criteria:
 *
 *   1. qrUsageRate   >= 70%   (QR orders / total orders × 100)
 *   2. averageRating >= 4.5   (with a minimum of 50 rated orders)
 *   3. avgPrepTime   < 25 min (PENDING → READY, using preparedAt)
 *   4. accountAge    >= 90 days
 *
 * Outcomes:
 *   - All pass  → certificationStatus = ELIGIBLE  + webhook to n8n
 *   - Any fail  → status stays PENDING (or REVOKED if previously CERTIFIED)
 */

import cron from 'node-cron'
import axios from 'axios'
import prisma from '../prisma'
import logger from '../logger'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CafeMetrics {
  cafeId:            string
  cafeName:          string
  ownerPhone:        string
  ownerEmail:        string
  qrUsageRate:       number
  averageRating:     number
  reviewCount:       number
  avgPreparationTime: number
  accountAgeDays:    number
}

// ─── Core evaluation logic (exported for on-demand use / testing) ─────────────

export async function evaluateCertifications(): Promise<void> {
  logger.info({ msg: '[CertCron] Starting monthly certification evaluation' })

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // Only evaluate active cafes old enough to qualify
  const cafes = await prisma.cafe.findMany({
    where: {
      isActive:  true,
      // createdAt is not on Cafe — we use trialEndsAt as a proxy for account age,
      // falling back to querying the oldest order for the cafe.
      // We filter in-memory below after fetching the oldest order timestamp.
    },
    select: {
      id: true, name: true, ownerPhone: true, ownerEmail: true,
      certificationStatus: true,
      users: { select: { email: true }, take: 1 }
    }
  })

  for (const cafe of cafes) {
    try {
      await evaluateSingleCafe(cafe, ninetyDaysAgo)
    } catch (err) {
      logger.error({ msg: '[CertCron] Error evaluating cafe', cafeId: cafe.id, err })
    }
  }

  logger.info({ msg: '[CertCron] Evaluation complete', total: cafes.length })
}

async function evaluateSingleCafe(
  cafe: { id: string; name: string; ownerPhone: string; ownerEmail: string; certificationStatus: string; users: { email: string }[] },
  ninetyDaysAgo: Date
): Promise<void> {

  // ── Account age check via oldest completed order ──────────────────────────
  const oldestOrder = await prisma.order.findFirst({
    where:   { cafeId: cafe.id },
    orderBy: { createdAt: 'asc' },
    select:  { createdAt: true }
  })

  if (!oldestOrder) return  // no orders yet — skip

  const accountAgeDays = Math.floor(
    (Date.now() - oldestOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (accountAgeDays < 90) return  // too new — skip silently

  // ── Aggregate metrics over last 90 days ───────────────────────────────────
  const since = ninetyDaysAgo

  const [totalOrders, qrOrders, ratedOrders, prepOrders] = await Promise.all([
    // Total completed orders
    prisma.order.count({
      where: { cafeId: cafe.id, status: 'COMPLETED', createdAt: { gte: since } }
    }),

    // QR orders (customer-placed, not POS-manual)
    prisma.order.count({
      where: { cafeId: cafe.id, status: 'COMPLETED', orderSource: 'QR_CODE', createdAt: { gte: since } }
    }),

    // Orders with a rating
    prisma.order.findMany({
      where:  { cafeId: cafe.id, status: 'COMPLETED', rating: { not: null }, createdAt: { gte: since } },
      select: { rating: true }
    }),

    // Orders that have a preparedAt timestamp (READY was set by kitchen)
    prisma.order.findMany({
      where:  { cafeId: cafe.id, preparedAt: { not: null }, createdAt: { gte: since } },
      select: { createdAt: true, preparedAt: true }
    })
  ])

  // ── Compute derived metrics ───────────────────────────────────────────────
  const qrUsageRate = totalOrders > 0
    ? parseFloat(((qrOrders / totalOrders) * 100).toFixed(1))
    : 0

  const reviewCount  = ratedOrders.length
  const averageRating = reviewCount > 0
    ? parseFloat((ratedOrders.reduce((s, o) => s + (o.rating ?? 0), 0) / reviewCount).toFixed(2))
    : 0

  const avgPreparationTime = prepOrders.length > 0
    ? parseFloat((
        prepOrders.reduce((s, o) => {
          const mins = (o.preparedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60)
          return s + mins
        }, 0) / prepOrders.length
      ).toFixed(1))
    : 999  // unknown prep time → fail the check

  const metrics: CafeMetrics = {
    cafeId:            cafe.id,
    cafeName:          cafe.name,
    ownerPhone:        cafe.ownerPhone,
    ownerEmail:        cafe.ownerEmail || cafe.users[0]?.email || '',
    qrUsageRate,
    averageRating,
    reviewCount,
    avgPreparationTime,
    accountAgeDays
  }

  // ── Hard eligibility rules ────────────────────────────────────────────────
  const passes =
    qrUsageRate       >= 70  &&
    averageRating     >= 4.5 &&
    reviewCount       >= 50  &&
    avgPreparationTime < 25

  const metricsSnapshot = {
    qrUsageRate,
    avgPreparationTime,
    averageRating,
    reviewCount,
    evaluatedAt: new Date()
  }

  if (passes && cafe.certificationStatus === 'PENDING') {
    // Promote to ELIGIBLE and fire n8n webhook
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: {
        certificationStatus:  'ELIGIBLE',
        certificationMetrics: metricsSnapshot
      }
    })

    logger.info({ msg: '[CertCron] Cafe is now ELIGIBLE', cafeId: cafe.id, cafeName: cafe.name })
    await dispatchN8nWebhook(metrics)

  } else if (!passes && cafe.certificationStatus === 'CERTIFIED') {
    // Revoke if a certified cafe drops below thresholds
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: {
        certificationStatus:  'REVOKED',
        certificationMetrics: metricsSnapshot
      }
    })
    logger.warn({ msg: '[CertCron] Certification REVOKED', cafeId: cafe.id, cafeName: cafe.name })

  } else {
    // Just update the metrics snapshot without changing status
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: { certificationMetrics: metricsSnapshot }
    })
  }
}

// ─── n8n Webhook ──────────────────────────────────────────────────────────────
// Fires an async POST to the n8n workflow that handles:
//   Node 1 — WhatsApp (Evolution API): congratulations message to ownerPhone
//   Node 2 — Email (Resend): official certification email to ownerEmail

async function dispatchN8nWebhook(metrics: CafeMetrics): Promise<void> {
  const webhookUrl = process.env.N8N_CERTIFICATION_WEBHOOK_URL
  if (!webhookUrl) {
    logger.warn({ msg: '[CertCron] N8N_CERTIFICATION_WEBHOOK_URL not set — skipping webhook' })
    return
  }

  const payload = {
    event:        'cafe.certification.eligible',
    restaurantId:  metrics.cafeId,
    restaurantName: metrics.cafeName,
    ownerPhone:   metrics.ownerPhone,
    ownerEmail:   metrics.ownerEmail,
    metrics: {
      qrUsageRate:        metrics.qrUsageRate,
      averageRating:      metrics.averageRating,
      reviewCount:        metrics.reviewCount,
      avgPreparationTime: metrics.avgPreparationTime,
      accountAgeDays:     metrics.accountAgeDays
    },
    triggeredAt: new Date().toISOString()
  }

  try {
    await axios.post(webhookUrl, payload, {
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' }
    })
    logger.info({ msg: '[CertCron] n8n webhook dispatched', cafeId: metrics.cafeId })
  } catch (err: any) {
    // Non-fatal — the DB is already updated; webhook failure is logged only
    logger.error({ msg: '[CertCron] n8n webhook failed', cafeId: metrics.cafeId, err: err?.message })
  }
}

// ─── Cron registration ────────────────────────────────────────────────────────

export function startCertificationCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 2 1 * *', async () => {
    try {
      await evaluateCertifications()
    } catch (err) {
      logger.error({ msg: '[CertCron] Unhandled error in certification eval', err })
    }
  })
  logger.info({ msg: '[CertCron] Certification cron registered (runs 02:00 on 1st of each month)' })
  return task
}
