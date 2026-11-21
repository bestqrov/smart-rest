/**
 * Subscription billing cron — daily 04:00.
 * Issues due monthly invoices, sends reminders (due+3d, due+7d) and suspends
 * the admin dashboard at due+14d. See src/billing/subscriptionBilling.ts.
 */

import cron from 'node-cron'
import logger from '../logger'
import { runBillingCycle } from '../billing/subscriptionBilling'

export function startSubscriptionBillingCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 4 * * *', async () => {
    try {
      await runBillingCycle()
    } catch (err) {
      logger.error({ msg: '[CRON] Subscription billing failed', err })
    }
  })
  logger.info({ msg: '[CRON] Subscription billing cron registered (daily 04:00)' })
  return task
}
