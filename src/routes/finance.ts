import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

const router = express.Router()

// ─── GET /api/finance/status ──────────────────────────────────────────────────

router.get('/api/finance/status', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { walletBalance: true, billingStatus: true, isActive: true, trialEndsAt: true, hasExtendedTrial: true, hasSocialShareAddon: true, currency: true, country: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    return res.json({
      ...cafe,
      walletBalance: cafe.walletBalance,
      inTrial: cafe.trialEndsAt ? new Date() < cafe.trialEndsAt : false
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/status error', err })
    return res.status(500).json({ error: 'Failed to fetch billing status' })
  }
})

// ─── GET /api/finance/billing-package ────────────────────────────────────────

router.get('/api/finance/billing-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { billingStatus: true, country: true, trialEndsAt: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const { aov, orderCount } = await computeCafeAOV(cafeId)
    const tiers = await prisma.billingTier.findMany({ where: { cafeId }, orderBy: { minOrderValue: 'asc' } })

    return res.json({
      aov,
      orderCount,
      tiers: tiers.map((t) => ({ id: t.id, from: t.minOrderValue, to: t.maxOrderValue, fee: t.feeAmount, isSocialShareFee: t.isSocialShareFee })),
      billingStatus: cafe.billingStatus,
      trialEndsAt: cafe.trialEndsAt,
      source: tiers.length > 0 ? 'AI' : 'DEFAULT'
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/billing-package error', err })
    return res.status(500).json({ error: 'Failed to fetch billing package' })
  }
})

// ─── POST /api/finance/accept-ai-package ─────────────────────────────────────

router.post('/api/finance/accept-ai-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    await prisma.cafe.update({ where: { id: cafeId }, data: { billingStatus: 'COLLECTING_DEBT', isActive: true } })
    return res.json({ message: 'AI commission package accepted. Post-paid billing is now active.' })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/accept-ai-package error', err })
    return res.status(500).json({ error: 'Failed to accept package' })
  }
})

// ─── POST /api/finance/extend-trial ──────────────────────────────────────────

router.post('/api/finance/extend-trial', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { trialEndsAt: true, hasExtendedTrial: true, walletBalance: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (cafe.hasExtendedTrial) return res.status(400).json({ error: 'Trial extension already used.' })
    if (!cafe.trialEndsAt) return res.status(400).json({ error: 'No active trial found' })

    const newTrialEndsAt = new Date(cafe.trialEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    const prevBalance = cafe.walletBalance

    await prisma.$transaction(async (tx) => {
      await tx.cafe.update({ where: { id: cafeId }, data: { hasExtendedTrial: true, trialEndsAt: newTrialEndsAt, billingStatus: 'GRACE_PERIOD', isActive: true } })
      await tx.walletLog.create({ data: { cafeId, amount: 5, type: 'TRIAL_EXTENSION', previousBalance: prevBalance, newBalance: prevBalance } })
    })

    return res.json({ message: 'Trial extended by 7 days.', trialEndsAt: newTrialEndsAt })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/extend-trial error', err })
    return res.status(500).json({ error: 'Failed to extend trial' })
  }
})

// ─── POST /api/finance/settle-debt ───────────────────────────────────────────

router.post('/api/finance/settle-debt', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { walletBalance: true, billingStatus: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const prevBalance = cafe.walletBalance
    if (prevBalance >= 0 && cafe.billingStatus !== 'SUSPENDED') {
      return res.json({ message: 'No outstanding debt.', walletBalance: prevBalance })
    }

    const settled = await prisma.$transaction(async (tx) => {
      const updated = await tx.cafe.update({
        where: { id: cafeId },
        data: { walletBalance: 0, isActive: true, billingStatus: 'COLLECTING_DEBT' },
        select: { walletBalance: true, billingStatus: true, isActive: true }
      })
      await tx.walletLog.create({
        data: { cafeId, amount: Math.abs(prevBalance), type: 'PAYMENT_SETTLEMENT', previousBalance: prevBalance, newBalance: 0 }
      })
      return updated
    })

    return res.json({ message: 'Debt settled. Venue is now active.', ...settled })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/settle-debt error', err })
    return res.status(500).json({ error: 'Settlement failed' })
  }
})

// ─── GET /api/finance/wallet-log ─────────────────────────────────────────────

router.get('/api/finance/wallet-log', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const page  = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip  = (page - 1) * limit

    const [total, logs] = await Promise.all([
      prisma.walletLog.count({ where: { cafeId } }),
      prisma.walletLog.findMany({
        where: { cafeId },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        select: { id: true, amount: true, type: true, previousBalance: true, newBalance: true, createdAt: true, orderId: true }
      })
    ])

    return res.json({ total, page, pages: Math.ceil(total / limit), hasMore: skip + logs.length < total, logs })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/wallet-log error', err })
    return res.status(500).json({ error: 'Failed to fetch wallet log' })
  }
})

// ─── POST /api/finance/regenerate-package ────────────────────────────────────

router.post('/api/finance/regenerate-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })
    await suggestBillingTiers(cafeId, cafe.country)
    return res.json({ message: 'Billing package regenerated.' })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/regenerate-package error', err })
    return res.status(500).json({ error: 'Failed to regenerate package' })
  }
})

export default router
