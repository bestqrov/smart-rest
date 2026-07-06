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
import {
  redeemPoints, getTierInfo, listRewards, createReward, deactivateReward, redeemReward,
} from '../loyalty/LoyaltyService'

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
        select: { id: true, phone: true, points: true, lifetimePoints: true, createdAt: true, updatedAt: true },
      }),
      prisma.loyaltyAccount.count({ where }),
    ])

    return res.json({ accounts, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    logger.error({ msg: 'GET loyalty/customers error', err })
    return res.status(500).json({ error: 'Failed to fetch loyalty customers' })
  }
})

// ─── K-Loyalty — Settings (points rate + tier thresholds) ────────────────────
// Registered before /:phone so the literal "settings" segment isn't swallowed
// by the dynamic phone-number route below.

router.get('/api/loyalty/settings', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { loyaltyPointsPerCurrency: true, loyaltyTierSilverThreshold: true, loyaltyTierGoldThreshold: true },
    })
    return res.json({
      pointsPerCurrency: cafe?.loyaltyPointsPerCurrency ?? 10,
      silverThreshold:   cafe?.loyaltyTierSilverThreshold ?? 500,
      goldThreshold:     cafe?.loyaltyTierGoldThreshold ?? 2000,
    })
  } catch (err) {
    logger.error({ msg: 'GET loyalty settings error', err })
    return res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

router.patch('/api/loyalty/settings', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { pointsPerCurrency, silverThreshold, goldThreshold } = req.body as Record<string, any>

    const data: Record<string, any> = {}
    if (pointsPerCurrency !== undefined) {
      if (!(Number(pointsPerCurrency) > 0)) return res.status(400).json({ error: 'pointsPerCurrency must be a positive number' })
      data.loyaltyPointsPerCurrency = Number(pointsPerCurrency)
    }
    if (silverThreshold !== undefined) {
      if (!Number.isInteger(silverThreshold) || silverThreshold < 0) return res.status(400).json({ error: 'silverThreshold must be a non-negative integer' })
      data.loyaltyTierSilverThreshold = silverThreshold
    }
    if (goldThreshold !== undefined) {
      if (!Number.isInteger(goldThreshold) || goldThreshold < 0) return res.status(400).json({ error: 'goldThreshold must be a non-negative integer' })
      data.loyaltyTierGoldThreshold = goldThreshold
    }

    const effectiveSilver = data.loyaltyTierSilverThreshold ?? (await prisma.cafe.findUnique({ where: { id: cafeId }, select: { loyaltyTierSilverThreshold: true } }))?.loyaltyTierSilverThreshold ?? 500
    const effectiveGold   = data.loyaltyTierGoldThreshold   ?? (await prisma.cafe.findUnique({ where: { id: cafeId }, select: { loyaltyTierGoldThreshold: true } }))?.loyaltyTierGoldThreshold ?? 2000
    if (effectiveGold <= effectiveSilver) {
      return res.status(400).json({ error: 'goldThreshold must be greater than silverThreshold' })
    }

    const cafe = await prisma.cafe.update({ where: { id: cafeId }, data })
    return res.json({
      pointsPerCurrency: cafe.loyaltyPointsPerCurrency,
      silverThreshold:   cafe.loyaltyTierSilverThreshold,
      goldThreshold:     cafe.loyaltyTierGoldThreshold,
    })
  } catch (err) {
    logger.error({ msg: 'PATCH loyalty settings error', err })
    return res.status(500).json({ error: 'Failed to update settings' })
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
      return res.json({ phone, points: 0, lifetimePoints: 0, ledger: [] })
    }

    // Return last 20 entries (newest first) — ledger is append-only in MongoDB
    const recent = [...account.ledger].reverse().slice(0, 20)

    return res.json({ phone, points: account.points, lifetimePoints: account.lifetimePoints, ledger: recent })
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

    const updated = await redeemPoints(cafeId, phone, points)
    return res.json({ phone, pointsRedeemed: points, newBalance: updated.points })
  } catch (err: any) {
    logger.error({ msg: 'POST loyalty redeem error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to redeem points' })
  }
})

// ─── K20 — Membership tier ────────────────────────────────────────────────────

router.get('/api/loyalty/:phone/tier', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const info = await getTierInfo(cafeId, req.params.phone as string)
    return res.json(info)
  } catch (err) {
    logger.error({ msg: 'GET loyalty tier error', err })
    return res.status(500).json({ error: 'Failed to fetch tier info' })
  }
})

// ─── K20 — Reward catalog ─────────────────────────────────────────────────────

router.get('/api/loyalty/rewards', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const rewards = await listRewards(cafeId, req.query.all !== 'true')
    return res.json({ rewards })
  } catch (err) {
    logger.error({ msg: 'GET loyalty rewards error', err })
    return res.status(500).json({ error: 'Failed to fetch rewards' })
  }
})

router.post('/api/loyalty/rewards', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { name, description, pointsCost } = req.body as { name?: string; description?: string; pointsCost?: number }
    if (!name?.trim() || !Number.isInteger(pointsCost) || (pointsCost as number) <= 0) {
      return res.status(400).json({ error: 'name and a positive integer pointsCost are required' })
    }
    const reward = await createReward(cafeId, { name: name.trim(), description, pointsCost: pointsCost as number })
    return res.status(201).json({ reward })
  } catch (err: any) {
    logger.error({ msg: 'POST loyalty rewards error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to create reward' })
  }
})

router.patch('/api/loyalty/rewards/:id/deactivate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const reward = await deactivateReward(cafeId, req.params.id as string)
    return res.json({ reward })
  } catch (err: any) {
    logger.error({ msg: 'PATCH loyalty reward deactivate error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to deactivate reward' })
  }
})

router.post('/api/loyalty/rewards/:id/redeem', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { phone } = req.body as { phone?: string }
    if (!phone) return res.status(400).json({ error: 'phone is required' })

    const account = await redeemReward(cafeId, phone, req.params.id as string)
    return res.json({ phone, newBalance: account.points })
  } catch (err: any) {
    logger.error({ msg: 'POST loyalty reward redeem error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to redeem reward' })
  }
})

export default router
