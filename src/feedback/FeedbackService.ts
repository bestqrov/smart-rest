// ─── Customer Feedback Automation (K23) ────────────────────────────────────
// Feedback forms + analytics summary already exist and work (Feedback model,
// routes/feedback.ts: POST /public/feedback, GET /feedbacks, GET
// /feedbacks/summary) — reused, not duplicated. WhatsApp delivery reuses the
// existing Evolution API sender (now exported from routes/antiFraud.ts)
// instead of a second implementation; email reuses services/email.ts.
// Genuinely missing: proactive feedback requests, a CSAT metric, and
// auto-created/escalated support tickets for low scores.

import prisma from '../prisma'
import logger from '../logger'
import { publishStandardEvent } from '../core'
import { sendWhatsApp } from '../routes/antiFraud'
import { sendEmail } from '../services/email'

export type FeedbackChannel = 'WHATSAPP' | 'EMAIL' | 'SMS'

// SMS has no provider wired up yet — same graceful no-op posture already
// used by sendWhatsApp when Evolution API isn't configured.
async function sendSms(to: string, message: string): Promise<void> {
  if (!process.env.SMS_PROVIDER_URL) {
    logger.warn({ msg: '[FeedbackService] SMS provider not configured — skipping SMS send', to })
    return
  }
  await fetch(process.env.SMS_PROVIDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })
}

// ─── Automatic feedback requests (multi-channel) ───────────────────────────
export async function requestFeedback(
  cafeId:  string,
  channel: FeedbackChannel,
  to:      string,
  link:    string,
  orderId?: string,
) {
  const message = `شكراً لزيارتك! نتمنى تقييم تجربتك: ${link}`

  if (channel === 'WHATSAPP') await sendWhatsApp(to, message)
  else if (channel === 'EMAIL') await sendEmail(to, 'How was your visit?', `<p>${message}</p>`)
  else await sendSms(to, message)

  publishStandardEvent('FeedbackRequested', {
    tenantId: cafeId, resourceId: orderId ?? to, metadata: { channel, to },
  }, 'feedback')
}

// ─── Customer satisfaction score (CSAT %) ──────────────────────────────────
// Distinct from the existing /feedbacks/summary average — CSAT is the
// standard % of respondents scoring >=4, not a raw mean.
export async function getSatisfactionScore(cafeId: string, since?: Date) {
  const where = { cafeId, ...(since ? { createdAt: { gte: since } } : {}) }
  const [total, satisfied] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { ...where, score: { gte: 4 } } }),
  ])
  return { total, satisfied, csat: total > 0 ? Math.round((satisfied / total) * 1000) / 10 : 0 }
}

// ─── Support tickets ─────────────────────────────────────────────────────────
// Escalation rule: score=1 (most negative) escalates immediately on
// creation; everything else starts OPEN/NORMAL and can be escalated manually.
export async function createSupportTicketForFeedback(cafeId: string, feedbackId: string, phone: string | null, score: number, comment: string) {
  const urgent = score === 1

  const ticket = await prisma.supportTicket.create({
    data: {
      cafeId,
      source:   'FEEDBACK',
      sourceId: feedbackId,
      phone:    phone ?? undefined,
      subject:  `Low feedback score (${score}★)${comment ? `: ${comment.slice(0, 80)}` : ''}`,
      status:   urgent ? 'ESCALATED' : 'OPEN',
      priority: urgent ? 'URGENT' : 'HIGH',
      escalatedAt: urgent ? new Date() : undefined,
    },
  })

  publishStandardEvent('SupportTicketCreated', {
    tenantId: cafeId, resourceId: ticket.id, metadata: { source: 'FEEDBACK', sourceId: feedbackId, score },
  }, 'feedback')

  if (urgent) {
    publishStandardEvent('SupportTicketEscalated', {
      tenantId: cafeId, resourceId: ticket.id, metadata: { reason: 'score=1' },
    }, 'feedback')
  }

  return ticket
}

export async function escalateTicket(cafeId: string, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, cafeId } })
  if (!ticket) throw new Error(`Ticket ${ticketId} not found for cafe ${cafeId}`)
  if (ticket.status === 'RESOLVED') throw new Error('Cannot escalate a resolved ticket')

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data:  { status: 'ESCALATED', priority: 'URGENT', escalatedAt: new Date() },
  })
  publishStandardEvent('SupportTicketEscalated', { tenantId: cafeId, resourceId: ticketId, metadata: { reason: 'manual' } }, 'feedback')
  return updated
}

export async function resolveTicket(cafeId: string, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, cafeId } })
  if (!ticket) throw new Error(`Ticket ${ticketId} not found for cafe ${cafeId}`)

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data:  { status: 'RESOLVED', resolvedAt: new Date() },
  })
  publishStandardEvent('SupportTicketResolved', { tenantId: cafeId, resourceId: ticketId, metadata: {} }, 'feedback')
  return updated
}

export async function listTickets(cafeId: string, status?: string) {
  return prisma.supportTicket.findMany({
    where:   { cafeId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}
