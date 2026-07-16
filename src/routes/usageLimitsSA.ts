import { Router } from 'express'
import { getAllRemainingQuotas, getRemainingQuota, resetUsageCounters } from '../billing'
import { requireSuperAdmin, saEmail } from './_billingAuthGuard'
import logger from '../logger'

const router = Router()

// GET /api/superadmin/billing/usage-limits/:tenantId/remaining?field=aiRequests
router.get('/api/superadmin/billing/usage-limits/:tenantId/remaining', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { field } = req.query as Record<string, string>
    const result = field
      ? await getRemainingQuota(req.params.tenantId, field)
      : await getAllRemainingQuotas(req.params.tenantId)
    res.json({ remaining: result })
  } catch (err: any) {
    logger.error({ msg: '[billing/usage-limits] remaining failed', tenantId: req.params.tenantId, err: err.message })
    res.status(500).json({ error: err.message })
  }
})

// POST /api/superadmin/billing/usage-limits/:tenantId/reset — admin only
router.post('/api/superadmin/billing/usage-limits/:tenantId/reset', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    await resetUsageCounters(req.params.tenantId, saEmail(req))
    logger.info({ msg: '[billing/usage-limits] usage reset', tenantId: req.params.tenantId, by: saEmail(req) })
    res.json({ ok: true })
  } catch (err: any) {
    logger.error({ msg: '[billing/usage-limits] reset failed', tenantId: req.params.tenantId, err: err.message })
    res.status(500).json({ error: err.message })
  }
})

export default router
