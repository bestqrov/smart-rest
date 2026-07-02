import { Router } from 'express'
import {
  createAffiliate, listAffiliates, getAffiliateByCode, trackReferral,
  approveCommission, markCommissionPaid, getCommissionHistory, getAffiliateSummary,
} from '../affiliate/AffiliateService'
import { requireSuperAdmin } from './_billingAuthGuard'

const router = Router()

// GET /api/superadmin/affiliates?status=
router.get('/api/superadmin/affiliates', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const affiliates = await listAffiliates(req.query.status as string | undefined)
    res.json({ affiliates })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST /api/superadmin/affiliates — body: { name, email, phone?, commissionType?, commissionValue? }
router.post('/api/superadmin/affiliates', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, email, phone, commissionType, commissionValue } = req.body as {
      name?: string; email?: string; phone?: string; commissionType?: 'PERCENT' | 'FIXED'; commissionValue?: number
    }
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' })
    const affiliate = await createAffiliate({ name, email, phone, commissionType, commissionValue })
    res.status(201).json({ affiliate })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// GET /api/superadmin/affiliates/:id/summary
router.get('/api/superadmin/affiliates/:id/summary', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const summary = await getAffiliateSummary(req.params.id)
    res.json(summary)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/superadmin/affiliates/:id/commissions
router.get('/api/superadmin/affiliates/:id/commissions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const commissions = await getCommissionHistory(req.params.id)
    res.json({ commissions })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST /api/superadmin/referrals/track — body: { referralCode, referredCafeId }
router.post('/api/superadmin/referrals/track', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { referralCode, referredCafeId } = req.body as { referralCode?: string; referredCafeId?: string }
    if (!referralCode || !referredCafeId) return res.status(400).json({ error: 'referralCode and referredCafeId are required' })
    const referral = await trackReferral(referralCode, referredCafeId)
    res.status(201).json({ referral })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// GET /api/superadmin/referrals/code/:code — resolve a code (used by signup flow)
router.get('/api/superadmin/referrals/code/:code', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const affiliate = await getAffiliateByCode(req.params.code)
    if (!affiliate) return res.status(404).json({ error: 'Referral code not found' })
    res.json({ affiliate })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// PATCH /api/superadmin/commissions/:id/approve
router.patch('/api/superadmin/commissions/:id/approve', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const commission = await approveCommission(req.params.id)
    res.json({ commission })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// PATCH /api/superadmin/commissions/:id/pay
router.patch('/api/superadmin/commissions/:id/pay', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const commission = await markCommissionPaid(req.params.id)
    res.json({ commission })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

export default router
