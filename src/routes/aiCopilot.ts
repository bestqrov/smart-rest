import { Router } from 'express'
import {
  askCopilot, getCopilotSessionContext,
  proposeCopilotAction, confirmCopilotAction, rejectCopilotAction,
} from '../intelligence/ai-copilot'
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

// GET /api/superadmin/intelligence/copilot/history — Chat UI integration
// hook (K68): lets a chat UI load prior turns for a session on mount.
// Reuses getCopilotSessionContext (K67/K46) — no second history store.
router.get('/api/superadmin/intelligence/copilot/history', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const tenantId  = String(req.query['tenantId'] ?? '')
  const sessionId = String(req.query['sessionId'] ?? '')

  if (!tenantId || !sessionId) {
    return res.status(400).json(normalizeError('tenantId and sessionId query parameters are required'))
  }

  try {
    const session = await getCopilotSessionContext(tenantId, sessionId)
    res.json(normalizeSuccess({ history: session.history }, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/action/propose — Action
// Assistant (K69): never executes anything, only creates a PENDING
// Decision (K38) a human must separately confirm.
router.post('/api/superadmin/intelligence/copilot/action/propose', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { tenantId, message, performedBy } = req.body ?? {}

  if (!tenantId || !message || !performedBy) {
    return res.status(400).json(normalizeError('tenantId, message and performedBy are all required'))
  }

  try {
    const proposal = await proposeCopilotAction(tenantId, message, performedBy)
    res.json(normalizeSuccess(proposal, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/action/confirm — the only
// route that turns a proposal into a queued action (K37 enqueueAction,
// never run) — requires an explicit, human-initiated call.
router.post('/api/superadmin/intelligence/copilot/action/confirm', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { decisionId, performedBy } = req.body ?? {}

  if (!decisionId || !performedBy) {
    return res.status(400).json(normalizeError('decisionId and performedBy are required'))
  }

  try {
    const result = await confirmCopilotAction(decisionId, performedBy)
    res.json(normalizeSuccess(result, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/action/reject
router.post('/api/superadmin/intelligence/copilot/action/reject', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { decisionId, performedBy } = req.body ?? {}

  if (!decisionId || !performedBy) {
    return res.status(400).json(normalizeError('decisionId and performedBy are required'))
  }

  try {
    const result = await rejectCopilotAction(decisionId, performedBy)
    res.json(normalizeSuccess(result, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

export default router
