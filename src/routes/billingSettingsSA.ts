import { Router } from 'express'
import { getAllBillingSettings, updateBillingSetting } from '../billing'
import { requireSuperAdmin, saEmail } from './_billingAuthGuard'
import logger from '../logger'

const router = Router()

// GET /api/superadmin/billing/settings
router.get('/api/superadmin/billing/settings', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const settings = await getAllBillingSettings()
    res.json({ settings })
  } catch (err: any) {
    logger.error({ msg: '[billing/settings] list failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/superadmin/billing/settings/:key
router.patch('/api/superadmin/billing/settings/:key', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { value } = req.body as { value: unknown }
    if (value === undefined) return res.status(400).json({ error: 'value is required' })
    const setting = await updateBillingSetting(String(req.params.key), value, saEmail(req))
    res.json({ ok: true, setting })
  } catch (err: any) {
    logger.warn({ msg: '[billing/settings] update rejected', key: req.params.key, err: err.message })
    res.status(400).json({ error: err.message })
  }
})

export default router
