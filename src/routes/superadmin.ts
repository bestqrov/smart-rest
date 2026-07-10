import express, { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

import logger from '../logger'
import prisma from '../prisma'
import { JWT_SECRET } from '../config'
import { sendEmail } from '../services/email'
import {
  applySmartSubscription,
  computeSmartSubscription,
  runTrialEndSweep,
  getExpiringTrials
} from '../services/smartBilling'

const router = express.Router()

// ─── Full cascade delete for a single cafe ────────────────────────────────────
async function deleteCafeCascade(id: string) {
  await prisma.cafeCustomer.deleteMany({ where: { cafeId: id } })
  await prisma.activeSession.deleteMany({ where: { cafeId: id } })
  await prisma.clientSession.deleteMany({ where: { cafeId: id } })
  await prisma.loyaltyAccount.deleteMany({ where: { cafeId: id } })
  await prisma.reviewGallery.deleteMany({ where: { cafeId: id } })
  await prisma.marketingCampaign.deleteMany({ where: { cafeId: id } })
  await prisma.event.deleteMany({ where: { cafeId: id } })
  await prisma.guest.deleteMany({ where: { cafeId: id } })
  await prisma.zone.deleteMany({ where: { cafeId: id } })
  await prisma.maintenanceRecord.deleteMany({ where: { cafeId: id } })
  await prisma.equipment.deleteMany({ where: { cafeId: id } })
  await prisma.supplierInvoice.deleteMany({ where: { cafeId: id } })
  await prisma.purchaseRequisition.deleteMany({ where: { cafeId: id } })
  await prisma.purchaseOrder.deleteMany({ where: { cafeId: id } })
  await prisma.inventorySupplier.deleteMany({ where: { cafeId: id } })
  await prisma.walletLog.deleteMany({ where: { cafeId: id } })
  await prisma.fraudAlert.deleteMany({ where: { cafeId: id } })
  await prisma.feedback.deleteMany({ where: { cafeId: id } })
  await prisma.qrScan.deleteMany({ where: { cafeId: id } })
  await prisma.printerLog.deleteMany({ where: { cafeId: id } })
  await prisma.onlinePayment.deleteMany({ where: { cafeId: id } })
  await prisma.paymentRequest.deleteMany({ where: { cafeId: id } })
  await prisma.billRequest.deleteMany({ where: { cafeId: id } })
  await prisma.waiterCall.deleteMany({ where: { cafeId: id } })
  await prisma.reservation.deleteMany({ where: { cafeId: id } })
  await prisma.expense.deleteMany({ where: { cafeId: id } })
  await prisma.stockItem.deleteMany({ where: { cafeId: id } })
  await prisma.recipe.deleteMany({ where: { cafeId: id } })
  const orderIds = (await prisma.order.findMany({ where: { cafeId: id }, select: { id: true } })).map(o => o.id)
  if (orderIds.length > 0) await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.order.deleteMany({ where: { cafeId: id } })
  await prisma.cashierShift.deleteMany({ where: { cafeId: id } })
  await prisma.waiterShift.deleteMany({ where: { cafeId: id } })
  await prisma.waiterQRToken.deleteMany({ where: { cafeId: id } })
  await prisma.billingTier.deleteMany({ where: { cafeId: id } })
  await prisma.staff.deleteMany({ where: { cafeId: id } })
  await prisma.seat.deleteMany({ where: { cafeId: id } })
  await prisma.table.deleteMany({ where: { cafeId: id } })
  const catIds = (await prisma.category.findMany({ where: { cafeId: id }, select: { id: true } })).map(c => c.id)
  if (catIds.length > 0) await prisma.product.deleteMany({ where: { categoryId: { in: catIds } } })
  await prisma.category.deleteMany({ where: { cafeId: id } })
  await prisma.user.deleteMany({ where: { cafeId: id } })
  await prisma.cafe.delete({ where: { id } })
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret        = req.header('x-superadmin-secret')
  const email         = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  if (!expectedSecret || secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' })
  if (expectedEmail && email !== expectedEmail)      return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// ─── GET /api/superadmin/overview ─────────────────────────────────────────────

router.get('/api/superadmin/overview', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [totalCafes, activeCafes, suspendedCafes, trialCafes, debtAgg, revenueAgg, mrrAgg] = await Promise.all([
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
      }),
      // MRR = total commission collected this calendar month
      prisma.order.aggregate({
        _sum: { totalCommission: true },
        where: { isPaid: true, createdAt: { gte: monthStart } }
      })
    ])

    const totalDebt = Math.abs(debtAgg._sum.walletBalance || 0).toFixed(2)
    const totalRevenue = (revenueAgg._sum.totalPrice || 0).toFixed(2)
    const mrr = parseFloat((mrrAgg._sum.totalCommission || 0).toFixed(2))

    return res.json({
      totalCafes,
      activeCafes,
      suspendedCafes,
      trialCafes,
      collectingDebt: totalCafes - activeCafes - trialCafes - suspendedCafes,
      totalAccruedDebt: totalDebt,
      totalRevenue,
      mrr
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
    const id  = req.params.id as string
    const now = new Date()
    await prisma.cafe.update({
      where: { id },
      data:  { isActive: false, billingStatus: 'SUSPENDED', suspendedAt: now, gracePeriodEndsAt: null }
    })
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

    await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.findUnique({
        where:  { id },
        select: { walletBalance: true }
      })
      const prevBalance = cafe?.walletBalance ?? 0

      await tx.cafe.update({
        where: { id },
        data: {
          isActive:          true,
          billingStatus:     'COLLECTING_DEBT',
          gracePeriodEndsAt: null,
          suspendedAt:       null,
          ...(clearDebt ? { walletBalance: 0 } : {})
        }
      })

      if (clearDebt && prevBalance < 0) {
        await tx.walletLog.create({
          data: {
            cafeId:          id,
            amount:          Math.abs(prevBalance),
            type:            'PAYMENT_SETTLEMENT',
            previousBalance: prevBalance,
            newBalance:      0
          }
        })
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

// ─── PATCH /api/superadmin/tenants/:id/billing-config ────────────────────────
// Save commission billing config: cycle (8/15/26), maintenance pack, ref prices

router.patch('/api/superadmin/tenants/:id/billing-config', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { billingCycle, maintenancePack, maintenanceFee, coffeeRefPrice, sandwichRefPrice } = req.body as {
      billingCycle?:    number
      maintenancePack?: boolean
      maintenanceFee?:  number | null
      coffeeRefPrice?:  number | null
      sandwichRefPrice?: number | null
    }

    const nextBillingDate = billingCycle
      ? new Date(Date.now() + billingCycle * 24 * 60 * 60 * 1000)
      : undefined

    await prisma.cafe.update({
      where: { id },
      data: {
        ...(billingCycle   != null && { billingCycle:   Number(billingCycle)  }),
        ...(maintenancePack != null && { maintenancePack }),
        ...(maintenanceFee  !== undefined && { maintenanceFee: maintenanceFee != null ? Number(maintenanceFee) : null }),
        ...(coffeeRefPrice  !== undefined && { coffeeRefPrice:  coffeeRefPrice  != null ? Number(coffeeRefPrice)  : null }),
        ...(sandwichRefPrice !== undefined && { sandwichRefPrice: sandwichRefPrice != null ? Number(sandwichRefPrice) : null }),
        ...(nextBillingDate && { nextBillingDate }),
        // Subscription is free — reset monthlyFee to 0
        monthlyFee: 0,
      }
    })
    logger.info({ msg: 'SuperAdmin updated billing config', cafeId: id, billingCycle, maintenancePack })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'billing-config error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

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

// ─── GET /api/superadmin/mrr-breakdown ───────────────────────────────────────
// Estimated MRR in USD based on commission tiers × order volume + maintenance packs.
// Grouped by country with date of last computation.

const USD_RATES: Record<string, number> = {
  MAD: 0.097, SAR: 0.267, AED: 0.272, KWD: 3.26, QAR: 0.274, BHD: 2.65,
  OMR: 2.60,  DZD: 0.0074, TND: 0.32, EGP: 0.021, LYD: 0.21, MRU: 0.025,
  XOF: 0.0016, XAF: 0.0016, KES: 0.0075,
  EUR: 1.09, GBP: 1.26, USD: 1.0
}

const COMMISSION_AVG: Record<string, number> = {
  MA: 4, SA: 6, AE: 6, KW: 0.6, QA: 6, BH: 0.6, OM: 0.4,
  DZ: 120, TN: 1.5, EG: 18, LY: 2, MR: 20,
  SN: 150, CI: 150, GA: 150, KE: 40,
  FR: 0.5, ES: 0.5, BE: 0.5, DE: 0.5, IT: 0.5, NL: 0.5, PT: 0.5,
  GB: 0.4, US: 0.5
}

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  MA:'MAD', SA:'SAR', AE:'AED', KW:'KWD', QA:'QAR', BH:'BHD', OM:'OMR',
  DZ:'DZD', TN:'TND', EG:'EGP', LY:'LYD', MR:'MRU',
  SN:'XOF', CI:'XOF', GA:'XAF', KE:'KES',
  FR:'EUR', ES:'EUR', BE:'EUR', DE:'EUR', IT:'EUR', NL:'EUR', PT:'EUR',
  GB:'GBP', US:'USD'
}

router.get('/api/superadmin/mrr-breakdown', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const cafes = await prisma.cafe.findMany({
      where:  { billingStatus: { in: ['COLLECTING_DEBT', 'GRACE_PERIOD'] } },
      select: {
        country: true, currency: true,
        weeklyOrderCount: true, billingCycle: true,
        maintenancePack: true, maintenanceFee: true,
        _count: { select: { orders: true } }
      }
    })

    type CountryRow = {
      country: string; currency: string; cafes: number
      monthlyCommissionLocal: number; monthlyMaintenanceUSD: number
      monthlyUSD: number
    }

    const byCountry: Record<string, CountryRow> = {}

    for (const c of cafes) {
      const country   = c.country.toUpperCase()
      const currency  = c.currency || CURRENCY_BY_COUNTRY[country] || 'MAD'
      const rate      = USD_RATES[currency] ?? USD_RATES['MAD']
      const avgComm   = COMMISSION_AVG[country] ?? 4
      const weekOrds  = c.weeklyOrderCount ?? 3
      // Monthly estimate: weekly orders × 4 weeks × avg commission
      const monthlyCommLocal = weekOrds * 4 * avgComm
      const monthlyCommUSD   = monthlyCommLocal * rate
      const monthlyMaintUSD  = c.maintenancePack ? (c.maintenanceFee ?? 25) * (30 / (c.billingCycle ?? 30)) : 0

      if (!byCountry[country]) {
        byCountry[country] = { country, currency, cafes: 0, monthlyCommissionLocal: 0, monthlyMaintenanceUSD: 0, monthlyUSD: 0 }
      }
      byCountry[country].cafes++
      byCountry[country].monthlyCommissionLocal += monthlyCommLocal
      byCountry[country].monthlyMaintenanceUSD  += monthlyMaintUSD
      byCountry[country].monthlyUSD             += monthlyCommUSD + monthlyMaintUSD
    }

    const rows = Object.values(byCountry).sort((a, b) => b.monthlyUSD - a.monthlyUSD)
    const totalMRR_USD = rows.reduce((s, r) => s + r.monthlyUSD, 0)

    return res.json({
      totalMRR_USD:   parseFloat(totalMRR_USD.toFixed(2)),
      computedAt:     new Date().toISOString(),
      byCountry:      rows.map(r => ({
        ...r,
        monthlyCommissionLocal: parseFloat(r.monthlyCommissionLocal.toFixed(2)),
        monthlyMaintenanceUSD:  parseFloat(r.monthlyMaintenanceUSD.toFixed(2)),
        monthlyUSD:             parseFloat(r.monthlyUSD.toFixed(2)),
      }))
    })
  } catch (err) {
    logger.error({ msg: 'mrr-breakdown error', err })
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
          billingCycle: true, maintenancePack: true,
          maintenanceFee: true, nextBillingDate: true,
          isSmartInventoryEnabled: true,
          inventoryActivationRequested: true,
          inventoryActivationRequestedAt: true,
          isDemo: true,
          _count: { select: { orders: true, tables: true, staff: true, categories: true } }
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
        data:  {
          isActive:          true,
          billingStatus:     'COLLECTING_DEBT',
          walletBalance:     0,
          gracePeriodEndsAt: null,
          suspendedAt:       null,
        }
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

      // Generate a unique billing invoice for audit trail
      const year     = new Date().getFullYear()
      const yearCount = await tx.billingInvoice.count({ where: { issuedAt: { gte: new Date(`${year}-01-01`) } } })
      const invoiceNumber = `INV-${year}-${String(yearCount + 1).padStart(5, '0')}`
      await tx.billingInvoice.create({
        data: {
          cafeId:          payReq.cafeId,
          invoiceNumber,
          amount:          payReq.amount,
          currency:        payReq.currency,
          method:          payReq.method,
          paymentRequestId: id,
          status:          'PAID',
          paidAt:          new Date(),
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

// ─── GET /api/superadmin/tenants/:id/invoices ─────────────────────────────────
// Billing invoice history — unique invoice numbers, amounts, statuses.

router.get('/api/superadmin/tenants/:id/invoices', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id    = req.params['id'] as string
    const page  = Math.max(1, Number(req.query['page'])  || 1)
    const limit = Math.min(50, Number(req.query['limit']) || 20)

    const [total, invoices] = await Promise.all([
      prisma.billingInvoice.count({ where: { cafeId: id } }),
      prisma.billingInvoice.findMany({
        where:   { cafeId: id },
        orderBy: { issuedAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      })
    ])

    return res.json({ total, page, pages: Math.ceil(total / limit), invoices })
  } catch (err) {
    logger.error({ msg: 'GET invoices error', err })
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
        paymentLink: `${process.env.FRONTEND_URL || 'https://smartrestau.com'}/admin/billing`
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
    const { smartWifiEnabled, cashierPosEnabled, orderingEnabled, isSmartInventoryEnabled } = req.body as {
      smartWifiEnabled?:         boolean
      cashierPosEnabled?:        boolean
      orderingEnabled?:          boolean
      isSmartInventoryEnabled?:  boolean
    }

    const data: Record<string, boolean> = {}
    if (smartWifiEnabled        != null) data['smartWifiEnabled']        = Boolean(smartWifiEnabled)
    if (cashierPosEnabled       != null) data['cashierPosEnabled']       = Boolean(cashierPosEnabled)
    if (orderingEnabled         != null) data['orderingEnabled']         = Boolean(orderingEnabled)
    if (isSmartInventoryEnabled != null) data['isSmartInventoryEnabled'] = Boolean(isSmartInventoryEnabled)

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No feature flags provided' })
    }

    const updated = await prisma.cafe.update({
      where:  { id },
      data,
      select: {
        id: true, businessName: true,
        smartWifiEnabled: true, cashierPosEnabled: true, orderingEnabled: true,
        isSmartInventoryEnabled: true
      }
    })

    logger.info({ msg: 'Feature flags updated', cafeId: id, flags: data })
    return res.json({ ok: true, cafe: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH features error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/approve-inventory ──────────────────────
// Approve a restaurant's Smart Inventory activation request.
// Sets isSmartInventoryEnabled=true and clears the pending request flag.

router.post('/api/superadmin/tenants/:id/approve-inventory', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string

    const cafe = await prisma.cafe.findUnique({
      where:  { id },
      select: { inventoryActivationRequested: true, isSmartInventoryEnabled: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    await prisma.cafe.update({
      where: { id },
      data:  {
        isSmartInventoryEnabled:        true,
        inventoryActivationRequested:   false,
        inventoryActivationRequestedAt: null
      }
    })

    logger.info({ msg: 'Smart Inventory approved', cafeId: id })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'approve-inventory error', err })
    return res.status(500).json({ error: 'Failed to approve' })
  }
})

// ─── DELETE /api/superadmin/tenants/:id ───────────────────────────────────────
// Permanently deletes a cafe and ALL its associated data.
// Cascades through every model that references cafeId.

router.delete('/api/superadmin/tenants/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  try {
    const cafe = await prisma.cafe.findUnique({
      where:  { id },
      select: { id: true, businessName: true, subdomain: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    // Delete in dependency order (children before parents)
    await prisma.walletLog.deleteMany({ where: { cafeId: id } })
    await prisma.fraudAlert.deleteMany({ where: { cafeId: id } })
    await prisma.feedback.deleteMany({ where: { cafeId: id } })
    await prisma.qrScan.deleteMany({ where: { cafeId: id } })
    await prisma.printerLog.deleteMany({ where: { cafeId: id } })
    await prisma.onlinePayment.deleteMany({ where: { cafeId: id } })
    await prisma.paymentRequest.deleteMany({ where: { cafeId: id } })
    await prisma.billRequest.deleteMany({ where: { cafeId: id } })
    await prisma.waiterCall.deleteMany({ where: { cafeId: id } })
    await prisma.reservation.deleteMany({ where: { cafeId: id } })
    await prisma.expense.deleteMany({ where: { cafeId: id } })
    await prisma.stockItem.deleteMany({ where: { cafeId: id } })
    await prisma.recipe.deleteMany({ where: { cafeId: id } })
    // OrderItems via orders
    const orderIds = (await prisma.order.findMany({ where: { cafeId: id }, select: { id: true } })).map(o => o.id)
    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    }
    await prisma.order.deleteMany({ where: { cafeId: id } })
    await prisma.cashierShift.deleteMany({ where: { cafeId: id } })
    await prisma.waiterShift.deleteMany({ where: { cafeId: id } })
    await prisma.waiterQRToken.deleteMany({ where: { cafeId: id } })
    await prisma.billingTier.deleteMany({ where: { cafeId: id } })
    await prisma.staff.deleteMany({ where: { cafeId: id } })
    // Seats before tables
    await prisma.seat.deleteMany({ where: { cafeId: id } })
    await prisma.table.deleteMany({ where: { cafeId: id } })
    // Products before categories
    const catIds = (await prisma.category.findMany({ where: { cafeId: id }, select: { id: true } })).map(c => c.id)
    if (catIds.length > 0) {
      await prisma.product.deleteMany({ where: { categoryId: { in: catIds } } })
    }
    await prisma.category.deleteMany({ where: { cafeId: id } })
    await prisma.user.deleteMany({ where: { cafeId: id } })
    await prisma.cafe.delete({ where: { id } })

    logger.warn({ msg: 'SuperAdmin permanently deleted cafe', cafeId: id, subdomain: cafe.subdomain })
    return res.json({ deleted: true, cafeId: id, subdomain: cafe.subdomain })
  } catch (err) {
    logger.error({ msg: 'DELETE tenant error', cafeId: id, err })
    return res.status(500).json({ error: 'Failed to delete tenant' })
  }
})

// ─── POST /api/superadmin/tenants/bulk-delete ─────────────────────────────────
// Bulk-deletes multiple cafes. Skips any cafe with isDemo=true (protected).

router.post('/api/superadmin/tenants/bulk-delete', requireSuperAdmin, async (req: Request, res: Response) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids[] required' })
  }

  const cafes = await prisma.cafe.findMany({
    where: { id: { in: ids } },
    select: { id: true, subdomain: true, isDemo: true },
  })

  const toDelete = cafes.filter(c => !c.isDemo)
  const skipped  = cafes.filter(c =>  c.isDemo).map(c => c.id)

  const deleted: string[] = []
  const failed:  string[] = []

  for (const cafe of toDelete) {
    try {
      await deleteCafeCascade(cafe.id)
      deleted.push(cafe.id)
      logger.warn({ msg: 'SuperAdmin bulk-deleted cafe', cafeId: cafe.id, subdomain: cafe.subdomain })
    } catch (err) {
      logger.error({ msg: 'bulk-delete failed for cafe', cafeId: cafe.id, err })
      failed.push(cafe.id)
    }
  }

  return res.json({ deleted, skipped, failed })
})

// ─── PATCH /api/superadmin/tenants/:id/set-demo ───────────────────────────────
router.patch('/api/superadmin/tenants/:id/set-demo', requireSuperAdmin, async (req: Request, res: Response) => {
  const { isDemo } = req.body as { isDemo: boolean }
  await prisma.cafe.update({ where: { id: String(req.params['id']) }, data: { isDemo: !!isDemo } })
  return res.json({ ok: true })
})

// ─── DELETE /api/superadmin/users/by-email — purge test account by email ──────
// Deletes: verificationToken + User + their Cafe (full cascade) by email address.
// Used to reset test registrations without touching the DB directly.

router.delete('/api/superadmin/users/by-email', requireSuperAdmin, async (req: Request, res: Response) => {
  const email = ((req.query['email'] as string) ?? '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'email query param required' })

  try {
    // 1. Delete any pending magic-link tokens for this email
    const { count: tokensDeleted } = await prisma.verificationToken.deleteMany({ where: { email } })

    // 2. Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, cafeId: true }
    })

    if (!user) {
      return res.json({ message: 'No user found — tokens cleared', tokensDeleted, userDeleted: false })
    }

    const cafeId = user.cafeId

    // 3. If user has a cafe, cascade-delete the whole tenant
    if (cafeId) {
      // reuse the same cascade order as DELETE /api/superadmin/tenants/:id
      await prisma.walletLog.deleteMany({ where: { cafeId } })
      await prisma.fraudAlert.deleteMany({ where: { cafeId } })
      await prisma.feedback.deleteMany({ where: { cafeId } })
      await prisma.qrScan.deleteMany({ where: { cafeId } })
      await prisma.printerLog.deleteMany({ where: { cafeId } })
      await prisma.onlinePayment.deleteMany({ where: { cafeId } })
      await prisma.paymentRequest.deleteMany({ where: { cafeId } })
      await prisma.billRequest.deleteMany({ where: { cafeId } })
      await prisma.waiterCall.deleteMany({ where: { cafeId } })
      await prisma.systemNotification.deleteMany({ where: { cafeId } })
      await prisma.reviewGallery.deleteMany({ where: { cafeId } })
      await prisma.reservation.deleteMany({ where: { cafeId } })
      await prisma.expense.deleteMany({ where: { cafeId } })
      await prisma.purchaseOrder.deleteMany({ where: { cafeId } })
      await prisma.inventorySupplier.deleteMany({ where: { cafeId } })
      await prisma.stockItem.deleteMany({ where: { cafeId } })
      await prisma.recipe.deleteMany({ where: { cafeId } })
      const orderIds = (await prisma.order.findMany({ where: { cafeId }, select: { id: true } })).map(o => o.id)
      if (orderIds.length) await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { cafeId } })
      await prisma.cashierShift.deleteMany({ where: { cafeId } })
      await prisma.waiterShift.deleteMany({ where: { cafeId } })
      await prisma.waiterQRToken.deleteMany({ where: { cafeId } })
      await prisma.billingTier.deleteMany({ where: { cafeId } })
      await prisma.staff.deleteMany({ where: { cafeId } })
      await prisma.seat.deleteMany({ where: { cafeId } })
      await prisma.table.deleteMany({ where: { cafeId } })
      const catIds = (await prisma.category.findMany({ where: { cafeId }, select: { id: true } })).map(c => c.id)
      if (catIds.length) await prisma.product.deleteMany({ where: { categoryId: { in: catIds } } })
      await prisma.category.deleteMany({ where: { cafeId } })
      await prisma.user.deleteMany({ where: { cafeId } })
      await prisma.cafe.delete({ where: { id: cafeId } })
    } else {
      // User with no cafe — just delete the user record
      await prisma.user.delete({ where: { id: user.id } })
    }

    logger.warn({ msg: 'SuperAdmin purged test account by email', email, cafeId })
    return res.json({ success: true, email, tokensDeleted, cafeId: cafeId ?? null })
  } catch (err) {
    logger.error({ msg: 'delete-by-email error', email, err })
    return res.status(500).json({ error: 'Server error' })
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

// ─── GET /api/superadmin/revenue-history ──────────────────────────────────────
router.get('/api/superadmin/revenue-history', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const months: { month: string; value: number }[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const agg   = await prisma.order.aggregate({
        _sum: { totalCommission: true },
        where: { isPaid: true, createdAt: { gte: start, lt: end } }
      })
      months.push({
        month: start.toLocaleDateString('fr-MA', { month: 'short', year: '2-digit' }),
        value: parseFloat((agg._sum.totalCommission ?? 0).toFixed(2))
      })
    }

    return res.json(months)
  } catch (err) {
    logger.error({ msg: 'GET revenue-history error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/premium-plans ────────────────────────────────────────
router.get('/api/superadmin/premium-plans', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.premiumPlan.findMany({ orderBy: { country: 'asc' } })
    return res.json({ plans })
  } catch (err) {
    logger.error({ msg: 'premium-plans GET error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── PUT /api/superadmin/premium-plans/:country ───────────────────────────────
router.put('/api/superadmin/premium-plans/:country', requireSuperAdmin, async (req: Request, res: Response) => {
  const country = req.params.country as string
  const { monthlyPrice, currency, hasMarketing, hasCertification, hasAnalytics, hasNoCommission } = req.body as {
    monthlyPrice?:     number
    currency?:         string
    hasMarketing?:     boolean
    hasCertification?: boolean
    hasAnalytics?:     boolean
    hasNoCommission?:  boolean
  }

  try {
    const plan = await prisma.premiumPlan.upsert({
      where:  { country },
      update: {
        ...(monthlyPrice     !== undefined ? { monthlyPrice }     : {}),
        ...(currency         !== undefined ? { currency }         : {}),
        ...(hasMarketing     !== undefined ? { hasMarketing }     : {}),
        ...(hasCertification !== undefined ? { hasCertification } : {}),
        ...(hasAnalytics     !== undefined ? { hasAnalytics }     : {}),
        ...(hasNoCommission  !== undefined ? { hasNoCommission }  : {}),
      },
      create: {
        country,
        currency:         currency         ?? 'MAD',
        monthlyPrice:     monthlyPrice     ?? 0,
        hasMarketing:     hasMarketing     ?? true,
        hasCertification: hasCertification ?? true,
        hasAnalytics:     hasAnalytics     ?? true,
        hasNoCommission:  hasNoCommission  ?? true,
      },
    })
    return res.json({ ok: true, plan })
  } catch (err) {
    logger.error({ msg: 'premium-plans PUT error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── POST /api/superadmin/tenants/purge-test ──────────────────────────────────
// Deletes ALL cafes not in the `keep` list (subdomains). isDemo cafes are always kept.

router.post('/api/superadmin/tenants/purge-test', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { keep = [] } = req.body as { keep?: string[] }
    const protected_ = [...keep, process.env.DEMO_SUBDOMAIN ?? 'plage']

    const cafes = await prisma.cafe.findMany({
      where: { subdomain: { notIn: protected_ }, isDemo: false },
      select: { id: true, subdomain: true },
    })

    const deleted: string[] = []
    const failed:  string[] = []

    for (const cafe of cafes) {
      try {
        await deleteCafeCascade(cafe.id)
        deleted.push(cafe.subdomain)
        logger.warn({ msg: 'SuperAdmin purge-test deleted cafe', subdomain: cafe.subdomain })
      } catch (err) {
        logger.error({ msg: 'purge-test failed for cafe', subdomain: cafe.subdomain, err })
        failed.push(cafe.subdomain)
      }
    }

    return res.json({ deleted, failed, protected: protected_ })
  } catch (err) {
    logger.error({ msg: 'purge-test error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/superadmin/password-reset-requests ──────────────────────────────

router.get('/api/superadmin/password-reset-requests', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const requests = await (prisma as any).passwordResetRequest.findMany({
      where: { status: { in: ['PENDING', 'SENT'] } },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(requests)
  } catch (err) {
    logger.error({ msg: 'get reset requests error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// Generates + emails a 10-minute temp password for a user. Shared by the
// request-approval flow and the direct superadmin-initiated reset below.
async function sendTempPassword(userId: string, email: string): Promise<Date> {
  const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase()
  const tempHash = await bcrypt.hash(tempPassword, 10)
  const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await prisma.user.update({
    where: { id: userId },
    data: {
      tempPasswordHash:   tempHash,
      tempPasswordExpiry: expiry,
      forcePasswordChange: true,
    },
  })

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e293b">SmartRestau — Mot de passe temporaire</h2>
      <p>Bonjour,</p>
      <p>Voici votre mot de passe temporaire pour vous connecter :</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#7c3aed;
        background:#f5f3ff;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0">
        ${tempPassword}
      </div>
      <p style="color:#ef4444;font-weight:600">⚠️ Valable 10 minutes uniquement.</p>
      <p>Après connexion, vous serez invité à définir un nouveau mot de passe.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#94a3b8">SmartRestau SaaS</p>
    </div>`

  await sendEmail(email, 'Votre mot de passe temporaire — SmartRestau', html)
  logger.info({ msg: 'temp password sent', email, expiry })
  return expiry
}

// ─── POST /api/superadmin/password-reset-requests/:id/approve ─────────────────

router.post('/api/superadmin/password-reset-requests/:id/approve', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const request = await (prisma as any).passwordResetRequest.findUnique({
      where: { id: req.params.id },
    })
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (!['PENDING', 'SENT'].includes(request.status)) {
      return res.status(400).json({ error: 'Request already resolved' })
    }

    const expiry = await sendTempPassword(request.userId, request.email)

    await (prisma as any).passwordResetRequest.update({
      where: { id: request.id },
      data: { status: 'SENT' },
    })

    return res.json({ ok: true, expiry })
  } catch (err) {
    logger.error({ msg: 'approve reset request error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/superadmin/password-reset-requests/:id/reject ──────────────────

router.post('/api/superadmin/password-reset-requests/:id/reject', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await (prisma as any).passwordResetRequest.update({
      where: { id: req.params.id },
      data: { status: 'EXPIRED' },
    })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'reject reset request error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/superadmin/credentials-directory ─────────────────────────────────
// Searchable directory of every restaurant/client account — business name,
// subdomain, country, and owner login email(s). No password material is ever
// returned (passwords are one-way hashed); resets go through the endpoint below.

router.get('/api/superadmin/credentials-directory', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q     = (req.query['q'] as string | undefined)?.trim()
    const page  = Math.max(1, Number(req.query['page'])  || 1)
    const limit = Math.min(100, Number(req.query['limit']) || 50)

    const where = q ? {
      OR: [
        { name:         { contains: q, mode: 'insensitive' as const } },
        { businessName: { contains: q, mode: 'insensitive' as const } },
        { subdomain:    { contains: q, mode: 'insensitive' as const } },
        { users: { some: { email: { contains: q, mode: 'insensitive' as const } } } },
      ],
    } : {}

    const [total, cafes] = await Promise.all([
      prisma.cafe.count({ where }),
      prisma.cafe.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, businessName: true, subdomain: true,
          country: true, billingStatus: true, isDemo: true,
          users: { select: { id: true, email: true, forcePasswordChange: true } },
        },
      }),
    ])

    return res.json({ total, page, pages: Math.ceil(total / limit), cafes })
  } catch (err) {
    logger.error({ msg: 'credentials-directory error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/superadmin/users/:id/reset-password ─────────────────────────────
// Directly issue a temp password for a given user, without requiring the
// client to have filed a PasswordResetRequest first.

router.post('/api/superadmin/users/:id/reset-password', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const expiry = await sendTempPassword(user.id, user.email)
    return res.json({ ok: true, expiry })
  } catch (err) {
    logger.error({ msg: 'direct reset-password error', err })
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
