import { Router } from 'express'
import {
  listPlansWithPricing,
  getPlanWithPricing,
  invoices,
  usage,
  quotas,
  generateInvoice,
  recordPayment,
  markOverdueInvoices,
} from '../billing'
import type { Plan } from '../billing/plans/PlanCatalogService'

const router = Router()

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

// ─── Plan endpoints ───────────────────────────────────────────────────────────

router.get('/api/superadmin/billing/plan-catalog', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const plans = await listPlansWithPricing()
    res.json({ plans })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/plan-catalog/:plan', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const plan = await getPlanWithPricing(req.params.plan as Plan)
    res.json({ plan })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Subscription endpoints ───────────────────────────────────────────────────
// NOTE: Subscription CRUD/lifecycle (get/cancel/suspend/reactivate/change-plan)
// now lives exclusively in `billingSubscriptionsSA.ts`, which is mounted on the
// same `/api/superadmin/billing/subscriptions/:id` path patterns using
// subscription-document-id semantics. Keeping duplicate handlers here would
// either collide (Express dispatches to whichever router is registered first)
// or silently diverge in contract (tenantId vs subscription id). Removed.

// ─── Invoice endpoints ────────────────────────────────────────────────────────

router.get('/api/superadmin/billing/invoices', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, status, module: mod, page, limit } = req.query as Record<string, string>
    const result = await invoices.listInvoices({
      tenantId,
      status:  status as any,
      module:  mod,
      page:    page  ? Number(page)  : undefined,
      limit:   limit ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/invoices/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const invoice = await invoices.getInvoice(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    res.json({ invoice })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/api/superadmin/billing/invoices/generate', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, module: mod, plan, country, periodStart, periodEnd, dueDate, notes } = req.body
    const invoice = await generateInvoice({
      tenantId,
      module:      mod,
      plan:        plan as Plan,
      country,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      dueDate:     new Date(dueDate),
      notes,
    })
    res.status(201).json({ invoice })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/api/superadmin/billing/invoices/:id/pay', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, module: mod } = req.body
    const result = await recordPayment(req.params.id, tenantId, mod)
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/api/superadmin/billing/invoices/:id/cancel', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await invoices.cancelInvoice(req.params.id)
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/api/superadmin/billing/invoices/mark-overdue', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const count = await markOverdueInvoices()
    res.json({ marked: count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Usage / quota endpoints ──────────────────────────────────────────────────

router.get('/api/superadmin/billing/usage/:tenantId', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { period } = req.query as Record<string, string>
    const result = await usage.getUsageSummary(req.params.tenantId, period)
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/api/superadmin/billing/quotas/:tenantId', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await quotas.checkAllQuotas(req.params.tenantId)
    res.json({ quotas: result })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
