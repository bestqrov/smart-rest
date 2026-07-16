/**
 * Customer Feedback — bypasses staff, goes directly to owner dashboard
 *
 * POST /api/v1/public/feedback    submit feedback (public, QR menu)
 * GET  /api/v1/feedbacks          admin: list feedbacks with summary stats
 * GET  /api/v1/feedbacks/summary  admin: aggregate score distribution
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { publishStandardEvent } from '../core'
import {
  requestFeedback, getSatisfactionScore, createSupportTicketForFeedback,
  escalateTicket, resolveTicket, listTickets,
} from '../feedback/FeedbackService'
import type { FeedbackChannel } from '../feedback/FeedbackService'

const router = express.Router()

// ─── POST /api/v1/public/feedback ────────────────────────────────────────────
// Public — no auth. Rate limiting applied in server.ts via /api limiter.
// Body: { tableToken?, tableNumber?, score (1-5), comment?, lang? }

router.post('/api/v1/public/feedback', async (req: Request, res: Response) => {
  try {
    const { tableToken, score, comment = '', lang = 'ar' } = req.body as {
      tableToken?: string
      score?:      number
      comment?:    string
      lang?:       string
    }

    if (!score || !Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'score must be an integer between 1 and 5' })
    }

    let cafeId:      string | null = null
    let tableNumber: number | null = null

    if (tableToken) {
      // Resolve the cafe from the table QR token (same token customers used to order)
      const table = await prisma.table.findUnique({
        where:  { qrToken: tableToken },
        select: { cafeId: true, tableNumber: true, isActive: true }
      })
      if (!table || !table.isActive) return res.status(404).json({ error: 'Invalid table token' })
      cafeId      = table.cafeId
      tableNumber = table.tableNumber
    }

    if (!cafeId) return res.status(400).json({ error: 'tableToken is required' })

    const feedback = await prisma.feedback.create({
      data: {
        cafeId,
        tableNumber,
        tableToken: tableToken ?? null,
        score,
        comment:    comment.trim().slice(0, 1000),
        lang,
      }
    })

    // Emit real-time event to admin dashboard (non-blocking)
    // io is available at request.app — we skip if not attached
    try {
      const io = req.app.get('io')
      if (io) {
        io.to(`room_${cafeId}`).emit('new_feedback', {
          id:          feedback.id,
          tableNumber,
          score,
          comment:     feedback.comment,
          createdAt:   feedback.createdAt,
        })
      }
    } catch { /* non-critical */ }

    publishStandardEvent('FeedbackSubmitted', { tenantId: cafeId, resourceId: feedback.id, metadata: { score } }, 'feedback')

    // K23 — auto-create (and, for score=1, auto-escalate) a support ticket for low scores
    if (score <= 2) {
      await createSupportTicketForFeedback(cafeId, feedback.id, null, score, feedback.comment)
        .catch(err => logger.warn({ msg: 'createSupportTicketForFeedback failed', err }))
    }

    return res.status(201).json({ ok: true, feedbackId: feedback.id })

  } catch (err) {
    logger.error({ msg: 'POST /api/v1/public/feedback error', err })
    return res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

// ─── GET /api/v1/feedbacks ────────────────────────────────────────────────────

router.get('/api/v1/feedbacks', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const limit  = Math.min(Number(req.query.limit ?? 50), 200)
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined
    const since    = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 30 * 24 * 3600_000)

    const feedbacks = await prisma.feedback.findMany({
      where: {
        cafeId,
        createdAt: { gte: since },
        ...(minScore !== undefined ? { score: { lte: minScore } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    })

    return res.json(feedbacks)
  } catch (err) {
    logger.error({ msg: 'GET /api/v1/feedbacks error', err })
    return res.status(500).json({ error: 'Failed to fetch feedbacks' })
  }
})

// ─── GET /api/v1/feedbacks/summary ───────────────────────────────────────────
// Returns: { total, average, distribution: {1:n, 2:n, 3:n, 4:n, 5:n}, recent[] }

router.get('/api/v1/feedbacks/summary', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const since  = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 30 * 24 * 3600_000)

    const feedbacks = await prisma.feedback.findMany({
      where:   { cafeId, createdAt: { gte: since } },
      select:  { score: true, comment: true, tableNumber: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })

    const total   = feedbacks.length
    const average = total > 0
      ? feedbacks.reduce((s, f) => s + f.score, 0) / total
      : 0

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const f of feedbacks) distribution[f.score] = (distribution[f.score] ?? 0) + 1

    // Recent negative feedbacks for owner attention (score ≤ 2)
    const negatives = feedbacks
      .filter(f => f.score <= 2 && f.comment.trim().length > 0)
      .slice(0, 10)

    return res.json({
      total,
      average:      Math.round(average * 10) / 10,
      distribution,
      negatives,
      since:        since.toISOString(),
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/v1/feedbacks/summary error', err })
    return res.status(500).json({ error: 'Failed to compute summary' })
  }
})

// ─── K23 — admin endpoints ────────────────────────────────────────────────────

// GET /api/admin/feedback/csat?since=
router.get('/api/admin/feedback/csat', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const since  = req.query.since ? new Date(req.query.since as string) : undefined
    const score  = await getSatisfactionScore(cafeId, since)
    return res.json(score)
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/feedback/csat error', err })
    return res.status(500).json({ error: 'Failed to compute CSAT' })
  }
})

// POST /api/admin/feedback/request — body: { channel, to, link, orderId? }
router.post('/api/admin/feedback/request', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { channel, to, link, orderId } = req.body as { channel?: FeedbackChannel; to?: string; link?: string; orderId?: string }
    if (!channel || !to || !link) return res.status(400).json({ error: 'channel, to, and link are required' })

    await requestFeedback(cafeId, channel, to, link, orderId)
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/feedback/request error', err })
    return res.status(500).json({ error: 'Failed to send feedback request' })
  }
})

// GET /api/admin/support-tickets?status=
router.get('/api/admin/support-tickets', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const tickets = await listTickets(cafeId, req.query.status as string | undefined)
    return res.json({ tickets })
  } catch (err) {
    logger.error({ msg: 'GET /api/admin/support-tickets error', err })
    return res.status(500).json({ error: 'Failed to fetch tickets' })
  }
})

router.patch('/api/admin/support-tickets/:id/escalate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const ticket = await escalateTicket(req.admin!.cafeId, req.params.id as string)
    return res.json({ ticket })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed to escalate ticket' })
  }
})

router.patch('/api/admin/support-tickets/:id/resolve', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const ticket = await resolveTicket(req.admin!.cafeId, req.params.id as string)
    return res.json({ ticket })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed to resolve ticket' })
  }
})

export default router
