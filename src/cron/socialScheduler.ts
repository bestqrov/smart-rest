/**
 * Social Post Scheduler Cron — runs every 5 minutes
 *
 * Processes SocialPost rows with status SCHEDULED and scheduledFor due,
 * dispatching each through the existing SocialPostService (which itself
 * only ever calls the existing n8n marketing webhook).
 */

import cron from 'node-cron'
import logger from '../logger'
import { processScheduledPosts } from '../social/SocialPostService'

export function startSocialSchedulerCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await processScheduledPosts()
      if (count > 0) logger.info({ msg: '[CRON] Scheduled social posts processed', count })
    } catch (err) {
      logger.error({ msg: '[CRON] Social scheduler failed', err })
    }
  })
  logger.info({ msg: '[CRON] Social scheduler cron registered (every 5 min)' })
  return task
}
