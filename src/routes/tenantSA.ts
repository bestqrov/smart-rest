// ─── SuperAdmin: Tenant Lifecycle Management ──────────────────────────────────
import { Router } from 'express'
import {
  provision, getProfile, listProfiles,
  activate, startTrial, assignPlan, enterGracePeriod, cancel, archive,
  setFeatureOverride, addPromotion,
  suspend, reactivate, getSuspensionLogs,
  getUsageSummary, getUsageHistory,
  resolveFeatures,
  listPlans,
} from '../tenant'
import type { SuspensionType, Plan } from '../tenant'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// ─── Plans reference ──────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants/plans', (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  res.json({ plans: listPlans() })
})

// ─── List tenants ─────────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { state, plan, tenantType, page, limit } = req.query as Record<string, string>
    const result = await listProfiles({
      state, plan, tenantType,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 20,
    })
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Get single tenant ────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants/:tenantId', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await getProfile(String(req.params.tenantId))
    if (!profile) return res.status(404).json({ error: 'Tenant not found' })
    res.json({ profile })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Provision (create) tenant ────────────────────────────────────────────────
router.post('/api/superadmin/tenants', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { tenantId, tenantType, plan, startTrial: trial, defaultLanguage, defaultCurrency, country, timezone } = req.body
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' })
    const profile = await provision({ tenantId, tenantType, plan, startTrial: trial, defaultLanguage, defaultCurrency, country, timezone })
    res.status(201).json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Activate ─────────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/activate', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await activate(String(req.params.tenantId), req.body.activatedBy)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Start Trial ──────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/trial', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await startTrial(String(req.params.tenantId), req.body.plan as Plan)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Assign Plan ──────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/plan', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { plan, customLimits, changedBy } = req.body
    if (!plan) return res.status(400).json({ error: 'plan required' })
    const profile = await assignPlan(String(req.params.tenantId), { plan, customLimits, changedBy })
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Suspend ──────────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/suspend', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { type, reason, gracePeriodDays } = req.body
    if (!type || !reason) return res.status(400).json({ error: 'type and reason required' })
    const profile = await suspend(String(req.params.tenantId), {
      type: type as SuspensionType,
      reason,
      suspendedBy: req.body.suspendedBy,
      gracePeriodDays,
    })
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Reactivate ───────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/reactivate', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await reactivate(String(req.params.tenantId), req.body.reactivatedBy)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Grace Period ─────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/grace-period', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await enterGracePeriod(String(req.params.tenantId), req.body.durationDays)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Cancel ───────────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/cancel', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await cancel(String(req.params.tenantId), req.body.cancelledBy)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Archive ──────────────────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/archive', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const profile = await archive(String(req.params.tenantId), req.body.archivedBy)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Feature Override ─────────────────────────────────────────────────────────
router.patch('/api/superadmin/tenants/:tenantId/features/:feature', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { value } = req.body
    if (typeof value !== 'boolean') return res.status(400).json({ error: 'value must be boolean' })
    const profile = await setFeatureOverride(String(req.params.tenantId), String(req.params.feature), value)
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Temporary Promotion ──────────────────────────────────────────────────────
router.post('/api/superadmin/tenants/:tenantId/promotions', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { feature, value, expiresAt, reason } = req.body
    if (!feature || typeof value !== 'boolean' || !expiresAt || !reason) {
      return res.status(400).json({ error: 'feature, value, expiresAt, reason required' })
    }
    const profile = await addPromotion(
      String(req.params.tenantId), feature, value, new Date(expiresAt), reason,
    )
    res.json({ profile })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// ─── Suspension Logs ──────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants/:tenantId/suspension-logs', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const logs = await getSuspensionLogs(String(req.params.tenantId))
    res.json({ logs })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Usage ────────────────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants/:tenantId/usage', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { period } = req.query as Record<string, string>
    const [summary, history] = await Promise.all([
      getUsageSummary(String(req.params.tenantId), period),
      getUsageHistory(String(req.params.tenantId)),
    ])
    res.json({ usage: summary, history })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Resolved Features ────────────────────────────────────────────────────────
router.get('/api/superadmin/tenants/:tenantId/features', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const resolved = await resolveFeatures(String(req.params.tenantId))
    res.json({ features: resolved })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
