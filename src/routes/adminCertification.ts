/**
 * GET /api/admin/certification
 * Returns the cafe's current certification status and metrics snapshot.
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/api/admin/certification', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!

    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { certificationStatus: true, certificationMetrics: true, certifiedAt: true }
    })

    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    return res.json({
      certificationStatus:  cafe.certificationStatus,
      certificationMetrics: cafe.certificationMetrics ?? null,
      certifiedAt:          cafe.certifiedAt ?? null,
    })
  } catch (err) {
    logger.error({ msg: 'GET certification error', err })
    return res.status(500).json({ error: 'Failed to fetch certification data' })
  }
})

export default router
