import { Router } from 'express'
import { getRevenueDashboard, getMRR, getSubscriptionCounts, getFailedPaymentsCount } from '../billing'

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

router.get('/api/superadmin/billing/metrics/dashboard', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const dashboard = await getRevenueDashboard()
    res.json(dashboard)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/metrics/mrr', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await getMRR()
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/metrics/subscriptions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await getSubscriptionCounts()
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/metrics/failed-payments', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const count = await getFailedPaymentsCount()
    res.json({ failedPayments: count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
