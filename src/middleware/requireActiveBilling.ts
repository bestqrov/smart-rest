/**
 * requireActiveBilling — blocks revenue-generating POS/Comptoir/Waiter
 * actions (order creation, checkout) once a cafe is suspended for
 * non-payment.
 *
 * Mirrors the exact gate already enforced on the customer QR order path
 * (src/routes/orders.ts, `if (!cafe?.isActive) return res.status(403)...`)
 * — that check only ever covered the QR flow; POS/Comptoir/Waiter had no
 * equivalent, so a suspended cafe could keep selling through internal
 * terminals indefinitely (Sprint 12 audit P0-1).
 *
 * Apply this ONLY to routes that create an order or complete a payment.
 * Do not apply to read-only routes (menu, reports, history, shift status)
 * — those must keep working for a suspended cafe's staff.
 */
import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'

export async function requireActiveBilling(req: Request, res: Response, next: NextFunction) {
  try {
    const cafeId = req.staff?.cafeId ?? req.admin?.cafeId
    if (!cafeId) return res.status(401).json({ error: 'Unauthorized' })

    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { isActive: true, billingStatus: true },
    })

    if (!cafe?.isActive) {
      return res.status(403).json({
        error:         'This venue is currently suspended. Please contact support to resolve your account.',
        code:          'CAFE_SUSPENDED',
        billingStatus: cafe?.billingStatus ?? 'UNKNOWN',
      })
    }

    return next()
  } catch (err) {
    logger.error({ msg: 'requireActiveBilling error', err })
    return res.status(500).json({ error: 'Billing status check failed' })
  }
}

export default requireActiveBilling
