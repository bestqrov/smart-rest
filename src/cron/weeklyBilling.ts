/**
 * Weekly Billing Cron — runs every Monday at 23:59
 *
 * Sweep C only: trial-expiry analysis (AI package generation).
 * Debt detection (PAST_DUE / SUSPENDED) has moved to the daily cron at 02:00.
 */

import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

const TRIAL_ALERT_WINDOW_DAYS = 7

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

// Exported for manual trigger (superadmin route, tests)
export async function runWeeklyBilling(): Promise<void> {
  const now         = new Date()
  const trialWindow = new Date(now.getTime() + TRIAL_ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // ── Sweep C: Trials expiring within 7 days → pre-generate AI billing package ─
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

  logger.info({ msg: '[CRON] Weekly billing completed', trialAlerts: trialExpiring.length })
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
