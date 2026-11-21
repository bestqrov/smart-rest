/**
 * Cash collected by a CASHIER must land in an open register (CashierShift),
 * otherwise it is counted in no drawer and close-out can't reconcile it.
 * The POS/comptoir screens already force "open register" first; this makes
 * the server enforce it too.
 *
 * Applies only to cash (an omitted paymentMethod is treated as cash, since
 * QR orders default to CASH). Supervisors (managers, no drawer) and card /
 * online payments are not affected.
 */

import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'

export default async function requireOpenShiftForCash(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = req.staff
    if (!staff || staff.staffRole !== 'CASHIER') return next()
    const method = String((req.body as { paymentMethod?: string } | undefined)?.paymentMethod ?? 'CASH').toUpperCase()
    if (method !== 'CASH') return next()

    const open = await prisma.cashierShift.findFirst({
      where:  { staffId: staff.staffId, cafeId: staff.cafeId, status: 'OPEN' },
      select: { id: true },
    })
    if (!open) {
      return res.status(409).json({ error: 'Open the cash register before taking cash payments', code: 'SHIFT_REQUIRED' })
    }
    return next()
  } catch (err) {
    logger.error({ msg: 'requireOpenShiftForCash error', err })
    return res.status(500).json({ error: 'Shift check failed' })
  }
}
