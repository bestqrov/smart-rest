// ─── Smart Intelligence Marketing Advisor v1 — ROI Estimation (K62) ────────
// Verified: no MarketingCampaign/SocialPost/EmailMessage/WhatsAppMessage
// model has a cost/spend/budget field anywhere in the schema, so a true
// ROI (return / cost) cannot be computed — this is genuinely missing
// data, not missed reuse. Instead this estimates revenue *impact*: paid
// order revenue in the 3 days following a published campaign — a rough,
// clearly-labeled proxy, rule-based, no forecasting model.

import prisma from '../../prisma'
import type { CampaignRoiEstimate } from './types'

const DEFAULT_WINDOW_DAYS = 30
const ATTRIBUTION_WINDOW_DAYS = 3

export async function estimateCampaignRevenueImpact(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS, limit = 10): Promise<CampaignRoiEstimate[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const campaigns = await prisma.marketingCampaign.findMany({
    where:  { cafeId: tenantId, status: 'published', createdAt: { gte: since } },
    select: { id: true, productName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  if (campaigns.length === 0) return []

  const estimates = await Promise.all(campaigns.map(async (campaign): Promise<CampaignRoiEstimate> => {
    const windowEnd = new Date(campaign.createdAt.getTime() + ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const agg = await (prisma.order as any).aggregate({
      where: { cafeId: tenantId, isPaid: true, createdAt: { gte: campaign.createdAt, lte: windowEnd } },
      _sum: { totalPrice: true },
    })

    return {
      campaignId: campaign.id, productName: campaign.productName, publishedAt: campaign.createdAt,
      estimatedRevenueImpact: Math.round((agg._sum?.totalPrice ?? 0) * 100) / 100,
    }
  }))

  return estimates.sort((a, b) => b.estimatedRevenueImpact - a.estimatedRevenueImpact).slice(0, limit)
}
