/**
 * BillingSubscription Scheduler Cron (K48) — runs every day at 03:00
 *
 * Automatic subscription lifecycle sweep: trial-ending reminders, trial
 * expiration → EXPIRED, active lapse → GRACE_PERIOD, grace period expiration
 * → SUSPENDED. All state changes go through SubscriptionService and are
 * idempotent (each sweep's query excludes rows already past the relevant
 * transition).
 */

import cron from 'node-cron'
import logger from '../logger'
import { runSubscriptionLifecycleSweep } from '../billing/scheduler/SubscriptionScheduler'

export function startSubscriptionSchedulerCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 3 * * *', async () => {
    logger.info({ msg: '[CRON] Subscription scheduler sweep started' })
    try {
      const result = await runSubscriptionLifecycleSweep()
      logger.info({
        msg:           '[CRON] Subscription scheduler sweep completed',
        remindersSent: result.remindersSent,
        trialExpired:  result.trialExpired.length,
        enteredGrace:  result.enteredGrace.length,
        suspended:     result.suspended.length,
      })
    } catch (err) {
      logger.error({ msg: '[CRON] Subscription scheduler sweep failed', err })
    }
  })
  logger.info({ msg: '[CRON] Subscription scheduler cron registered (daily 03:00)' })
  return task
}
