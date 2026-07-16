import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'

/**
 * Blocks POS "selling" actions (create order, checkout, create customer)
 * when the authenticated staff member's shift has been locked by the
 * overtime cron (src/cron/shiftOvertimeLock.ts). Only an admin can clear
 * the lock (src/routes/pos/shiftAdmin.ts) — the staff member cannot
 * self-resolve it by closing or reopening a shift.
 *
 * No-ops if the staff token has no shiftId (e.g. no shift opened yet) —
 * this middleware only enforces a lock, it does not require a shift to
 * exist.
 */
export async function requireUnlockedShift(req: Request, res: Response, next: NextFunction) {
  try {
    const shiftId = req.staff?.shiftId
    if (!shiftId) return next()

    const shift = await prisma.cashierShift.findUnique({
      where:  { id: shiftId },
      select: { lockedAt: true }
    })

    if (shift?.lockedAt) {
      return res.status(423).json({
        error:    'POS locked — contact your manager to unlock it',
        lockedAt: shift.lockedAt
      })
    }

    return next()
  } catch (err) {
    logger.error({ msg: 'requireUnlockedShift error', err })
    return res.status(500).json({ error: 'Lock check failed' })
  }
}

export default requireUnlockedShift
