import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import {
  sendMessage, sendTemplatedMessage, sendBroadcast, retryMessage,
  upsertTemplate, listTemplates, getMessageHistory,
} from '../email/EmailEngine'

const router = express.Router()

// POST /api/admin/email/send — body: { to, subject, body, templateKey?, scheduledFor? }
router.post('/api/admin/email/send', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { to, subject, body, templateKey, scheduledFor } = req.body as {
      to?: string; subject?: string; body?: string; templateKey?: string; scheduledFor?: string
    }
    if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required' })

    const msg = await sendMessage(cafeId, to, subject, body, {
      templateKey,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    })
    return res.json({ message: msg })
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/email/send error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send email' })
  }
})

// POST /api/admin/email/send-template — body: { to, templateKey, vars?, scheduledFor? }
router.post('/api/admin/email/send-template', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { to, templateKey, vars, scheduledFor } = req.body as {
      to?: string; templateKey?: string; vars?: Record<string, string>; scheduledFor?: string
    }
    if (!to || !templateKey) return res.status(400).json({ error: 'to and templateKey are required' })

    const msg = await sendTemplatedMessage(cafeId, to, templateKey, vars, scheduledFor ? new Date(scheduledFor) : undefined)
    return res.json({ message: msg })
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/email/send-template error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send templated email' })
  }
})

// POST /api/admin/email/broadcast — body: { recipients: string[], subject, body, templateKey? }
router.post('/api/admin/email/broadcast', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { recipients, subject, body, templateKey } = req.body as {
      recipients?: string[]; subject?: string; body?: string; templateKey?: string
    }
    if (!Array.isArray(recipients) || recipients.length === 0 || !subject || !body) {
      return res.status(400).json({ error: 'recipients (non-empty array), subject, and body are required' })
    }
    const result = await sendBroadcast(cafeId, recipients, subject, body, templateKey)
    return res.json(result)
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/email/broadcast error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send broadcast' })
  }
})

// POST /api/admin/email/:id/retry
router.post('/api/admin/email/:id/retry', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const msg = await retryMessage(req.params.id as string)
    return res.json({ message: msg })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed to retry message' })
  }
})

// GET/POST /api/admin/email/templates
router.get('/api/admin/email/templates', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const templates = await listTemplates(req.admin!.cafeId)
    return res.json({ templates })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/email/templates error', err })
    return res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

router.post('/api/admin/email/templates', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { key, subject, body } = req.body as { key?: string; subject?: string; body?: string }
    if (!key?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'key, subject, and body are required' })
    }
    const template = await upsertTemplate(req.admin!.cafeId, key.trim(), subject.trim(), body.trim())
    return res.json({ template })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/email/templates error', err })
    return res.status(500).json({ error: 'Failed to save template' })
  }
})

// GET /api/admin/email/history?to=
router.get('/api/admin/email/history', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const messages = await getMessageHistory(req.admin!.cafeId, req.query.to as string | undefined)
    return res.json({ messages })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/email/history error', err })
    return res.status(500).json({ error: 'Failed to fetch history' })
  }
})

export default router
