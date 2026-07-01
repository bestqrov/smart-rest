import { Router } from 'express'
import { getRevenueDashboard, getMRR, getSubscriptionCounts, getFailedPaymentsCount } from '../billing'
import { requireSuperAdmin } from './_billingAuthGuard'
import logger from '../logger'

const router = Router()

router.get('/api/superadmin/billing/metrics/dashboard', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const dashboard = await getRevenueDashboard()
    res.json(dashboard)
  } catch (err: any) {
    logger.error({ msg: '[billing/metrics/dashboard] failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/superadmin/billing/metrics/mrr', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await getMRR()
    res.json(result)
  } catch (err: any) {
    logger.error({ msg: '[billing/metrics/mrr] failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/superadmin/billing/metrics/subscriptions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await getSubscriptionCounts()
    res.json(result)
  } catch (err: any) {
    logger.error({ msg: '[billing/metrics/subscriptions] failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/superadmin/billing/metrics/failed-payments', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const count = await getFailedPaymentsCount()
    res.json({ failedPayments: count })
  } catch (err: any) {
    logger.error({ msg: '[billing/metrics/failed-payments] failed', err: err.message })
    res.status(500).json({ error: err.message })
  }
})

export default router
