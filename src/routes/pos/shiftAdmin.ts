/**
 * Admin-facing endpoints for CashierShift lock management.
 *
 * GET   /api/admin/shifts/locked        — list currently-locked shifts for this cafe
 * PATCH /api/admin/shifts/:shiftId/unlock — clear the lock so the staff member can sell again
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import { authorizeAdmin } from '../../middleware/authorizeAdmin'

const router = express.Router()

router.get('/api/admin/shifts/locked', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const shifts = await prisma.cashierShift.findMany({
      where:   { cafeId, lockedAt: { not: null }, status: 'OPEN' },
      include: { staff: { select: { id: true, name: true, role: true } } },
      orderBy: { lockedAt: 'desc' }
    })
    return res.json({ shifts })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/shifts/locked error', err })
    return res.status(500).json({ error: 'Failed to fetch locked shifts' })
  }
})

router.patch('/api/admin/shifts/:shiftId/unlock', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const shiftId = req.params['shiftId'] as string

    const shift = await prisma.cashierShift.findFirst({ where: { id: shiftId, cafeId } })
    if (!shift) return res.status(404).json({ error: 'Shift not found' })
    if (!shift.lockedAt) return res.status(409).json({ error: 'Shift is not locked' })

    const updated = await prisma.cashierShift.update({
      where: { id: shiftId },
      data:  { lockedAt: null }
    })

    logger.info({ msg: 'Admin unlocked shift', shiftId, cafeId, adminId: req.admin!.userId })
    return res.json({ shift: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/shifts/:shiftId/unlock error', err })
    return res.status(500).json({ error: 'Failed to unlock shift' })
  }
})

export default router
