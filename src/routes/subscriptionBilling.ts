/**
 * Subscription billing routes.
 *
 *  Public (unguessable invoice token = the secret, like a payment link)
 *    GET  /api/billing/pay/:token                  invoice + how to pay
 *    POST /api/billing/pay/:token/report-transfer  { reference }
 *    POST /api/billing/pay/:token/card/start       → { redirectUrl } (platform Tap, if enabled)
 *    POST /api/billing/pay/:token/card/verify      → { status }
 *    GET|POST /api/billing/pay/:token/callback     Tap server callback → verify
 *
 *  Restaurant admin
 *    GET  /api/admin/subscription-invoices              own invoices + suspended flag
 *
 *  Superadmin
 *    GET  /api/superadmin/platform-payment              bank + Tap settings (key never returned)
 *    PUT  /api/superadmin/platform-payment
 *    GET  /api/superadmin/subscription-invoices?status=
 *    POST /api/superadmin/subscription-invoices/:id/confirm   bank transfer received
 *    POST /api/superadmin/subscription-invoices/:id/void
 *    POST /api/superadmin/billing/run-cycle             run issue + dunning now
 */

import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requireSuperAdmin } from './_billingAuthGuard'
import {
  BillingError, getPublicInvoice, reportTransfer, startCardPayment, verifyCardPayment,
  getPlatformPaymentSettings, publicSettings, savePlatformPaymentSettings,
  markInvoicePaid, runBillingCycle, refreshSuspension,
} from '../billing/subscriptionBilling'

const router    = Router()
const OBJECT_ID = /^[a-f0-9]{24}$/i
const publicLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false })

function fail(res: Response, err: unknown, msg: string) {
  if (err instanceof BillingError) return res.status(err.httpStatus).json({ error: err.message, code: err.code })
  logger.error({ msg: `subscriptionBilling: ${msg}`, err: (err as Error)?.message })
  return res.status(500).json({ error: msg })
}
const originOf = (req: Request) => `${req.protocol}://${req.get('host')}`

// ─── Public ──────────────────────────────────────────────────────────────────

router.get('/api/billing/pay/:token', publicLimiter, async (req, res) => {
  try { return res.json(await getPublicInvoice(String(req.params.token))) } catch (err) { return fail(res, err, 'Failed') }
})
router.post('/api/billing/pay/:token/report-transfer', publicLimiter, async (req, res) => {
  try { return res.json(await reportTransfer(String(req.params.token), String(req.body?.reference ?? ''))) } catch (err) { return fail(res, err, 'Failed') }
})
router.post('/api/billing/pay/:token/card/start', publicLimiter, async (req, res) => {
  try { return res.json(await startCardPayment(String(req.params.token), originOf(req))) } catch (err) { return fail(res, err, 'Could not start card payment') }
})
router.post('/api/billing/pay/:token/card/verify', publicLimiter, async (req, res) => {
  try { return res.json(await verifyCardPayment(String(req.params.token))) } catch (err) { return fail(res, err, 'Could not verify payment') }
})
async function callback(req: Request, res: Response) {
  try { await verifyCardPayment(String(req.params.token)) } catch (err) { logger.warn({ msg: 'billing callback verify failed', err: (err as Error)?.message }) }
  return res.status(200).json({ ok: true })
}
router.get('/api/billing/pay/:token/callback', callback)
router.post('/api/billing/pay/:token/callback', callback)

// ─── Restaurant admin ────────────────────────────────────────────────────────

router.get('/api/admin/subscription-invoices', authorizeAdmin, async (req, res) => {
  try {
    const cafeId = req.admin!.cafeId
    const [cafe, invoices] = await Promise.all([
      prisma.cafe.findUnique({ where: { id: cafeId }, select: { subscriptionSuspended: true, planId: true, monthlyFee: true, currentPeriodEnd: true } }),
      prisma.billingInvoice.findMany({
        where: { cafeId, planId: { not: null } }, orderBy: { issuedAt: 'desc' }, take: 24,
        select: { invoiceNumber: true, amount: true, currency: true, status: true, issuedAt: true, dueAt: true, paidAt: true, periodStart: true, periodEnd: true, payToken: true },
      }),
    ])
    return res.json({ suspended: !!cafe?.subscriptionSuspended, planId: cafe?.planId ?? null, nextInvoiceAt: cafe?.currentPeriodEnd ?? null, invoices })
  } catch (err) { return fail(res, err, 'Failed') }
})

// ─── Superadmin ──────────────────────────────────────────────────────────────

router.get('/api/superadmin/platform-payment', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const s = await getPlatformPaymentSettings()
    return res.json({ ...publicSettings(s), tapEnabled: s.tapEnabled, tapKeySaved: !!s.tapSecretEnc, tapSecretHint: s.tapSecretHint })
  } catch (err) { return fail(res, err, 'Failed') }
})
router.put('/api/superadmin/platform-payment', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try { return res.json(await savePlatformPaymentSettings(req.body ?? {})) } catch (err) { return fail(res, err, 'Failed to save') }
})

router.get('/api/superadmin/subscription-invoices', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const status = String(req.query.status ?? '')
    const invoices = await prisma.billingInvoice.findMany({
      where:   { planId: { not: null }, ...(status ? { status } : {}) },
      orderBy: { issuedAt: 'desc' }, take: 200,
      include: { cafe: { select: { name: true, subdomain: true, subscriptionSuspended: true } } },
    })
    return res.json({ invoices: invoices.map(i => ({
      id: i.id, invoiceNumber: i.invoiceNumber, cafeName: i.cafe.name, subdomain: i.cafe.subdomain, suspended: i.cafe.subscriptionSuspended,
      planId: i.planId, amount: i.amount, currency: i.currency, status: i.status, method: i.method,
      issuedAt: i.issuedAt, dueAt: i.dueAt, paidAt: i.paidAt, transferRef: i.transferRef, transferReportedAt: i.transferReportedAt,
      reminder1At: i.reminder1At, reminder2At: i.reminder2At, suspendedAt: i.suspendedAt, payToken: i.payToken,
    })) })
  } catch (err) { return fail(res, err, 'Failed') }
})

router.post('/api/superadmin/subscription-invoices/:id/confirm', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
    const ok = await markInvoicePaid(req.params.id, 'BANK_TRANSFER', req.body?.reference ? String(req.body.reference).slice(0, 80) : undefined)
    return ok ? res.json({ ok: true }) : res.status(409).json({ error: 'Invoice is not awaiting payment' })
  } catch (err) { return fail(res, err, 'Failed') }
})

router.post('/api/superadmin/subscription-invoices/:id/void', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
    const r = await prisma.billingInvoice.updateMany({ where: { id: req.params.id, status: { in: ['ISSUED', 'PENDING_CONFIRMATION'] } }, data: { status: 'VOID' } })
    if (!r.count) return res.status(409).json({ error: 'Invoice cannot be voided' })
    const inv = await prisma.billingInvoice.findUnique({ where: { id: req.params.id }, select: { cafeId: true } })
    if (inv) await refreshSuspension(inv.cafeId)   // voiding the overdue invoice must unlock the venue
    return res.json({ ok: true })
  } catch (err) { return fail(res, err, 'Failed') }
})

router.post('/api/superadmin/billing/run-cycle', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try { return res.json(await runBillingCycle()) } catch (err) { return fail(res, err, 'Billing cycle failed') }
})

export default router
