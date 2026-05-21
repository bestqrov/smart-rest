/**
 * Public (no-auth) cafe lookup — used by POS login screen to show logo/name.
 * GET /api/public/cafe/:subdomain → { name, logoUrl, currency }
 */

import express, { Request, Response } from 'express'
import prisma from '../prisma'

const router = express.Router()

router.get('/api/public/cafe/:subdomain', async (req: Request, res: Response) => {
  try {
    const subdomain = (req.params.subdomain as string).trim().toLowerCase()
    const cafe = await prisma.cafe.findUnique({
      where:  { subdomain },
      select: { name: true, businessName: true, logoUrl: true, currency: true, isActive: true },
    })
    if (!cafe || !cafe.isActive) return res.status(404).json({ error: 'Cafe not found' })
    return res.json({
      name:     cafe.businessName || cafe.name,
      logoUrl:  cafe.logoUrl ?? null,
      currency: cafe.currency,
    })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
