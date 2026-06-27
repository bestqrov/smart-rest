/**
 * Daily Debt Detection Cron — runs every day at 02:00 AM
 *
 * Sweep A  PAST_DUE + gracePeriodEndsAt elapsed → SUSPENDED
 * Sweep B  Negative-balance active cafes (trial ended) → PAST_DUE
 *
 * The 7-day grace period starts the first day debt is detected.
 * Every subsequent run re-checks whether that deadline has passed.
 * Trial-expiry analysis (AI package generation) is handled separately
 * by the weekly cron on Mondays.
 */

import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'

const GRACE_PERIOD_DAYS = 7

export function startDailyDebtDetectionCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 2 * * *', async () => {
    logger.info({ msg: '[CRON] Daily debt detection started' })
    try {
      await runDailyDebtDetection()
      logger.info({ msg: '[CRON] Daily debt detection completed' })
    } catch (err) {
      logger.error({ msg: '[CRON] Daily debt detection failed', err })
    }
  })
  logger.info({ msg: '[CRON] Daily debt detection cron registered (daily 02:00)' })
  return task
}

// Exported for manual trigger (superadmin route, tests)
export async function runDailyDebtDetection(): Promise<{
  suspended: number
  pastDue:   number
}> {
  const now = new Date()

  // ── Sweep A: Grace period elapsed → SUSPENDED ────────────────────────────────
  const gracePeriodExpired = await prisma.cafe.findMany({
    where: {
      billingStatus:     'PAST_DUE',
      gracePeriodEndsAt: { lte: now }
    },
    select: { id: true, walletBalance: true, country: true, subdomain: true }
  })

  for (const cafe of gracePeriodExpired) {
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: {
        isActive:          false,
        billingStatus:     'SUSPENDED',
        suspendedAt:       now,
        gracePeriodEndsAt: null,
      }
    })
    logger.warn({
      msg:     '[CRON] Cafe SUSPENDED — grace period elapsed',
      cafeId:  cafe.id,
      balance: cafe.walletBalance,
    })
    await fireBillingWebhook(cafe.id, cafe.subdomain, cafe.walletBalance, cafe.country, 'CAFE_SUSPENDED')
  }

  // ── Sweep B: First-time debt detected → PAST_DUE ─────────────────────────────
  // Only targets cafes currently ACTIVE (COLLECTING_DEBT or GRACE_PERIOD with
  // ended trial). Cafes already in PAST_DUE or SUSPENDED are excluded.
  const newlyInDebt = await prisma.cafe.findMany({
    where: {
      isActive:      true,
      walletBalance: { lt: 0 },
      billingStatus: { in: ['COLLECTING_DEBT', 'GRACE_PERIOD'] },
      OR: [
        { trialEndsAt: null },
        { trialEndsAt: { lte: now } }
      ]
    },
    select: { id: true, walletBalance: true, country: true, subdomain: true }
  })

  for (const cafe of newlyInDebt) {
    const gracePeriodEndsAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    await prisma.cafe.update({
      where: { id: cafe.id },
      data:  { billingStatus: 'PAST_DUE', gracePeriodEndsAt }
    })
    logger.warn({
      msg:              '[CRON] Cafe PAST_DUE — 7-day grace period started',
      cafeId:           cafe.id,
      balance:          cafe.walletBalance,
      gracePeriodEndsAt,
    })
    await fireBillingWebhook(cafe.id, cafe.subdomain, cafe.walletBalance, cafe.country, 'CAFE_PAST_DUE')
  }

  return { suspended: gracePeriodExpired.length, pastDue: newlyInDebt.length }
}

async function fireBillingWebhook(
  cafeId: string, subdomain: string, balance: number, country: string,
  event: 'CAFE_PAST_DUE' | 'CAFE_SUSPENDED'
): Promise<void> {
  const webhook = process.env.N8N_BILLING_WEBHOOK || process.env.N8N_WHATSAPP_WEBHOOK
  if (!webhook) {
    logger.info({ msg: '[CRON] No billing webhook — skipping notification', cafeId, event })
    return
  }
  try {
    await fetch(webhook, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        cafeId,
        subdomain,
        balance:     balance.toFixed(2),
        country,
        paymentLink: `${process.env.FRONTEND_URL || 'https://smartrestau.com'}/admin/billing`,
        timestamp:   new Date().toISOString()
      })
    })
    logger.info({ msg: '[CRON] Billing webhook sent', cafeId, event })
  } catch (err) {
    logger.warn({ msg: '[CRON] Billing webhook failed', cafeId, event, err })
  }
}
