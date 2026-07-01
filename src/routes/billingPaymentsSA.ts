// ─── Billing Payments — SuperAdmin Routes (Sprint K3) ──────────────────────

import { Router } from 'express'
import * as BillingPayments from '../billing/payments/BillingPaymentService'

const router = Router()

function requireSA(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false
  }
  if (!req.headers['x-superadmin-email']) {
    res.status(401).json({ error: 'Unauthorized' }); return false
  }
  return true
}

function handleError(res: any, err: unknown) {
  return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
}

// GET /api/superadmin/billing/payments — billing history (filterable)
router.get('/api/superadmin/billing/payments', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { status, tenantId, page, limit } = req.query
    const result = await BillingPayments.listBillingPayments({
      status:   status   as any,
      tenantId: tenantId as string | undefined,
      page:     page  ? Number(page)  : undefined,
      limit:    limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/payments/:id — single payment detail
router.get('/api/superadmin/billing/payments/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const tx = await BillingPayments.getPayment(req.params.id)
    if (!tx || tx.module !== 'BILLING') return res.status(404).json({ error: 'Payment not found' })
    res.json({ payment: tx })
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/subscriptions/:id/payments — payment status/history for one subscription
router.get('/api/superadmin/billing/subscriptions/:id/payments', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const result = await BillingPayments.getPaymentsForSubscription(req.params.id)
    res.json(result)
  } catch (err) { handleError(res, err) }
})

export default router
