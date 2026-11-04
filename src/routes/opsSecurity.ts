import { Router } from 'express'
import { getSecurityOverview } from '../ops/security/SecurityService'
import { isSuperAdminRequest } from '../middleware/superAdminAuth'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!isSuperAdminRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// GET /api/superadmin/ops/security
router.get('/api/superadmin/ops/security', requireSuperAdmin, async (_req, res) => {
  try {
    const overview = await getSecurityOverview()
    res.json(overview)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
