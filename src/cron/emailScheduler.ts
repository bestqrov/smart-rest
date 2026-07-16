/**
 * Email Scheduled Message Cron — runs every 5 minutes
 *
 * Processes EmailMessage rows with status PENDING and scheduledFor due,
 * dispatching each through the existing EmailEngine (which itself only
 * ever calls the existing Resend sender in services/email.ts).
 */

import cron from 'node-cron'
import logger from '../logger'
import { processScheduledMessages } from '../email/EmailEngine'

export function startEmailSchedulerCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await processScheduledMessages()
      if (count > 0) logger.info({ msg: '[CRON] Email scheduled messages processed', count })
    } catch (err) {
      logger.error({ msg: '[CRON] Email scheduler failed', err })
    }
  })
  logger.info({ msg: '[CRON] Email scheduler cron registered (every 5 min)' })
  return task
}
