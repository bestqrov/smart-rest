import { Router } from 'express'
import * as RecommendationService from '../marketplace/ai/RecommendationService'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  const secret = req.headers['x-superadmin-secret']
  if (secret !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// GET /api/superadmin/marketplace/ai/analytics
// Overall recommendation analytics (all tenants or filtered by tenantId)
router.get('/api/superadmin/marketplace/ai/analytics', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined
    const analytics = await RecommendationService.getAnalytics(tenantId)
    res.json({ analytics })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/superadmin/marketplace/ai/recommendations
// Top recommended products (global, across all tenants)
router.get('/api/superadmin/marketplace/ai/recommendations', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const trending = await RecommendationService.getTrending(10)
    res.json({ trending })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
