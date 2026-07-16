import { Router } from 'express'
import {
  askCopilot, getCopilotSessionContext,
  proposeCopilotAction, confirmCopilotAction, rejectCopilotAction,
  suggestCopilotAutomations, proposeCopilotWorkflow, confirmCopilotWorkflow, rejectCopilotWorkflow,
  rollbackCopilotWorkflow, getCopilotAutomationHistory,
} from '../intelligence/ai-copilot'
import { detectAutomationOpportunities } from '../intelligence/automation-advisor'
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

// GET /api/superadmin/intelligence/copilot/automation/suggest — Automation
// Assistant (K70): reuses K54's opportunity/recommendation detection
// directly, read-only.
router.get('/api/superadmin/intelligence/copilot/automation/suggest', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const tenantId = String(req.query['tenantId'] ?? '')
  if (!tenantId) return res.status(400).json(normalizeError('tenantId query parameter is required'))

  try {
    const suggestions = await suggestCopilotAutomations(tenantId)
    res.json(normalizeSuccess(suggestions, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/automation/propose — generates
// (or reuses) a multi-step K48 workflow for a K54 opportunity and creates
// a PENDING Decision a human must separately confirm.
router.post('/api/superadmin/intelligence/copilot/automation/propose', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { tenantId, ruleId, performedBy } = req.body ?? {}
  if (!tenantId || !ruleId || !performedBy) {
    return res.status(400).json(normalizeError('tenantId, ruleId and performedBy are all required'))
  }

  try {
    const opportunities = await detectAutomationOpportunities(tenantId)
    const opportunity = opportunities.find(o => o.ruleId === ruleId)
    if (!opportunity) return res.status(404).json(normalizeError(`no automation opportunity found for ruleId "${ruleId}"`))

    const proposal = await proposeCopilotWorkflow(tenantId, opportunity, performedBy)
    res.json(normalizeSuccess(proposal, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/automation/confirm — the only
// route that turns a workflow proposal into an actual K48 run; every
// ACTION step inside still only queues (K37 enqueueAction), never runs.
router.post('/api/superadmin/intelligence/copilot/automation/confirm', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { decisionId, performedBy } = req.body ?? {}
  if (!decisionId || !performedBy) {
    return res.status(400).json(normalizeError('decisionId and performedBy are required'))
  }

  try {
    const result = await confirmCopilotWorkflow(decisionId, performedBy)
    res.json(normalizeSuccess(result, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/automation/reject
router.post('/api/superadmin/intelligence/copilot/automation/reject', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { decisionId, performedBy } = req.body ?? {}
  if (!decisionId || !performedBy) {
    return res.status(400).json(normalizeError('decisionId and performedBy are required'))
  }

  try {
    const result = await rejectCopilotWorkflow(decisionId, performedBy)
    res.json(normalizeSuccess(result, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// POST /api/superadmin/intelligence/copilot/automation/rollback — cancels
// any still-QUEUED actions from a workflow run (K37 cancelAction);
// already-run actions cannot be undone.
router.post('/api/superadmin/intelligence/copilot/automation/rollback', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const { runId, performedBy } = req.body ?? {}
  if (!runId || !performedBy) {
    return res.status(400).json(normalizeError('runId and performedBy are required'))
  }

  try {
    const result = await rollbackCopilotWorkflow(runId, performedBy)
    res.json(normalizeSuccess(result, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

// GET /api/superadmin/intelligence/copilot/automation/history — reuses
// K48's listWorkflowRuns directly, no second run log.
router.get('/api/superadmin/intelligence/copilot/automation/history', requireSuperAdmin, copilotLimiter, async (req, res) => {
  const tenantId = String(req.query['tenantId'] ?? '')
  if (!tenantId) return res.status(400).json(normalizeError('tenantId query parameter is required'))

  try {
    const history = getCopilotAutomationHistory(tenantId)
    res.json(normalizeSuccess({ history }, 'v1'))
  } catch (err: any) {
    res.status(500).json(normalizeError(err?.message ?? 'Internal error'))
  }
})

export default router
