// ─── Restaurant: Tenant Subscription & Usage View ────────────────────────────
import { Router }    from 'express'
import jwt           from 'jsonwebtoken'
import {
  ensureProfile,
  getUsageSummary,
  getUsageHistory,
  resolveFeatures,
  canPerformAction,
} from '../tenant'

const router = Router()

function authRestaurant(req: any): { cafeId: string } {
  const auth  = (req.headers.authorization as string | undefined) ?? ''
  const token = auth.replace('Bearer ', '')
  if (!token) throw new Error('No token')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
  return { cafeId: String(payload.cafeId) }
}

// ─── My subscription ──────────────────────────────────────────────────────────
router.get('/api/restaurant/tenant/subscription', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const profile    = await ensureProfile(cafeId, 'RESTAURANT')
    res.json({ subscription: profile })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── My usage ─────────────────────────────────────────────────────────────────
router.get('/api/restaurant/tenant/usage', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const { period } = req.query as Record<string, string>
    const usage      = await getUsageSummary(cafeId, period)
    res.json({ usage })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── My usage history ─────────────────────────────────────────────────────────
router.get('/api/restaurant/tenant/usage/history', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const history    = await getUsageHistory(cafeId)
    res.json({ history })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── My resolved features (what I can access) ─────────────────────────────────
router.get('/api/restaurant/tenant/features', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const features   = await resolveFeatures(cafeId)
    res.json({ features })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── My limits ────────────────────────────────────────────────────────────────
router.get('/api/restaurant/tenant/limits', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const features   = await resolveFeatures(cafeId)
    res.json({ limits: features.limits, plan: features.plan, state: features.state })
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

// ─── Can I do action? ─────────────────────────────────────────────────────────
router.get('/api/restaurant/tenant/can/:action', async (req, res) => {
  try {
    const { cafeId } = authRestaurant(req)
    const action     = String(req.params.action) as any
    const result     = await canPerformAction(cafeId, action)
    res.json(result)
  } catch (err: any) { res.status(401).json({ error: err.message }) }
})

export default router
