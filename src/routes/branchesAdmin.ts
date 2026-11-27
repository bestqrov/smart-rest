/**
 * Owner-facing branch group view (Enterprise plan).
 *   GET /api/admin/branches/report?range=today|week|month
 * The parent venue sees every linked branch; a branch sees its whole group.
 * Linking itself stays superadmin-only (routes/branchesSA.ts).
 */
import express, { Request, Response } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requirePlanFeature } from '../billing/planAccess'
import { getBranchGroupReport } from '../branches/BranchService'

const router = express.Router()

function rangeStart(range: string): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (range === 'week')  d.setDate(d.getDate() - 6)
  if (range === 'month') d.setDate(d.getDate() - 29)
  return d
}

router.get('/api/admin/branches/report', authorizeAdmin, requirePlanFeature('multiBranch'), async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const me = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { parentCafeId: true, currency: true } })
    if (!me) return res.status(404).json({ error: 'Cafe not found' })
    const parentId = me.parentCafeId ?? cafeId
    const range = String(req.query['range'] ?? 'today')
    const report = await getBranchGroupReport(parentId, rangeStart(range))
    return res.json({ ...report, parentId, currentId: cafeId, currency: me.currency })
  } catch (err) {
    logger.error({ msg: 'branches report error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
