import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import {
  sendMessage, sendTemplatedMessage, sendBroadcast, retryMessage,
  upsertTemplate, listTemplates, getConversation,
} from '../whatsapp/WhatsAppEngine'

const router = express.Router()

// POST /api/admin/whatsapp/send — body: { phone, body, templateKey?, scheduledFor? }
router.post('/api/admin/whatsapp/send', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { phone, body, templateKey, scheduledFor } = req.body as {
      phone?: string; body?: string; templateKey?: string; scheduledFor?: string
    }
    if (!phone || !body) return res.status(400).json({ error: 'phone and body are required' })

    const msg = await sendMessage(cafeId, phone, body, {
      templateKey,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    })
    return res.json({ message: msg })
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/whatsapp/send error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send message' })
  }
})

// POST /api/admin/whatsapp/send-template — body: { phone, templateKey, vars?, scheduledFor? }
router.post('/api/admin/whatsapp/send-template', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { phone, templateKey, vars, scheduledFor } = req.body as {
      phone?: string; templateKey?: string; vars?: Record<string, string>; scheduledFor?: string
    }
    if (!phone || !templateKey) return res.status(400).json({ error: 'phone and templateKey are required' })

    const msg = await sendTemplatedMessage(cafeId, phone, templateKey, vars, scheduledFor ? new Date(scheduledFor) : undefined)
    return res.json({ message: msg })
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/whatsapp/send-template error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send templated message' })
  }
})

// POST /api/admin/whatsapp/broadcast — body: { phones: string[], body, templateKey? }
router.post('/api/admin/whatsapp/broadcast', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { phones, body, templateKey } = req.body as { phones?: string[]; body?: string; templateKey?: string }
    if (!Array.isArray(phones) || phones.length === 0 || !body) {
      return res.status(400).json({ error: 'phones (non-empty array) and body are required' })
    }
    const result = await sendBroadcast(cafeId, phones, body, templateKey)
    return res.json(result)
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/whatsapp/broadcast error', err })
    return res.status(400).json({ error: err.message ?? 'Failed to send broadcast' })
  }
})

// POST /api/admin/whatsapp/:id/retry
router.post('/api/admin/whatsapp/:id/retry', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const msg = await retryMessage(req.params.id as string)
    return res.json({ message: msg })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed to retry message' })
  }
})

// GET/POST /api/admin/whatsapp/templates
router.get('/api/admin/whatsapp/templates', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const templates = await listTemplates(req.admin!.cafeId)
    return res.json({ templates })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/whatsapp/templates error', err })
    return res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

router.post('/api/admin/whatsapp/templates', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { key, body } = req.body as { key?: string; body?: string }
    if (!key?.trim() || !body?.trim()) return res.status(400).json({ error: 'key and body are required' })
    const template = await upsertTemplate(req.admin!.cafeId, key.trim(), body.trim())
    return res.json({ template })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/whatsapp/templates error', err })
    return res.status(500).json({ error: 'Failed to save template' })
  }
})

// GET /api/admin/whatsapp/conversation/:phone
router.get('/api/admin/whatsapp/conversation/:phone', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const messages = await getConversation(req.admin!.cafeId, req.params.phone as string)
    return res.json({ messages })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/whatsapp/conversation error', err })
    return res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

export default router
