/**
 * Agency partner program.
 *
 *  Superadmin (x-superadmin auth, same guard as other SA routes)
 *    GET   /api/superadmin/agencies                      list + live tier + totals
 *    POST  /api/superadmin/agencies                      { name, email, phone? } → { agency, temporaryPassword }
 *    GET   /api/superadmin/agencies/:id                  full dashboard (same shape as portal)
 *    PATCH /api/superadmin/agencies/:id                  { status?, accountManager?, coBrandName? }
 *    POST  /api/superadmin/agencies/:id/reset-password   → { temporaryPassword }
 *    PATCH /api/superadmin/commissions/:id/(approve|pay) in affiliateAdmin.ts
 *
 *  Agency portal (Bearer JWT role "affiliate")
 *    POST  /api/partners/login            { email, password } → { token }
 *    GET   /api/partners/me               dashboard
 *    POST  /api/partners/change-password  { currentPassword, newPassword }
 *
 *  Public
 *    GET   /api/partners/program          tier table (landing page)
 *    GET   /api/partners/ref/:code        { valid, agencyName } — signup banner
 */

import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import prisma from '../prisma'
import logger from '../logger'
import { requireSuperAdmin } from './_billingAuthGuard'
import {
  createAgency, resetAgencyPassword, getAgencyDashboard, getAgencyTier,
  partnerLogin, verifyPartnerToken, changePartnerPassword,
} from '../affiliate/AgencyService'
import { AGENCY_TIERS, CLIENT_DISCOUNT_PCT, FREE_MENU_SETUP_COUNT } from '../affiliate/AgencyTiers'

const router    = Router()
const OBJECT_ID = /^[a-f0-9]{24}$/i
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })

function fail(res: Response, err: unknown, msg = 'Failed') {
  logger.error({ msg: `agencyPartners: ${msg}`, err: (err as Error)?.message })
  return res.status(500).json({ error: msg })
}

// ─── Public ──────────────────────────────────────────────────────────────────

router.get('/api/partners/program', (_req, res) => {
  res.json({ tiers: AGENCY_TIERS, clientDiscountPct: CLIENT_DISCOUNT_PCT, freeMenuSetupCount: FREE_MENU_SETUP_COUNT })
})

router.get('/api/partners/ref/:code', async (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase()
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return res.json({ valid: false })
    const a = await prisma.affiliateAccount.findUnique({ where: { referralCode: code }, select: { name: true, status: true, type: true, coBrandName: true } })
    if (!a || a.status !== 'ACTIVE') return res.json({ valid: false })
    return res.json({
      valid:       true,
      agencyName:  a.coBrandName || a.name,
      discountPct: a.type === 'AGENCY' ? CLIENT_DISCOUNT_PCT : 0,
    })
  } catch (err) { return fail(res, err) }
})

// ─── Superadmin ──────────────────────────────────────────────────────────────

router.get('/api/superadmin/agencies', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const agencies = await prisma.affiliateAccount.findMany({ where: { type: 'AGENCY' }, orderBy: { createdAt: 'desc' } })
    const rows = await Promise.all(agencies.map(async a => {
      const [tier, referred, sums] = await Promise.all([
        getAgencyTier(a.id),
        prisma.referralConversion.count({ where: { affiliateId: a.id } }),
        prisma.affiliateCommission.groupBy({ by: ['status'], where: { affiliateId: a.id }, _sum: { commissionAmount: true } }),
      ])
      const by = (s: string) => sums.find(x => x.status === s)?._sum.commissionAmount ?? 0
      return {
        id: a.id, name: a.name, email: a.email, phone: a.phone, status: a.status, referralCode: a.referralCode,
        lastLoginAt: a.lastLoginAt, createdAt: a.createdAt,
        tier: tier.tier, ratePct: tier.ratePct, activeRestaurants: tier.activeRestaurants, referred,
        pending: by('PENDING'), approved: by('APPROVED'), paid: by('PAID'),
      }
    }))
    return res.json({ agencies: rows })
  } catch (err) { return fail(res, err) }
})

router.post('/api/superadmin/agencies', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, email, phone } = (req.body ?? {}) as { name?: string; email?: string; phone?: string }
    if (!name?.trim() || !email || !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'name and a valid email are required' })
    const exists = await prisma.affiliateAccount.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (exists) return res.status(409).json({ error: 'An account with this email already exists', code: 'DUPLICATE' })
    const { agency, temporaryPassword } = await createAgency({ name, email, phone })
    return res.status(201).json({ agency: { id: agency.id, name: agency.name, email: agency.email, referralCode: agency.referralCode }, temporaryPassword })
  } catch (err) { return fail(res, err) }
})

router.get('/api/superadmin/agencies/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
    const exists = await prisma.affiliateAccount.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!exists) return res.status(404).json({ error: 'Not found' })
    return res.json(await getAgencyDashboard(req.params.id))
  } catch (err) { return fail(res, err) }
})

router.patch('/api/superadmin/agencies/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
    const b = (req.body ?? {}) as { status?: string; accountManager?: string; coBrandName?: string }
    const data: Record<string, string> = {}
    if (b.status !== undefined) {
      if (!['ACTIVE', 'SUSPENDED'].includes(b.status)) return res.status(400).json({ error: 'Invalid status' })
      data.status = b.status
    }
    if (b.accountManager !== undefined) data.accountManager = String(b.accountManager).slice(0, 120)
    if (b.coBrandName !== undefined)    data.coBrandName    = String(b.coBrandName).slice(0, 80)
    const r = await prisma.affiliateAccount.updateMany({ where: { id: req.params.id, type: 'AGENCY' }, data })
    return r.count ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' })
  } catch (err) { return fail(res, err) }
})

router.post('/api/superadmin/agencies/:id/reset-password', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
    const a = await prisma.affiliateAccount.findFirst({ where: { id: req.params.id, type: 'AGENCY' }, select: { id: true } })
    if (!a) return res.status(404).json({ error: 'Not found' })
    return res.json({ temporaryPassword: await resetAgencyPassword(a.id) })
  } catch (err) { return fail(res, err) }
})

// ─── Agency portal ───────────────────────────────────────────────────────────

router.post('/api/partners/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    const token = await partnerLogin(email, password)
    if (!token) return res.status(401).json({ error: 'Invalid credentials', code: 'BAD_CREDENTIALS' })
    return res.json({ token })
  } catch (err) { return fail(res, err) }
})

router.get('/api/partners/me', async (req, res) => {
  const affiliateId = verifyPartnerToken(req.headers.authorization)
  if (!affiliateId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const a = await prisma.affiliateAccount.findUnique({ where: { id: affiliateId }, select: { status: true } })
    if (!a || a.status !== 'ACTIVE') return res.status(401).json({ error: 'Unauthorized' })
    return res.json(await getAgencyDashboard(affiliateId))
  } catch (err) { return fail(res, err) }
})

router.post('/api/partners/change-password', loginLimiter, async (req, res) => {
  const affiliateId = verifyPartnerToken(req.headers.authorization)
  if (!affiliateId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string }
    await changePartnerPassword(affiliateId, String(currentPassword ?? ''), String(newPassword ?? ''))
    return res.json({ ok: true })
  } catch (err) {
    const code = (err as Error).message
    if (code === 'BAD_PASSWORD' || code === 'WEAK_PASSWORD') return res.status(400).json({ error: code, code })
    return fail(res, err)
  }
})

export default router
