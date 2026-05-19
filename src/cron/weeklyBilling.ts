import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

export function startWeeklyBillingCron(): void {
  cron.schedule('59 23 * * 1', async () => {
    logger.info({ msg: '[CRON] Weekly billing job started' })
    try {
      const now = new Date()
      const cafes = await prisma.cafe.findMany({
        where: { trialEndsAt: { not: null } },
        select: { id: true, country: true, walletBalance: true, trialEndsAt: true, billingStatus: true }
      })

      for (const cafe of cafes) {
        if (!cafe.trialEndsAt) continue
        const trialEnded = now >= cafe.trialEndsAt
        const trialEndsThisWeek = !trialEnded && cafe.trialEndsAt <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

        if (trialEnded) {
          if (cafe.walletBalance < 0) {
            await prisma.cafe.update({
              where: { id: cafe.id },
              data: { isActive: false, billingStatus: 'SUSPENDED' }
            })
            logger.warn({ msg: '[CRON] Cafe suspended — negative balance', cafeId: cafe.id, balance: cafe.walletBalance })
          }
          continue
        }

        if (trialEndsThisWeek) await handleTrialExpiry(cafe.id, cafe.country)
      }
      logger.info({ msg: '[CRON] Weekly billing job completed' })
    } catch (err) {
      logger.error({ msg: '[CRON] Weekly billing job failed', err })
    }
  })
  logger.info({ msg: '[CRON] Weekly billing cron registered (Mon 23:59)' })
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
