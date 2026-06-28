import { Router } from 'express'
import { getSecurityOverview } from '../ops/security/SecurityService'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
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
