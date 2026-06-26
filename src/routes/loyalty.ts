/**
 * Loyalty Program — REST API
 *
 * All routes are cafe-scoped via admin JWT.
 *
 * GET  /api/loyalty/:phone   → account balance + last 20 ledger entries
 * POST /api/loyalty/redeem   → deduct points (admin redeems on behalf of customer)
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// ─── GET /api/loyalty/customers — paginated list of all loyalty accounts ──────

router.get('/api/loyalty/customers', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const search = ((req.query.search as string) ?? '').trim()
    const page   = Math.max(1, Number(req.query.page  ?? 1))
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
    const sortBy = (req.query.sort as string) === 'points' ? 'points' : 'updatedAt'
    const order  = (req.query.order as string) === 'asc' ? 'asc' : 'desc'

    const where = search
      ? { cafeId, phone: { contains: search } }
      : { cafeId }

    const [accounts, total] = await Promise.all([
      prisma.loyaltyAccount.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, phone: true, points: true, createdAt: true, updatedAt: true },
      }),
      prisma.loyaltyAccount.count({ where }),
    ])

    return res.json({ accounts, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    logger.error({ msg: 'GET loyalty/customers error', err })
    return res.status(500).json({ error: 'Failed to fetch loyalty customers' })
  }
})

// ─── GET /api/loyalty/:phone ──────────────────────────────────────────────────

router.get('/api/loyalty/:phone', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const phone  = req.params.phone as string
    const cafeId = req.admin!.cafeId

    const account = await prisma.loyaltyAccount.findUnique({
      where: { cafeId_phone: { cafeId, phone } }
    })

    if (!account) {
      return res.json({ phone, points: 0, ledger: [] })
    }

    // Return last 20 entries (newest first) — ledger is append-only in MongoDB
    const recent = [...account.ledger].reverse().slice(0, 20)

    return res.json({ phone, points: account.points, ledger: recent })
  } catch (err) {
    logger.error({ msg: 'GET loyalty error', err })
    return res.status(500).json({ error: 'Failed to fetch loyalty account' })
  }
})

// ─── POST /api/loyalty/redeem ─────────────────────────────────────────────────
// Admin redeems points for a customer at checkout.
// Body: { phone, points }  (points must be > 0 and <= current balance)

router.post('/api/loyalty/redeem', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { phone, points: rawPoints } = req.body as { phone: string; points: number }
    const cafeId = req.admin!.cafeId

    const points = Number(rawPoints)
    if (!phone || !Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ error: 'phone and a positive integer points are required' })
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { cafeId_phone: { cafeId, phone } }
    })

    if (!account || account.points < points) {
      return res.status(400).json({ error: 'Insufficient loyalty points' })
    }

    const updated = await prisma.loyaltyAccount.update({
      where: { cafeId_phone: { cafeId, phone } },
      data: {
        points: { decrement: points },
        ledger: {
          push: {
            type:      'REDEEM',
            points:    -points,
            orderId:   null,
            note:      'Redeemed at POS',
            createdAt: new Date()
          }
        }
      }
    })

    return res.json({ phone, pointsRedeemed: points, newBalance: updated.points })
  } catch (err) {
    logger.error({ msg: 'POST loyalty redeem error', err })
    return res.status(500).json({ error: 'Failed to redeem points' })
  }
})

export default router
