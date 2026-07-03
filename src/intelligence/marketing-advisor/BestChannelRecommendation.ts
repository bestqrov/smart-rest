// ─── Smart Intelligence Marketing Advisor v1 — Best Channel (K62) ──────────
// Ranks channels by THIS tenant's measured performance — reuses
// MarketingMetrics, no second query. Distinct from
// ChannelPlanner.planChannels() (persona/country static planning, not
// measured); see types.ts header for the full reuse verification note.

import { computeEmailMetrics, computeWhatsAppMetrics, computeSocialMetrics } from './MarketingMetrics'
import type { ChannelRanking } from './types'

export async function rankChannelsByPerformance(tenantId: string, windowDays?: number): Promise<ChannelRanking[]> {
  const [email, whatsapp, social] = await Promise.all([
    computeEmailMetrics(tenantId, windowDays),
    computeWhatsAppMetrics(tenantId, windowDays),
    computeSocialMetrics(tenantId, windowDays),
  ])

  const rankings: ChannelRanking[] = [
    { channel: 'EMAIL',    score: email.openRate,             volume: email.sent },
    { channel: 'WHATSAPP', score: whatsapp.sendSuccessRate,    volume: whatsapp.sent + whatsapp.failed },
    { channel: 'SOCIAL',   score: social.successRate,          volume: social.published + social.failed },
  ]

  return rankings.filter(r => r.volume > 0).sort((a, b) => b.score - a.score)
}
