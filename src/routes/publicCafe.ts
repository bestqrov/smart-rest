/**
 * Public (no-auth) cafe lookup — used by POS login screen to show logo/name.
 * GET /api/public/cafe/:subdomain → { name, logoUrl, currency }
 */

import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { isCafeAccessAllowed } from '../billing/subscriptions/SubscriptionService'

const router = express.Router()

router.get('/api/public/cafe/:subdomain', async (req: Request, res: Response) => {
  try {
    const subdomain = (req.params.subdomain as string).trim().toLowerCase()
    const cafe = await prisma.cafe.findUnique({
      where:  { subdomain },
      select: { id: true, name: true, businessName: true, logoUrl: true, currency: true, isActive: true },
    })
    if (!cafe || !(await isCafeAccessAllowed(cafe.id, cafe.isActive))) return res.status(404).json({ error: 'Cafe not found' })
    return res.json({
      name:     cafe.businessName || cafe.name,
      logoUrl:  cafe.logoUrl ?? null,
      currency: cafe.currency,
    })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

// Public reservation info — used by the review page app/r/[reservationId]/page.tsx
// Returns only what the review form needs (no private billing/token data)
router.get('/api/public/reservation/:reservationId', async (req: Request, res: Response) => {
  try {
    const id = (req.params.reservationId as string).trim()
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        cafe: {
          select: {
            id: true,
            name: true,
            businessName: true,
            logoUrl: true,
            packageType: true,
            isArtisticQrPaid: true,
            accentColor: true,
            isActive: true,
          },
        },
        reviewGallery: { select: { id: true } },
      },
    })

    if (!reservation || !reservation.cafe.isActive) {
      return res.status(404).json({ error: 'Reservation not found' })
    }

    // Don't allow re-submission if already reviewed
    if (reservation.reviewGallery) {
      return res.status(409).json({ error: 'Already reviewed' })
    }

    // Only COMPLETED reservations can receive a review
    if (reservation.status !== 'COMPLETED') {
      return res.status(403).json({ error: 'Reservation not completed yet' })
    }

    const cafe = reservation.cafe
    return res.json({
      reservationId  : reservation.id,
      cafeId         : cafe.id,
      cafeName       : cafe.businessName || cafe.name,
      cafeLogoUrl    : cafe.logoUrl ?? null,
      packageType    : cafe.packageType,
      isArtisticQrPaid: cafe.isArtisticQrPaid,
      customerName   : reservation.name || null,
      customerPhone  : reservation.phone || null,
      accentColor    : cafe.accentColor,
    })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

// Public demo staff list — only works for the configured DEMO_SUBDOMAIN
// Returns id, name, role for demo login (no PIN needed in demo mode)
router.get('/api/public/demo-staff', async (req: Request, res: Response) => {
  try {
    const subdomain = ((req.query.subdomain as string) ?? '').trim().toLowerCase()
    const DEMO_SUB  = (process.env.DEMO_SUBDOMAIN ?? 'welcome').toLowerCase()
    if (!subdomain || subdomain !== DEMO_SUB) {
      return res.status(403).json({ error: 'Not a demo cafe' })
    }
    const cafe = await prisma.cafe.findUnique({
      where:  { subdomain },
      select: { id: true, isActive: true }
    })
    if (!cafe || !(await isCafeAccessAllowed(cafe.id, cafe.isActive))) return res.status(404).json({ error: 'Cafe not found' })
    const staff = await prisma.staff.findMany({
      where:  { cafeId: cafe.id, isActive: true },
      select: { id: true, name: true, role: true, roles: true },
      orderBy: { createdAt: 'asc' },
    })
    return res.json({ staff })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
