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
      select: {
        walletBalance: true, billingStatus: true, isActive: true,
        trialEndsAt: true, hasExtendedTrial: true, hasSocialShareAddon: true,
        currency: true, country: true, monthlyFee: true, subscriptionTier: true,
      }
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

// ─── GET /api/finance/subscription-invoice ───────────────────────────────────
// Commission-based billing: returns accumulated wallet debt + maintenance fee.
// Subscription is FREE — amount = |walletBalance| + maintenanceFee (if applicable)

router.get('/api/finance/subscription-invoice', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: {
        walletBalance: true, currency: true, businessName: true, country: true,
        billingCycle: true, maintenancePack: true, maintenanceFee: true,
        nextBillingDate: true, subscriptionTier: true
      }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    // Accumulated commission debt (wallet goes negative as commissions are charged)
    const commissionDebt   = Math.max(0, -(cafe.walletBalance ?? 0))
    const maintenanceAmt   = cafe.maintenancePack ? (cafe.maintenanceFee ?? 25) : 0
    const totalDue         = parseFloat((commissionDebt + maintenanceAmt).toFixed(2))

    return res.json({
      amount:          totalDue,
      commissionDebt:  parseFloat(commissionDebt.toFixed(2)),
      maintenanceFee:  maintenanceAmt,
      maintenancePack: cafe.maintenancePack,
      currency:        cafe.currency,
      billingCycle:    cafe.billingCycle ?? 15,
      nextBillingDate: cafe.nextBillingDate ?? null,
      businessName:    cafe.businessName,
      country:         cafe.country,
      tier:            cafe.subscriptionTier ?? null,
      isFreeSubscription: true,
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/finance/subscription-invoice error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/finance/payment-request ───────────────────────────────────────
// Client submits payment proof. Notifies super admin via email.

router.post('/api/finance/payment-request', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { method, reference, proofNote, amount, currency } = req.body as {
      method: string; reference: string; proofNote?: string; amount?: number; currency?: string
    }

    const VALID_METHODS = ['BANK_TRANSFER', 'WESTERN_UNION', 'PAYPAL']
    if (!VALID_METHODS.includes(method)) return res.status(400).json({ error: 'Invalid method' })
    if (!reference?.trim())              return res.status(400).json({ error: 'reference required' })

    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { businessName: true, subdomain: true, monthlyFee: true, currency: true }
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const finalAmount   = Number(amount)   || cafe.monthlyFee || 0
    const finalCurrency = currency?.trim() || cafe.currency

    // Upsert: update existing PENDING request or create new one
    const existing = await prisma.paymentRequest.findFirst({ where: { cafeId, status: 'PENDING' } })
    const payload = {
      amount:    finalAmount,
      currency:  finalCurrency,
      method,
      reference: reference.trim(),
      proofNote: proofNote?.trim() || null,
    }
    const payReq = existing
      ? await prisma.paymentRequest.update({ where: { id: existing.id }, data: payload })
      : await prisma.paymentRequest.create({ data: { cafeId, ...payload } })

    // Notify super admin
    try {
      const { sendEmail } = await import('../services/email')
      const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'advicermano@gmail.com'
      const methodLabel = method === 'BANK_TRANSFER' ? 'Bank Transfer' : method === 'WESTERN_UNION' ? 'Western Union' : 'PayPal'
      await sendEmail(
        superAdminEmail,
        `💰 Payment Request — ${cafe.businessName} — ${finalAmount} ${finalCurrency}`,
        `<div style="font-family:system-ui,sans-serif;padding:24px;background:#f9fafb;border-radius:12px;max-width:560px;">
          <h2 style="color:#111827;margin:0 0 16px;">New Payment Request</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;">Cafe:</td><td style="font-weight:600;">${cafe.businessName} (${cafe.subdomain})</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Amount:</td><td style="font-weight:700;color:#059669;font-size:18px;">${finalAmount} ${finalCurrency}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Method:</td><td>${methodLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Reference:</td><td style="font-family:monospace;background:#f3f4f6;padding:4px 8px;border-radius:6px;">${reference.trim()}</td></tr>
            ${proofNote ? `<tr><td style="padding:6px 0;color:#6b7280;">Note:</td><td>${proofNote}</td></tr>` : ''}
          </table>
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Confirm via: PATCH /api/superadmin/payment-requests/${payReq.id}/confirm</p>
        </div>`
      )
    } catch (emailErr) {
      logger.warn({ msg: 'Payment notification email failed', emailErr })
    }

    logger.info({ msg: 'Payment request created', id: payReq.id, cafeId, method, finalAmount, finalCurrency })
    return res.status(201).json({ id: payReq.id, status: payReq.status })
  } catch (err) {
    logger.error({ msg: 'POST /api/finance/payment-request error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
