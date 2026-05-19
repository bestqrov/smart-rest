import express, { Request, Response, NextFunction } from 'express'

import logger from '../logger'
import prisma from '../prisma'

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

export default router
