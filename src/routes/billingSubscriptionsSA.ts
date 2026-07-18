// ─── Billing Subscriptions — SuperAdmin Routes ─────────────────────────────

import { Router } from 'express'
import * as SubscriptionService from '../billing/subscriptions/SubscriptionService'
import { SubscriptionError }    from '../billing/subscriptions/SubscriptionValidation'
import type { SubscriptionStatus } from '../billing/subscriptions/SubscriptionTypes'

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
  if (err instanceof SubscriptionError) return res.status(400).json({ error: err.message })
  return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
}

// GET /api/superadmin/billing/subscriptions
router.get('/api/superadmin/billing/subscriptions', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { status, tenantId, planCode, page, limit } = req.query
    const result = await SubscriptionService.listSubscriptions({
      status:   status   as SubscriptionStatus | undefined,
      tenantId: tenantId as string | undefined,
      planCode: planCode as string | undefined,
      page:     page     ? Number(page)  : undefined,
      limit:    limit    ? Number(limit) : undefined,
    })
    res.json(result)
  } catch (err) { handleError(res, err) }
})

// GET /api/superadmin/billing/subscriptions/:id
router.get('/api/superadmin/billing/subscriptions/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.getSubscription(req.params.id)
    if (!sub) return res.status(404).json({ error: 'Subscription not found' })
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions
router.post('/api/superadmin/billing/subscriptions', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { tenantId, planId, type = 'trial', trialDays, autoRenew, notes } = req.body
    if (!tenantId || !planId) return res.status(400).json({ error: 'tenantId and planId are required' })
    const sub = type === 'active'
      ? await SubscriptionService.createActiveSubscription(tenantId, planId, saEmail(req), { autoRenew, notes })
      : await SubscriptionService.createTrialSubscription(tenantId, planId, saEmail(req), { trialDays, autoRenew, notes })
    res.status(201).json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// PATCH /api/superadmin/billing/subscriptions/:id
router.patch('/api/superadmin/billing/subscriptions/:id', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { notes } = req.body
    const sub = await SubscriptionService.updateNotes(req.params.id, notes ?? null, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/activate
router.post('/api/superadmin/billing/subscriptions/:id/activate', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.activate(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/suspend
router.post('/api/superadmin/billing/subscriptions/:id/suspend', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { reason = 'Manual suspension by SuperAdmin' } = req.body
    const sub = await SubscriptionService.suspend(req.params.id, reason, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/resume
router.post('/api/superadmin/billing/subscriptions/:id/resume', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.resume(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/cancel
router.post('/api/superadmin/billing/subscriptions/:id/cancel', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.cancel(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/renew
router.post('/api/superadmin/billing/subscriptions/:id/renew', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const sub = await SubscriptionService.renew(req.params.id, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

// POST /api/superadmin/billing/subscriptions/:id/change-plan
router.post('/api/superadmin/billing/subscriptions/:id/change-plan', async (req, res) => {
  if (!requireSA(req, res)) return
  try {
    const { planId } = req.body
    if (!planId) return res.status(400).json({ error: 'planId is required' })
    const sub = await SubscriptionService.changePlan(req.params.id, planId, saEmail(req))
    res.json({ subscription: sub })
  } catch (err) { handleError(res, err) }
})

export default router
