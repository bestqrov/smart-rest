// ─── Billing Plans — SuperAdmin Routes ────────────────────────────────────

import { Router } from 'express'
import * as PlanService from '../billing/plans/PlanService'
import { PlanValidationError } from '../billing/plans/PlanValidation'

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

function saEmail(req: any): string {
  return String(req.headers['x-superadmin-email'] ?? 'sa@system')
}

function handleError(res: any, err: unknown) {
  if (err instanceof PlanValidationError) return res.status(400).json({ error: err.message })
  return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
}

// GET /api/superadmin/billing/plans
router.get('/api/superadmin/billing/plans', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const filter: { isActive?: boolean } = {}
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true'
    const plans = await PlanService.listPlans(filter)
    res.json({ plans })
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/plans/:id
router.get('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.getPlan(req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans
router.post('/api/superadmin/billing/plans', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.createPlan(req.body, saEmail(req))
    res.status(201).json({ plan })
  } catch (err) { handleError(res, err) }
})

// PATCH /api/superadmin/billing/plans/:id
router.patch('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.updatePlan(req.params.id, req.body, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// DELETE /api/superadmin/billing/plans/:id
router.delete('/api/superadmin/billing/plans/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    await PlanService.deletePlan(req.params.id, saEmail(req))
    res.json({ ok: true })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/duplicate
router.post('/api/superadmin/billing/plans/:id/duplicate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.duplicatePlan(req.params.id, saEmail(req))
    res.status(201).json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/activate
router.post('/api/superadmin/billing/plans/:id/activate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.activatePlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/deactivate
router.post('/api/superadmin/billing/plans/:id/deactivate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.deactivatePlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/plans/:id/set-default
router.post('/api/superadmin/billing/plans/:id/set-default', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const plan = await PlanService.setDefaultPlan(req.params.id, saEmail(req))
    res.json({ plan })
  } catch (err) { handleError(res, err) }
})

export default router
