import { Router } from 'express'
import { getSystemHealth } from '../ops/health/HealthService'
import { runDiagnostics } from '../ops/diagnostics/DiagnosticsService'
import { collectSystemMetrics } from '../ops/metrics/SystemMetrics'
import { isSuperAdminRequest } from '../middleware/superAdminAuth'

const router = Router()

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!isSuperAdminRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  return next()
}

// GET /api/superadmin/system/health
router.get('/api/superadmin/system/health', requireSuperAdmin, async (_req, res) => {
  try {
    const health = await getSystemHealth()
    res.json(health)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/superadmin/system/metrics
router.get('/api/superadmin/system/metrics', requireSuperAdmin, async (_req, res) => {
  try {
    const metrics = await collectSystemMetrics()
    res.json(metrics)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/superadmin/system/diagnostics
router.post('/api/superadmin/system/diagnostics', requireSuperAdmin, async (_req, res) => {
  try {
    const report = await runDiagnostics()
    res.json(report)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
