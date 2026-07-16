/**
 * WhatsApp Scheduled Message Cron — runs every 5 minutes
 *
 * Processes WhatsAppMessage rows with status PENDING and scheduledFor due,
 * dispatching each through the existing WhatsAppEngine (which itself only
 * ever calls the existing Evolution API sender).
 */

import cron from 'node-cron'
import logger from '../logger'
import { processScheduledMessages } from '../whatsapp/WhatsAppEngine'

export function startWhatsAppSchedulerCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await processScheduledMessages()
      if (count > 0) logger.info({ msg: '[CRON] WhatsApp scheduled messages processed', count })
    } catch (err) {
      logger.error({ msg: '[CRON] WhatsApp scheduler failed', err })
    }
  })
  logger.info({ msg: '[CRON] WhatsApp scheduler cron registered (every 5 min)' })
  return task
}
