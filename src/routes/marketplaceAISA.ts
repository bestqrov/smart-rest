import { Router } from 'express'
import * as RecommendationService from '../marketplace/ai/RecommendationService'
import { isSuperAdminRequest } from '../middleware/superAdminAuth'
import { sendServerError } from '../middleware/errorHandler'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  if (!isSuperAdminRequest(req)) {
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
  } catch (err: any) { sendServerError(res, err) }
})

// GET /api/superadmin/marketplace/ai/recommendations
// Top recommended products (global, across all tenants)
router.get('/api/superadmin/marketplace/ai/recommendations', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const trending = await RecommendationService.getTrending(10)
    res.json({ trending })
  } catch (err: any) { sendServerError(res, err) }
})

export default router
