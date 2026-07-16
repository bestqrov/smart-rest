// ─── Email Automation Engine (K26) ─────────────────────────────────────────
// Delivery reuses the existing Resend sender (services/email.ts sendEmail)
// exclusively — this module never calls the Resend API directly. Mirrors
// src/whatsapp/WhatsAppEngine.ts's structure for consistency: broadcasts,
// scheduling, templates, delivery/open/click/bounce tracking, retries, and
// event triggers.

import prisma from '../prisma'
import logger from '../logger'
import { eventBus, publishStandardEvent } from '../core'
import { sendEmail } from '../services/email'

const MAX_RETRIES = 3

function renderTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`{{${k}}}`, 'g'), v), body)
}

// ─── Core dispatch — every send path routes through this one function, so ─
// there is exactly one place that calls sendEmail and writes delivery status.
async function dispatch(messageId: string) {
  const msg = await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } })

  try {
    const providerId = await sendEmail(msg.to, msg.subject, msg.body)
    const updated = await prisma.emailMessage.update({
      where: { id: messageId },
      data:  providerId
        ? { status: 'SENT', sentAt: new Date(), providerId }
        : { status: 'SKIPPED', error: 'Resend not configured (no API key)' },
    })
    publishStandardEvent(providerId ? 'EmailMessageSent' : 'EmailMessageFailed', {
      tenantId: msg.cafeId, resourceId: messageId, metadata: { to: msg.to, providerId },
    }, 'email-engine')
    return updated
  } catch (err: any) {
    const updated = await prisma.emailMessage.update({
      where: { id: messageId },
      data:  { status: 'FAILED', error: err.message ?? 'Unknown error' },
    })
    publishStandardEvent('EmailMessageFailed', {
      tenantId: msg.cafeId, resourceId: messageId, metadata: { to: msg.to, error: err.message },
    }, 'email-engine')
    return updated
  }
}

// ─── Send (immediate or scheduled) ─────────────────────────────────────────
export async function sendMessage(
  cafeId: string,
  to:     string,
  subject: string,
  body:   string,
  options: { templateKey?: string; scheduledFor?: Date } = {},
) {
  const msg = await prisma.emailMessage.create({
    data: {
      cafeId, to, subject, body,
      templateKey:  options.templateKey,
      scheduledFor: options.scheduledFor,
      status:       'PENDING',
    },
  })

  publishStandardEvent('EmailMessageQueued', {
    tenantId: cafeId, resourceId: msg.id, metadata: { to, scheduled: !!options.scheduledFor },
  }, 'email-engine')

  if (options.scheduledFor && options.scheduledFor > new Date()) return msg
  return dispatch(msg.id)
}

export async function sendTemplatedMessage(
  cafeId: string,
  to:     string,
  templateKey: string,
  vars: Record<string, string> = {},
  scheduledFor?: Date,
) {
  const template = await prisma.emailTemplate.findUnique({ where: { cafeId_key: { cafeId, key: templateKey } } })
  if (!template || !template.isActive) throw new Error(`Template "${templateKey}" not found or inactive for cafe ${cafeId}`)
  return sendMessage(cafeId, to, renderTemplate(template.subject, vars), renderTemplate(template.body, vars), { templateKey, scheduledFor })
}

// ─── Retry ──────────────────────────────────────────────────────────────────
export async function retryMessage(messageId: string) {
  const msg = await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } })
  if (msg.status !== 'FAILED') throw new Error(`Message ${messageId} is not FAILED (status: ${msg.status})`)
  if (msg.retryCount >= MAX_RETRIES) throw new Error(`Message ${messageId} exceeded max retries (${MAX_RETRIES})`)

  await prisma.emailMessage.update({ where: { id: messageId }, data: { retryCount: { increment: 1 }, status: 'PENDING' } })
  return dispatch(messageId)
}

// ─── Scheduled message processing (cron-callable) ──────────────────────────
export async function processScheduledMessages(): Promise<number> {
  const due = await prisma.emailMessage.findMany({
    where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
  })
  for (const msg of due) await dispatch(msg.id)
  return due.length
}

// ─── Broadcast campaigns ────────────────────────────────────────────────────
export async function sendBroadcast(cafeId: string, recipients: string[], subject: string, body: string, templateKey?: string) {
  const results = await Promise.all(recipients.map(to => sendMessage(cafeId, to, subject, body, { templateKey })))
  const sent = results.filter(r => r.status === 'SENT').length

  publishStandardEvent('EmailBroadcastCompleted', {
    tenantId: cafeId, resourceId: templateKey ?? 'broadcast', metadata: { total: recipients.length, sent },
  }, 'email-engine')

  return { total: recipients.length, sent, failed: recipients.length - sent }
}

// ─── Templates ──────────────────────────────────────────────────────────────
export async function upsertTemplate(cafeId: string, key: string, subject: string, body: string) {
  return prisma.emailTemplate.upsert({
    where:  { cafeId_key: { cafeId, key } },
    update: { subject, body },
    create: { cafeId, key, subject, body },
  })
}

export async function listTemplates(cafeId: string) {
  return prisma.emailTemplate.findMany({ where: { cafeId } })
}

// ─── Delivery / open / click / bounce tracking ─────────────────────────────
// Called by the Resend webhook route (routes/emailWebhook.ts).
export async function recordProviderEvent(providerId: string, type: 'delivered' | 'opened' | 'clicked' | 'bounced') {
  const msg = await prisma.emailMessage.findFirst({ where: { providerId } })
  if (!msg) return

  const fieldByType = {
    delivered: { status: 'DELIVERED' },
    opened:    { status: 'OPENED', openedAt: new Date() },
    clicked:   { status: 'CLICKED', clickedAt: new Date() },
    bounced:   { status: 'BOUNCED', bouncedAt: new Date() },
  } as const

  await prisma.emailMessage.update({ where: { id: msg.id }, data: fieldByType[type] })

  const eventByType = {
    delivered: 'EmailMessageSent',
    opened:    'EmailMessageOpened',
    clicked:   'EmailMessageClicked',
    bounced:   'EmailMessageBounced',
  } as const

  publishStandardEvent(eventByType[type], {
    tenantId: msg.cafeId, resourceId: msg.id, metadata: { providerId },
  }, 'email-engine')
}

export async function getMessageHistory(cafeId: string, to?: string, limit = 50) {
  return prisma.emailMessage.findMany({
    where:   { cafeId, ...(to ? { to } : {}) },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}

// ─── Event-triggered messages ───────────────────────────────────────────────
// Same real trigger as WhatsAppEngine's (SupportTicketEscalated, K23), on a
// different channel (admin's User.email) — demonstrates one event fanning
// out to multiple channels via the existing eventBus, not a duplicate rule.
export function initEmailEngine(): void {
  eventBus.subscribe('SupportTicketEscalated', async (event: any) => {
    try {
      const { tenantId: cafeId } = event.payload as { tenantId: string }
      const admin = await prisma.user.findFirst({ where: { cafeId }, select: { email: true } })
      if (!admin) return
      await sendMessage(cafeId, admin.email, 'Support ticket escalated', '<p>A support ticket was just escalated and needs urgent attention.</p>')
    } catch (err) {
      logger.error({ msg: '[EmailEngine] SupportTicketEscalated handler failed', err })
    }
  })

  logger.info({ msg: '[EmailEngine] initialized — subscribed to SupportTicketEscalated' })
}
