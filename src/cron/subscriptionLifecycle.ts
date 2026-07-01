/**
 * Subscription Lifecycle Cron — runs every day at 03:00
 *
 * Billing-module lifecycle automation: trial ending reminders, subscription
 * expiration, grace period expiration and automatic renewal checks.
 * All state changes go through SubscriptionService and are idempotent.
 */

import cron from 'node-cron'
import logger from '../logger'
import { runSubscriptionLifecycleSweep } from '../billing'

export function startSubscriptionLifecycleCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 3 * * *', async () => {
    logger.info({ msg: '[CRON] Subscription lifecycle sweep started' })
    try {
      const result = await runSubscriptionLifecycleSweep()
      logger.info({
        msg:           '[CRON] Subscription lifecycle sweep completed',
        remindersSent: result.remindersSent,
        cancelled:     result.cancelled.length,
        suspended:     result.suspended.length,
        renewed:       result.renewed.length,
      })
    } catch (err) {
      logger.error({ msg: '[CRON] Subscription lifecycle sweep failed', err })
    }
  })
  logger.info({ msg: '[CRON] Subscription lifecycle cron registered (daily 03:00)' })
  return task
}
