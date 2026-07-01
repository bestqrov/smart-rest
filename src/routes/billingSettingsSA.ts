import { Router } from 'express'
import { getAllBillingSettings, updateBillingSetting } from '../billing'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  if (!req.headers['x-superadmin-email']) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

function saEmail(req: any): string {
  return String(req.headers['x-superadmin-email'] ?? 'sa@system')
}

// GET /api/superadmin/billing/settings
router.get('/api/superadmin/billing/settings', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const settings = await getAllBillingSettings()
    res.json({ settings })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// PATCH /api/superadmin/billing/settings/:key
router.patch('/api/superadmin/billing/settings/:key', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { value } = req.body as { value: unknown }
    if (value === undefined) return res.status(400).json({ error: 'value is required' })
    const setting = await updateBillingSetting(String(req.params.key), value, saEmail(req))
    res.json({ ok: true, setting })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

export default router
