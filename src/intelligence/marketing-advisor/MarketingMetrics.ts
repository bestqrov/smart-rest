// ─── Smart Intelligence Marketing Advisor v1 — Shared Metrics (K62) ────────
// The single per-channel aggregation every detector below reuses — no
// duplicate WhatsApp/Email/Social/Campaign query across the module's
// bullets. Aggregates in JS from the raw Prisma rows (same "no groupBy on
// Mongo" convention K52/K60/K61 already use).

import prisma from '../../prisma'
import type { CampaignPerformance, EmailChannelMetrics, SocialChannelMetrics, WhatsAppChannelMetrics } from './types'

const DEFAULT_WINDOW_DAYS = 30

function since(windowDays: number): Date {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
}

export async function computeEmailMetrics(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<EmailChannelMetrics> {
  const rows = await prisma.emailMessage.findMany({
    where:  { cafeId: tenantId, createdAt: { gte: since(windowDays) } },
    select: { status: true, openedAt: true, clickedAt: true, bouncedAt: true },
  })

  const sent    = rows.filter(r => r.status !== 'PENDING' && r.status !== 'FAILED' && r.status !== 'SKIPPED').length
  const opened  = rows.filter(r => r.openedAt !== null).length
  const clicked = rows.filter(r => r.clickedAt !== null).length
  const bounced = rows.filter(r => r.bouncedAt !== null).length

  return {
    sent, opened, clicked, bounced,
    openRate:  sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
    clickRate: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
  }
}

export async function computeWhatsAppMetrics(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<WhatsAppChannelMetrics> {
  const rows = await prisma.whatsAppMessage.findMany({
    where:  { cafeId: tenantId, direction: 'OUTBOUND', createdAt: { gte: since(windowDays) } },
    select: { status: true },
  })

  const sent   = rows.filter(r => r.status === 'SENT').length
  const failed = rows.filter(r => r.status === 'FAILED').length
  const total  = sent + failed

  return { sent, failed, sendSuccessRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0 }
}

export async function computeSocialMetrics(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<SocialChannelMetrics> {
  const rows = await prisma.socialPost.findMany({
    where:  { cafeId: tenantId, createdAt: { gte: since(windowDays) } },
    select: { status: true, platform: true },
  })

  const published = rows.filter(r => r.status === 'PUBLISHED').length
  const failed    = rows.filter(r => r.status === 'FAILED').length
  const total     = published + failed

  const byPlatform: Record<string, number> = {}
  for (const row of rows.filter(r => r.status === 'PUBLISHED')) {
    byPlatform[row.platform] = (byPlatform[row.platform] ?? 0) + 1
  }

  return { published, failed, successRate: total > 0 ? Math.round((published / total) * 1000) / 10 : 0, byPlatform }
}

export async function computeCampaignPerformance(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<CampaignPerformance> {
  const rows = await prisma.marketingCampaign.findMany({
    where:  { cafeId: tenantId, createdAt: { gte: since(windowDays) } },
    select: { status: true },
  })

  const published = rows.filter(r => r.status === 'published').length
  const failed    = rows.filter(r => r.status === 'failed').length

  return {
    total: rows.length, published, failed,
    successRate: rows.length > 0 ? Math.round((published / rows.length) * 1000) / 10 : 0,
  }
}
