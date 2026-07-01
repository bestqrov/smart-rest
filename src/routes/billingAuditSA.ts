import { Router } from 'express'
import { listBillingAudit } from '../billing'

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

// GET /api/superadmin/billing/audit?tenantId=&action=&from=&to=&page=&limit=
router.get('/api/superadmin/billing/audit', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, action, from, to, page, limit } = req.query as Record<string, string>
    const result = await listBillingAudit({
      tenantId,
      action,
      from:  from ? new Date(from) : undefined,
      to:    to   ? new Date(to)   : undefined,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
