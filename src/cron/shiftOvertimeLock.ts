/**
 * Shift Overtime Lock Cron — runs every 5 minutes
 *
 * Any OPEN CashierShift whose plannedEndTime is more than 1 hour in the
 * past gets locked (lockedAt = now). Locked shifts are blocked from
 * selling (see src/middleware/requireUnlockedShift.ts) until an admin
 * unlocks them via PATCH /api/admin/shifts/:shiftId/unlock.
 */

import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'

const OVERTIME_GRACE_MS = 60 * 60 * 1000 // 1 hour

export function startShiftOvertimeLockCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runShiftOvertimeLock()
      if (result.locked > 0) {
        logger.info({ msg: '[CRON] Shift overtime lock', locked: result.locked })
      }
    } catch (err) {
      logger.error({ msg: '[CRON] Shift overtime lock failed', err })
    }
  })
  logger.info({ msg: '[CRON] Shift overtime lock cron registered (every 5 min)' })
  return task
}

// Exported for manual trigger (superadmin route, tests)
export async function runShiftOvertimeLock(): Promise<{ locked: number }> {
  const cutoff = new Date(Date.now() - OVERTIME_GRACE_MS)

  const result = await prisma.cashierShift.updateMany({
    where: {
      status:         'OPEN',
      plannedEndTime: { lt: cutoff },
      lockedAt:       null
    },
    data: { lockedAt: new Date() }
  })

  return { locked: result.count }
}
