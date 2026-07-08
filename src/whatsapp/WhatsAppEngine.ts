// ─── WhatsApp Automation Engine (K25) ──────────────────────────────────────
// Delivery reuses the existing Evolution API sender (routes/antiFraud.ts
// sendWhatsApp) exclusively — this module never talks to Evolution directly.
// n8n already owns two WhatsApp flows (inactive-customer re-engagement,
// review-request pipeline) and is untouched; this is the in-app engine for
// everything that isn't already an n8n workflow: broadcasts, scheduling,
// templates, delivery status, conversation log, retries, and event triggers.

import prisma from '../prisma'
import logger from '../logger'
import { eventBus, publishStandardEvent } from '../core'
import { sendWhatsApp } from '../routes/antiFraud'

const MAX_RETRIES = 3

function renderTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`{{${k}}}`, 'g'), v), body)
}

// ─── Core dispatch — every send path (immediate, scheduled, broadcast, retry) ─
// goes through this one function, so there is exactly one place that calls
// sendWhatsApp and writes delivery status.
async function dispatch(messageId: string) {
  const msg = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: messageId } })

  try {
    const ok = await sendWhatsApp(msg.phone, msg.body)
    const updated = await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data:  ok
        ? { status: 'SENT', sentAt: new Date() }
        : { status: 'SKIPPED', error: 'Evolution API not configured or rejected the message' },
    })
    publishStandardEvent(ok ? 'WhatsAppMessageSent' : 'WhatsAppMessageFailed', {
      tenantId: msg.cafeId, resourceId: messageId, metadata: { phone: msg.phone, ok },
    }, 'whatsapp-engine')
    return updated
  } catch (err: any) {
    const updated = await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data:  { status: 'FAILED', error: err.message ?? 'Unknown error' },
    })
    publishStandardEvent('WhatsAppMessageFailed', {
      tenantId: msg.cafeId, resourceId: messageId, metadata: { phone: msg.phone, error: err.message },
    }, 'whatsapp-engine')
    return updated
  }
}

// ─── Send (immediate or scheduled) ─────────────────────────────────────────
export async function sendMessage(
  cafeId: string,
  phone:  string,
  body:   string,
  options: { templateKey?: string; scheduledFor?: Date } = {},
) {
  const msg = await prisma.whatsAppMessage.create({
    data: {
      cafeId, phone, body,
      templateKey:  options.templateKey,
      scheduledFor: options.scheduledFor,
      status:       'PENDING',
    },
  })

  publishStandardEvent('WhatsAppMessageQueued', {
    tenantId: cafeId, resourceId: msg.id, metadata: { phone, scheduled: !!options.scheduledFor },
  }, 'whatsapp-engine')

  if (options.scheduledFor && options.scheduledFor > new Date()) return msg
  return dispatch(msg.id)
}

export async function sendTemplatedMessage(
  cafeId: string,
  phone:  string,
  templateKey: string,
  vars: Record<string, string> = {},
  scheduledFor?: Date,
) {
  const template = await prisma.whatsAppTemplate.findUnique({ where: { cafeId_key: { cafeId, key: templateKey } } })
  if (!template || !template.isActive) throw new Error(`Template "${templateKey}" not found or inactive for cafe ${cafeId}`)
  return sendMessage(cafeId, phone, renderTemplate(template.body, vars), { templateKey, scheduledFor })
}

// ─── Retry ──────────────────────────────────────────────────────────────────
export async function retryMessage(messageId: string) {
  const msg = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: messageId } })
  if (msg.status !== 'FAILED') throw new Error(`Message ${messageId} is not FAILED (status: ${msg.status})`)
  if (msg.retryCount >= MAX_RETRIES) throw new Error(`Message ${messageId} exceeded max retries (${MAX_RETRIES})`)

  await prisma.whatsAppMessage.update({ where: { id: messageId }, data: { retryCount: { increment: 1 }, status: 'PENDING' } })
  return dispatch(messageId)
}

