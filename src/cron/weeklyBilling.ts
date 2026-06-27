import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

// Grace period before suspension: 7 days after debt is first detected
const GRACE_PERIOD_DAYS = 7

export function startWeeklyBillingCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('59 23 * * 1', async () => {
    logger.info({ msg: '[CRON] Weekly billing job started' })
    try {
      await runWeeklyBilling()
      logger.info({ msg: '[CRON] Weekly billing job completed' })
    } catch (err) {
      logger.error({ msg: '[CRON] Weekly billing job failed', err })
    }
  })
  logger.info({ msg: '[CRON] Weekly billing cron registered (Mon 23:59)' })
  return task
}

// Exported so it can be triggered manually from superadmin routes or tests
export async function runWeeklyBilling(): Promise<void> {
  const now = new Date()

  // ── Sweep A: PAST_DUE grace period elapsed → SUSPENDED ───────────────────────
  // Cafes that entered PAST_DUE last cycle and haven't paid within the grace period.
  const gracePeriodExpired = await prisma.cafe.findMany({
    where: {
      billingStatus:    'PAST_DUE',
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
    logger.warn({ msg: '[CRON] Cafe SUSPENDED — grace period elapsed', cafeId: cafe.id, balance: cafe.walletBalance })
    await fireBillingWebhook(cafe.id, cafe.subdomain, cafe.walletBalance, cafe.country, 'CAFE_SUSPENDED')
  }

  // ── Sweep B: New debt detected → PAST_DUE (7-day grace period starts) ────────
  // Active cafes whose trial has ended and whose balance just went negative.
  // Excludes cafes already in PAST_DUE or SUSPENDED.
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
      data: {
        billingStatus:    'PAST_DUE',
        gracePeriodEndsAt,
      }
    })
    logger.warn({
      msg: '[CRON] Cafe PAST_DUE — 7-day grace period started',
      cafeId: cafe.id,
      balance: cafe.walletBalance,
      gracePeriodEndsAt
    })
    await fireBillingWebhook(cafe.id, cafe.subdomain, cafe.walletBalance, cafe.country, 'CAFE_PAST_DUE')
  }

  // ── Sweep C: Trials expiring within the next 7 days → generate AI package ────
  const trialWindow  = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  const trialExpiring = await prisma.cafe.findMany({
    where: {
      trialEndsAt: { gt: now, lte: trialWindow },
      isActive:    true
    },
    select: { id: true, country: true }
  })

  for (const cafe of trialExpiring) {
    await handleTrialExpiry(cafe.id, cafe.country)
  }

  logger.info({
    msg: '[CRON] Weekly billing completed',
    suspended:  gracePeriodExpired.length,
    pastDue:    newlyInDebt.length,
    trialAlerts: trialExpiring.length,
  })
}

async function handleTrialExpiry(cafeId: string, country: string): Promise<void> {
  try {
    const { aov, orderCount } = await computeCafeAOV(cafeId)
    await suggestBillingTiers(cafeId, country)
    await prisma.cafe.update({ where: { id: cafeId }, data: { billingStatus: 'GRACE_PERIOD' } })
    logger.info({ msg: '[CRON] Trial expiry — AI package generated', cafeId, aov, orderCount })
  } catch (err) {
    logger.error({ msg: '[CRON] handleTrialExpiry failed', cafeId, err })
  }
}

async function fireBillingWebhook(
  cafeId: string, subdomain: string, balance: number, country: string,
  event: 'CAFE_PAST_DUE' | 'CAFE_SUSPENDED'
): Promise<void> {
  const webhook = process.env.N8N_BILLING_WEBHOOK || process.env.N8N_WHATSAPP_WEBHOOK
  if (!webhook) {
    logger.info({ msg: '[CRON] No billing webhook configured — skipping notification', cafeId, event })
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
