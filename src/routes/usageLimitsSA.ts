import { Router } from 'express'
import { getAllRemainingQuotas, getRemainingQuota, resetUsageCounters } from '../billing'

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

// GET /api/superadmin/billing/usage-limits/:tenantId/remaining?field=aiRequests
router.get('/api/superadmin/billing/usage-limits/:tenantId/remaining', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { field } = req.query as Record<string, string>
    const result = field
      ? await getRemainingQuota(req.params.tenantId, field)
      : await getAllRemainingQuotas(req.params.tenantId)
    res.json({ remaining: result })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST /api/superadmin/billing/usage-limits/:tenantId/reset — admin only
router.post('/api/superadmin/billing/usage-limits/:tenantId/reset', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    await resetUsageCounters(req.params.tenantId, saEmail(req))
    res.json({ ok: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
