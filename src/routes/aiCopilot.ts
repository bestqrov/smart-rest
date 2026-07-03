import { Router } from 'express'
import { askCopilot } from '../intelligence/ai-copilot'
import { normalizeSuccess, normalizeError, createIntelligenceGatewayLimiter } from '../intelligence/gateway'

const router = Router()
const copilotLimiter = createIntelligenceGatewayLimiter()

function requireSuperAdmin(req: any, res: any, next: any) {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (!secret || !email || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// POST /api/superadmin/intelligence/copilot/chat — Copilot API (K67)
router.post('/api/superadmin/intelligence/copilot/chat', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { tenantId, sessionId, performedBy, message } = req.body ?? {}

  if (!tenantId || !sessionId || !performedBy || !message) {
    return res.status(400).json(normalizeError('tenantId, sessionId, performedBy and message are all required'))
  }

  try {
    const response = await askCopilot({ tenantId, sessionId, performedBy, message })
    res.json(normalizeSuccess(response, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

export default router
