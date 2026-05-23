import express, { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import logger from '../logger'
import prisma from '../prisma'
import { JWT_SECRET } from '../config'
import {
  applySmartSubscription,
  computeSmartSubscription,
  runTrialEndSweep,
  getExpiringTrials
} from '../services/smartBilling'

const router = express.Router()

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.header('x-superadmin-secret')
  const expected = process.env.SUPERADMIN_SECRET
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  return next()
}

// ─── GET /api/superadmin/overview ─────────────────────────────────────────────

router.get('/api/superadmin/overview', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalCafes, activeCafes, suspendedCafes, trialCafes, debtAgg, revenueAgg] = await Promise.all([
      prisma.cafe.count(),
      prisma.cafe.count({ where: { isActive: true } }),
      prisma.cafe.count({ where: { billingStatus: 'SUSPENDED' } }),
      prisma.cafe.count({ where: { billingStatus: 'GRACE_PERIOD' } }),
      prisma.cafe.aggregate({
        _sum: { walletBalance: true },
        where: { walletBalance: { lt: 0 } }
      }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'COMPLETED', isPaid: true }
      })
    ])

    const totalDebt = Math.abs(debtAgg._sum.walletBalance || 0).toFixed(2)
    const totalRevenue = (revenueAgg._sum.totalPrice || 0).toFixed(2)

    return res.json({
      totalCafes,
      activeCafes,
      suspendedCafes,
      trialCafes,
      collectingDebt: totalCafes - activeCafes - trialCafes - suspendedCafes,
      totalAccruedDebt: totalDebt,
      totalRevenue
    })
  } catch (err) {
    logger.error({ msg: 'superadmin overview error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/tenants ──────────────────────────────────────────────

router.get('/api/superadmin/tenants', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const country = req.query.country as string | undefined
    const status  = req.query.status  as string | undefined
    const page    = Math.max(1, Number(req.query.page) || 1)
    const limit   = Math.min(50, Number(req.query.limit) || 20)

    const where: any = {
      ...(country ? { country } : {}),
      ...(status  ? { billingStatus: status } : {})
    }

    const [total, cafes] = await Promise.all([
      prisma.cafe.count({ where }),
      prisma.cafe.findMany({
        where,
        orderBy: { walletBalance: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, businessName: true, subdomain: true,
          country: true, currency: true, isActive: true,
          walletBalance: true, billingStatus: true,
          trialEndsAt: true, hasExtendedTrial: true,
          _count: { select: { orders: true } }
        }
      })
    ])

    return res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      cafes: cafes.map((c) => ({
        ...c,
        walletBalance: c.walletBalance
      }))
    })
  } catch (err) {
    logger.error({ msg: 'superadmin tenants error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/suspend ─────────────────────────────────

router.post('/api/superadmin/tenants/:id/suspend', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.cafe.update({ where: { id }, data: { isActive: false, billingStatus: 'SUSPENDED' } })
    logger.warn({ msg: 'SuperAdmin force-suspended cafe', cafeId: id })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/reactivate ──────────────────────────────

router.post('/api/superadmin/tenants/:id/reactivate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { clearDebt } = req.body as { clearDebt?: boolean }
    await prisma.cafe.update({
      where: { id },
      data: {
        isActive: true,
        billingStatus: 'COLLECTING_DEBT',
        ...(clearDebt ? { walletBalance: 0 } : {})
      }
    })
    logger.info({ msg: 'SuperAdmin reactivated cafe', cafeId: id, clearDebt })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/override-balance ───────────────────────

router.post('/api/superadmin/tenants/:id/override-balance', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { balance } = req.body as { balance: number }
    if (balance === undefined) return res.status(400).json({ error: 'balance required' })
    await prisma.cafe.update({ where: { id }, data: { walletBalance: Number(balance) } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/billing/run-sweep ───────────────────────────────────
// Manually trigger the trial-end analysis for all expired-trial cafes.

router.post('/api/superadmin/billing/run-sweep', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const results = await runTrialEndSweep()
    return res.json({ processed: results.length, results })
  } catch (err) {
    logger.error({ msg: 'billing sweep error', err })
    return res.status(500).json({ error: 'Sweep failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/billing/compute ────────────────────────
// Preview smart subscription for one café without persisting.

router.post('/api/superadmin/tenants/:id/billing/compute', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id     = req.params['id'] as string
    const result = await computeSmartSubscription(id)
    return res.json(result)
  } catch (err) {
    logger.error({ msg: 'billing compute error', err })
    return res.status(500).json({ error: 'Compute failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/billing/apply ──────────────────────────
// Run analysis AND persist the result.

router.post('/api/superadmin/tenants/:id/billing/apply', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id     = req.params['id'] as string
    const result = await applySmartSubscription(id)
    return res.json(result)
  } catch (err) {
    logger.error({ msg: 'billing apply error', err })
    return res.status(500).json({ error: 'Apply failed' })
  }
})

// ─── PATCH /api/superadmin/tenants/:id/ref-prices ────────────────────────────
// Manually set the reference coffee/sandwich prices for a café.

router.patch('/api/superadmin/tenants/:id/ref-prices', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { coffeeRefPrice, sandwichRefPrice } = req.body as {
      coffeeRefPrice?:  number
      sandwichRefPrice?: number
    }
    await prisma.cafe.update({
      where: { id },
      data: {
        ...(coffeeRefPrice   != null ? { coffeeRefPrice:   Number(coffeeRefPrice)   } : {}),
        ...(sandwichRefPrice != null ? { sandwichRefPrice: Number(sandwichRefPrice) } : {})
      }
    })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/superadmin/tenants/:id/extend-trial ──────────────────────────
// Extend the trial by N days from today (or from current trialEndsAt if future).

router.patch('/api/superadmin/tenants/:id/extend-trial', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id   = req.params['id'] as string
    const days = Number((req.body as { days?: number }).days ?? 7)
    if (isNaN(days) || days < 1 || days > 90) {
      return res.status(400).json({ error: 'days must be 1–90' })
    }

    const cafe = await prisma.cafe.findUnique({ where: { id }, select: { trialEndsAt: true } })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const base       = (cafe.trialEndsAt && cafe.trialEndsAt > new Date()) ? cafe.trialEndsAt : new Date()
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)

    await prisma.cafe.update({
      where: { id },
      data: {
        trialEndsAt,
        hasExtendedTrial: true,
        billingStatus:    'GRACE_PERIOD',
        subscriptionTier: null,   // reset so analysis reruns after new trial
        monthlyFee:       null
      }
    })

    logger.info({ msg: 'Trial extended', cafeId: id, days, trialEndsAt })
    return res.json({ ok: true, trialEndsAt })
  } catch (err) {
    logger.error({ msg: 'extend-trial error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/activate ────────────────────────────────
// Manually activate a café (skip trial, set COLLECTING_DEBT, optionally set fee).

router.post('/api/superadmin/tenants/:id/activate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { monthlyFee, tier } = req.body as { monthlyFee?: number; tier?: string }

    await prisma.cafe.update({
      where: { id },
      data: {
        isActive:         true,
        billingStatus:    'COLLECTING_DEBT',
        ...(monthlyFee != null ? { monthlyFee: Number(monthlyFee) } : {}),
        ...(tier        != null ? { subscriptionTier: tier }        : {})
      }
    })

    logger.info({ msg: 'Cafe manually activated', cafeId: id, monthlyFee, tier })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/billing/overview ────────────────────────────────────
// Extended KPIs including MRR and subscription breakdown.

router.get('/api/superadmin/billing/overview', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalCafes, activeCafes, suspendedCafes, trialCafes, economyCafes, advancedCafes, debtAgg, revenueAgg, mrrAgg] =
      await Promise.all([
        prisma.cafe.count(),
        prisma.cafe.count({ where: { isActive: true } }),
        prisma.cafe.count({ where: { billingStatus: 'SUSPENDED' } }),
        prisma.cafe.count({ where: { billingStatus: 'GRACE_PERIOD' } }),
        prisma.cafe.count({ where: { subscriptionTier: 'ECONOMY'  } }),
        prisma.cafe.count({ where: { subscriptionTier: 'ADVANCED' } }),
        prisma.cafe.aggregate({ _sum: { walletBalance: true }, where: { walletBalance: { lt: 0 } } }),
        prisma.order.aggregate({ _sum: { totalPrice: true }, where: { status: 'COMPLETED', isPaid: true } }),
        prisma.cafe.aggregate({ _sum: { monthlyFee: true }, where: { billingStatus: 'COLLECTING_DEBT', monthlyFee: { not: null } } })
      ])

    return res.json({
      totalCafes,
      activeCafes,
      suspendedCafes,
      trialCafes,
      economyCafes,
      advancedCafes,
      totalAccruedDebt: Math.abs(debtAgg._sum.walletBalance ?? 0),
      totalRevenue:     revenueAgg._sum.totalPrice ?? 0,
      mrr:              mrrAgg._sum.monthlyFee ?? 0
    })
  } catch (err) {
    logger.error({ msg: 'billing overview error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/tenants (enhanced) ───────────────────────────────────
// Re-register with subscription fields included (replaces the old endpoint above).

router.get('/api/superadmin/tenants/rich', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const country = req.query['country'] as string | undefined
    const status  = req.query['status']  as string | undefined
    const tier    = req.query['tier']    as string | undefined
    const page    = Math.max(1, Number(req.query['page'])  || 1)
    const limit   = Math.min(50, Number(req.query['limit']) || 20)

    const where: Record<string, unknown> = {
      ...(country ? { country }                : {}),
      ...(status  ? { billingStatus: status }  : {}),
      ...(tier    ? { subscriptionTier: tier } : {})
    }

    const [total, cafes] = await Promise.all([
      prisma.cafe.count({ where }),
      prisma.cafe.findMany({
        where,
        orderBy: { walletBalance: 'asc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id: true, name: true, businessName: true, subdomain: true,
          country: true, currency: true, isActive: true,
          walletBalance: true, billingStatus: true,
          trialEndsAt: true, hasExtendedTrial: true,
          subscriptionTier: true, monthlyFee: true,
          coffeeRefPrice: true, sandwichRefPrice: true,
          weeklyOrderCount: true,
          _count: { select: { orders: true } }
        }
      })
    ])

    return res.json({ total, page, pages: Math.ceil(total / limit), cafes })
  } catch (err) {
    logger.error({ msg: 'superadmin tenants/rich error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── Payment Requests — list / confirm / reject ───────────────────────────────

router.get('/api/superadmin/payment-requests', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query['status'] as string | undefined
    const page   = Math.max(1, Number(req.query['page'])  || 1)
    const limit  = Math.min(50, Number(req.query['limit']) || 20)

    const where = status ? { status } : {}

    const [total, requests] = await Promise.all([
      prisma.paymentRequest.count({ where }),
      prisma.paymentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cafe: { select: { id: true, businessName: true, subdomain: true, country: true, currency: true } }
        }
      })
    ])

    return res.json({ total, page, pages: Math.ceil(total / limit), requests })
  } catch (err) {
    logger.error({ msg: 'GET payment-requests error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.patch('/api/superadmin/payment-requests/:id/confirm', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id         = req.params['id'] as string
    const reviewNote = (req.body as { reviewNote?: string }).reviewNote

    const payReq = await prisma.paymentRequest.findUnique({
      where:   { id },
      include: { cafe: { select: { id: true, walletBalance: true, businessName: true } } }
    })
    if (!payReq) return res.status(404).json({ error: 'Not found' })

    await prisma.$transaction(async (tx) => {
      await tx.paymentRequest.update({
        where: { id },
        data:  { status: 'CONFIRMED', reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null }
      })
      await tx.cafe.update({
        where: { id: payReq.cafeId },
        data:  { isActive: true, billingStatus: 'COLLECTING_DEBT', walletBalance: 0 }
      })
      await tx.walletLog.create({
        data: {
          cafeId:          payReq.cafeId,
          amount:          payReq.amount,
          type:            'PAYMENT_SETTLEMENT',
          previousBalance: payReq.cafe.walletBalance,
          newBalance:      0,
        }
      })
    })

    logger.info({ msg: 'Payment confirmed — cafe reactivated', id, cafeId: payReq.cafeId })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PATCH payment-requests/:id/confirm error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

router.patch('/api/superadmin/payment-requests/:id/reject', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id         = req.params['id'] as string
    const reviewNote = (req.body as { reviewNote?: string }).reviewNote

    await prisma.paymentRequest.update({
      where: { id },
      data:  { status: 'REJECTED', reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null }
    })

    logger.info({ msg: 'Payment rejected', id })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PATCH payment-requests/:id/reject error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/webhooks/expiring-tomorrow ──────────────────────────
// n8n / Evolution API hook — returns trials expiring in the next 24h with fees.
// Protected by same superadmin secret (or a dedicated webhook token).

router.get('/api/superadmin/webhooks/expiring-tomorrow', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const hours  = Math.min(48, Number(req.query['hours'] ?? 24))
    const expiring = await getExpiringTrials(hours)

    return res.json({
      generatedAt: new Date().toISOString(),
      withinHours: hours,
      count:       expiring.length,
      cafes:       expiring.map(c => ({
        id:               c.id,
        businessName:     c.businessName,
        subdomain:        c.subdomain,
        country:          c.country,
        currency:         c.currency,
        trialEndsAt:      c.trialEndsAt,
        weeklyOrderCount: c.weeklyOrderCount ?? 0,
        tier:             c.subscriptionTier  ?? (c as any).tier,
        monthlyFee:       c.monthlyFee        ?? (c as any).monthlyFee,
        coffeePrice:      c.coffeeRefPrice    ?? (c as any).coffeePrice,
        sandwichPrice:    c.sandwichRefPrice  ?? (c as any).sandwichPrice,
        isPreview:        (c as any).preview ?? false,
        paymentLink: `${process.env.FRONTEND_URL || 'https://smartrestau.digima.cloud'}/admin/billing`
      }))
    })
  } catch (err) {
    logger.error({ msg: 'expiring-tomorrow webhook error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/superadmin/tenants/:id/features ───────────────────────────────
// Toggle feature flags per restaurant instantly.

router.patch('/api/superadmin/tenants/:id/features', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { smartWifiEnabled, cashierPosEnabled, orderingEnabled } = req.body as {
      smartWifiEnabled?:  boolean
      cashierPosEnabled?: boolean
      orderingEnabled?:   boolean
    }

    const data: Record<string, boolean> = {}
    if (smartWifiEnabled  != null) data['smartWifiEnabled']  = Boolean(smartWifiEnabled)
    if (cashierPosEnabled != null) data['cashierPosEnabled'] = Boolean(cashierPosEnabled)
    if (orderingEnabled   != null) data['orderingEnabled']   = Boolean(orderingEnabled)

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No feature flags provided' })
    }

    const updated = await prisma.cafe.update({
      where:  { id },
      data,
      select: {
        id: true, businessName: true,
        smartWifiEnabled: true, cashierPosEnabled: true, orderingEnabled: true
      }
    })

    logger.info({ msg: 'Feature flags updated', cafeId: id, flags: data })
    return res.json({ ok: true, cafe: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH features error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/impersonate ─────────────────────────────
// Generate a short-lived 1h JWT allowing the superadmin to log in as any
// restaurant admin. The token is flagged with `impersonated: true` so audit
// logs can identify impersonation sessions.

router.post('/api/superadmin/tenants/:id/impersonate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string

    const cafe = await prisma.cafe.findUnique({
      where:  { id },
      select: { id: true, businessName: true, subdomain: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    // Find the owner/admin user for this cafe
    const adminUser = await prisma.user.findFirst({
      where:  { cafeId: id },
      select: { id: true }
    })
    if (!adminUser) return res.status(404).json({ error: 'No admin user found for this cafe' })

    const token = jwt.sign(
      {
        userId:       adminUser.id,
        cafeId:       id,
        subdomain:    cafe.subdomain,
        impersonated: true,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    )

    logger.warn({
      msg:         'Superadmin impersonation token issued',
      cafeId:      id,
      businessName: cafe.businessName,
    })

    return res.json({ token, expiresIn: '1h', cafe: { id, businessName: cafe.businessName, subdomain: cafe.subdomain } })
  } catch (err) {
    logger.error({ msg: 'POST impersonate error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
