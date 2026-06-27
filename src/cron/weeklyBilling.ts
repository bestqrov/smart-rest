import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

export function startWeeklyBillingCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('59 23 * * 1', async () => {
    logger.info({ msg: '[CRON] Weekly billing job started' })
    try {
      await runWeeklyBilling()
      logger.info({ msg: '[CRON] Weekly billing job completed' })
    } catch (err) {
      logger.error({ msg: '[CRON] Weekly billing job failed', err })
    }
  })
  logger.info({ msg: '[CRON] Weekly billing cron registered (Mon 23:59)' })
  return task
}

// Exported so it can be triggered manually (e.g., from superadmin route or tests)
export async function runWeeklyBilling(): Promise<void> {
  const now = new Date()

  // ── Sweep 1: suspend any live cafe with negative balance (trial ended) ───────
  const inDebt = await prisma.cafe.findMany({
    where: {
      isActive: true,
      walletBalance: { lt: 0 },
      OR: [
        { trialEndsAt: null },
        { trialEndsAt: { lte: now } }
      ]
    },
    select: { id: true, walletBalance: true, country: true, subdomain: true }
  })

  for (const cafe of inDebt) {
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: { isActive: false, billingStatus: 'SUSPENDED' }
    })
    logger.warn({ msg: '[CRON] Cafe suspended — negative balance', cafeId: cafe.id, balance: cafe.walletBalance })
    await fireSuspensionWebhook(cafe.id, cafe.subdomain, cafe.walletBalance, cafe.country)
  }

  // ── Sweep 2: cafes whose trial ends within the next 7 days → generate AI package ──
  const trialWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const trialExpiring = await prisma.cafe.findMany({
    where: {
      trialEndsAt: { gt: now, lte: trialWindow },
      isActive: true
    },
    select: { id: true, country: true }
  })

  for (const cafe of trialExpiring) {
    await handleTrialExpiry(cafe.id, cafe.country)
  }
}

async function handleTrialExpiry(cafeId: string, country: string): Promise<void> {
  try {
    const { aov, orderCount } = await computeCafeAOV(cafeId)
    await suggestBillingTiers(cafeId, country)
    await prisma.cafe.update({ where: { id: cafeId }, data: { billingStatus: 'GRACE_PERIOD' } })
    logger.info({ msg: '[CRON] Trial expiry — AI package generated', cafeId, aov, orderCount })
  } catch (err) {
    logger.error({ msg: '[CRON] handleTrialExpiry failed', cafeId, err })
  }
}

async function fireSuspensionWebhook(cafeId: string, subdomain: string, balance: number, country: string): Promise<void> {
  const webhook = process.env.N8N_BILLING_WEBHOOK || process.env.N8N_WHATSAPP_WEBHOOK
  if (!webhook) {
    logger.info({ msg: '[CRON] No billing webhook configured — skipping WhatsApp invoice', cafeId })
    return
  }
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event:       'CAFE_SUSPENDED',
        cafeId,
        subdomain,
        balance:     balance.toFixed(2),
        country,
        paymentLink: `${process.env.FRONTEND_URL || 'https://smartrestau.com'}/admin/billing`,
        timestamp:   new Date().toISOString()
      })
    })
    logger.info({ msg: '[CRON] Suspension webhook sent', cafeId })
  } catch (err) {
    logger.warn({ msg: '[CRON] Suspension webhook failed', cafeId, err })
  }
}
