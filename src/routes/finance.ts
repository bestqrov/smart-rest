import express, { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

const router = express.Router()

// ─── GET /api/finance/status ──────────────────────────────────────────────────
// Returns the current billing snapshot for the authenticated cafe's dashboard.

router.get('/api/finance/status', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: {
        walletBalance: true,
        billingStatus: true,
        isActive: true,
        trialEndsAt: true,
        hasExtendedTrial: true,
        hasSocialShareAddon: true,
        currency: true,
        country: true
      }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const now = new Date()
    const inTrial = cafe.trialEndsAt ? now < cafe.trialEndsAt : false

    return res.json({
      walletBalance: (cafe.walletBalance as unknown as Prisma.Decimal).toString(),
      billingStatus: cafe.billingStatus,
      isActive: cafe.isActive,
      trialEndsAt: cafe.trialEndsAt,
      hasExtendedTrial: cafe.hasExtendedTrial,
      hasSocialShareAddon: cafe.hasSocialShareAddon,
      currency: cafe.currency,
      country: cafe.country,
      inTrial
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/status error', err })
    return res.status(500).json({ error: 'Failed to fetch billing status' })
  }
})

// ─── GET /api/finance/billing-package ────────────────────────────────────────
// Returns AI-computed billing tiers + AOV for the trial-end decision screen.

router.get('/api/finance/billing-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { billingStatus: true, country: true, trialEndsAt: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const { aov, orderCount } = await computeCafeAOV(cafeId)

    const tiers = await prisma.billingTier.findMany({
      where: { cafeId },
      orderBy: { minOrderValue: 'asc' }
    })

    return res.json({
      aov: aov.toString(),
      orderCount,
      tiers: tiers.map((t) => ({
        id: t.id,
        minOrderValue: (t.minOrderValue as unknown as Prisma.Decimal).toString(),
        maxOrderValue: (t.maxOrderValue as unknown as Prisma.Decimal).toString(),
        feeAmount:     (t.feeAmount     as unknown as Prisma.Decimal).toString(),
        isSocialShareFee: t.isSocialShareFee
      })),
      billingStatus: cafe.billingStatus,
      trialEndsAt: cafe.trialEndsAt
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/billing-package error', err })
    return res.status(500).json({ error: 'Failed to fetch billing package' })
  }
})

// ─── POST /api/finance/accept-ai-package (Action A) ──────────────────────────
// Admin accepts the AI commission package and switches to post-paid mode.

router.post('/api/finance/accept-ai-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    await prisma.cafe.update({
      where: { id: cafeId },
      data: { billingStatus: 'COLLECTING_DEBT', isActive: true }
    })

    logger.info({ msg: 'Cafe accepted AI billing package', cafeId })
    return res.json({ message: 'AI commission package accepted. Post-paid billing is now active.' })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/accept-ai-package error', err })
    return res.status(500).json({ error: 'Failed to accept package' })
  }
})

// ─── POST /api/finance/extend-trial (Action B) ───────────────────────────────
// Pays $5 to extend the free trial by exactly 7 more days. One-time only.

router.post('/api/finance/extend-trial', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { trialEndsAt: true, hasExtendedTrial: true, walletBalance: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    if (cafe.hasExtendedTrial) {
      return res.status(400).json({
        error: 'Trial extension already used. You can only extend once.'
      })
    }
    if (!cafe.trialEndsAt) {
      return res.status(400).json({ error: 'No active trial found' })
    }

    // In production: verify a $5 payment reference in req.body (Stripe / local gateway)
    // const { paymentRef } = req.body
    // await verifyPayment(paymentRef, 5_00) — placeholder

    const newTrialEndsAt = new Date(cafe.trialEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    const prevBalance = cafe.walletBalance as unknown as Prisma.Decimal

    await prisma.$transaction(async (tx) => {
      await tx.cafe.update({
        where: { id: cafeId },
        data: {
          hasExtendedTrial: true,
          trialEndsAt: newTrialEndsAt,
          billingStatus: 'GRACE_PERIOD',
          isActive: true
        }
      })

      await tx.walletLog.create({
        data: {
          cafeId,
          amount: new Prisma.Decimal('5.00'),
          type: 'TRIAL_EXTENSION',
          previousBalance: prevBalance,
          newBalance: prevBalance  // extension fee doesn't affect wallet balance
        }
      })
    })

    logger.info({ msg: 'Trial extended', cafeId, newTrialEndsAt })
    return res.json({
      message: 'Trial extended by 7 days.',
      trialEndsAt: newTrialEndsAt
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/extend-trial error', err })
    return res.status(500).json({ error: 'Failed to extend trial' })
  }
})

// ─── POST /api/finance/settle-debt ───────────────────────────────────────────
// Called after a successful Stripe / gateway payment to clear negative balance
// and immediately restore the QR lock on the venue.

router.post('/api/finance/settle-debt', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { walletBalance: true, billingStatus: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const prevBalance = cafe.walletBalance as unknown as Prisma.Decimal

    // Already clear — idempotent
    if (!prevBalance.lessThan(0) && cafe.billingStatus !== 'SUSPENDED') {
      return res.json({ message: 'No outstanding debt.', walletBalance: prevBalance.toString() })
    }

    const settled = await prisma.$transaction(async (tx) => {
      const updated = await tx.cafe.update({
        where: { id: cafeId },
        data: {
          walletBalance: new Prisma.Decimal('0.00'),
          isActive: true,
          billingStatus: 'COLLECTING_DEBT'
        },
        select: { walletBalance: true, billingStatus: true, isActive: true }
      })

      await tx.walletLog.create({
        data: {
          cafeId,
          amount: prevBalance.abs(), // positive: money received
          type: 'PAYMENT_SETTLEMENT',
          previousBalance: prevBalance,
          newBalance: new Prisma.Decimal('0.00')
        }
      })

      return updated
    })

    logger.info({ msg: 'Debt settled, venue reactivated', cafeId, prevBalance: prevBalance.toString() })

    return res.json({
      message: 'Debt settled. QR lock lifted — venue is now active.',
      walletBalance: (settled.walletBalance as unknown as Prisma.Decimal).toString(),
      billingStatus: settled.billingStatus,
      isActive: settled.isActive
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/settle-debt error', err })
    return res.status(500).json({ error: 'Settlement failed' })
  }
})

// ─── GET /api/finance/wallet-log ─────────────────────────────────────────────
// Paginated wallet transaction history.

router.get('/api/finance/wallet-log', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit

    const [total, logs] = await Promise.all([
      prisma.walletLog.count({ where: { cafeId } }),
      prisma.walletLog.findMany({
        where: { cafeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, amount: true, type: true,
          previousBalance: true, newBalance: true,
          createdAt: true, orderId: true
        }
      })
    ])

    return res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      logs: logs.map((l) => ({
        ...l,
        amount:          (l.amount          as unknown as Prisma.Decimal).toString(),
        previousBalance: (l.previousBalance as unknown as Prisma.Decimal).toString(),
        newBalance:      (l.newBalance      as unknown as Prisma.Decimal).toString()
      }))
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/wallet-log error', err })
    return res.status(500).json({ error: 'Failed to fetch wallet log' })
  }
})

// ─── POST /api/finance/regenerate-package ────────────────────────────────────
// Manually re-runs the AI tier suggestion (useful after significant order growth).

router.post('/api/finance/regenerate-package', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    await suggestBillingTiers(cafeId, cafe.country)
    return res.json({ message: 'Billing package regenerated from latest order data.' })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/regenerate-package error', err })
    return res.status(500).json({ error: 'Failed to regenerate package' })
  }
})

export default router