// ─── Scheduled message processing (cron-callable) ──────────────────────────
export async function processScheduledMessages(): Promise<number> {
  const due = await prisma.whatsAppMessage.findMany({
    where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
  })
  for (const msg of due) await dispatch(msg.id)
  return due.length
}

// ─── Broadcast campaigns ────────────────────────────────────────────────────
export async function sendBroadcast(cafeId: string, phones: string[], body: string, templateKey?: string) {
  const results = await Promise.all(phones.map(phone => sendMessage(cafeId, phone, body, { templateKey })))
  const sent = results.filter(r => r.status === 'SENT').length

  publishStandardEvent('WhatsAppBroadcastCompleted', {
    tenantId: cafeId, resourceId: templateKey ?? 'broadcast', metadata: { total: phones.length, sent },
  }, 'whatsapp-engine')

  return { total: phones.length, sent, failed: phones.length - sent }
}

// ─── Templates ──────────────────────────────────────────────────────────────
export async function upsertTemplate(cafeId: string, key: string, body: string) {
  return prisma.whatsAppTemplate.upsert({
    where:  { cafeId_key: { cafeId, key } },
    update: { body },
    create: { cafeId, key, body },
  })
}

export async function listTemplates(cafeId: string) {
  return prisma.whatsAppTemplate.findMany({ where: { cafeId } })
}

// ─── Conversation log ───────────────────────────────────────────────────────
export async function logInboundMessage(cafeId: string, phone: string, body: string) {
  return prisma.whatsAppMessage.create({
    data: { cafeId, phone, body, direction: 'INBOUND', status: 'SENT', sentAt: new Date() },
  })
}

export async function getConversation(cafeId: string, phone: string, limit = 50) {
  return prisma.whatsAppMessage.findMany({
    where:   { cafeId, phone },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}

// ─── Event-triggered messages ───────────────────────────────────────────────
// Concrete example wiring on top of the existing eventBus (K11's
// standardization sprint) and the cafe's WhatsApp number (same
// paymentConfig.whatsappNumber field already used for the low-stock alert
// in routes/antiFraud.ts) — not a generic rule engine, a real trigger.
export function initWhatsAppEngine(): void {
  eventBus.subscribe('SupportTicketEscalated', async (event: any) => {
    try {
      const { tenantId: cafeId } = event.payload as { tenantId: string }
      const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { paymentConfig: true } })
      const phone = (cafe?.paymentConfig as { whatsappNumber?: string } | null)?.whatsappNumber
      if (!phone) return
      await sendMessage(cafeId, phone, '⚠️ A support ticket was just escalated and needs urgent attention.')
    } catch (err) {
      logger.error({ msg: '[WhatsAppEngine] SupportTicketEscalated handler failed', err })
    }
  })

  // Sends the customer's OWN WhatsApp number a notification when they
  // become eligible for a loyalty reward — distinct from the
  // SupportTicketEscalated handler above, which notifies the restaurant's
  // own WhatsApp number. Gated on CafeCustomer.optIn so we never message a
  // customer who hasn't consented to WhatsApp contact.
  eventBus.subscribe('LoyaltyRewardEligible', async (event: any) => {
    try {
      const { tenantId: cafeId, metadata } = event.payload as {
        tenantId: string
        metadata: { phone: string; rewardNames: string[]; currentPoints: number }
      }
      const customer = await prisma.cafeCustomer.findUnique({
        where:  { cafeId_phone: { cafeId, phone: metadata.phone } },
        select: { optIn: true },
      })
      if (!customer?.optIn) return

      const rewardList = metadata.rewardNames.join(', ')
      await sendMessage(cafeId, metadata.phone,
        `🎁 You've earned enough points (${metadata.currentPoints}) for: ${rewardList}! Ask your server to redeem it on your next visit.`)
    } catch (err) {
      logger.error({ msg: '[WhatsAppEngine] LoyaltyRewardEligible handler failed', err })
    }
  })

  logger.info({ msg: '[WhatsAppEngine] initialized — subscribed to SupportTicketEscalated, LoyaltyRewardEligible' })
}
