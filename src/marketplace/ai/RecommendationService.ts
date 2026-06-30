import { eventBus } from '../../core'
import type { MarketplaceRecommendation, RecommendationContext, RecommendationType, AIScore } from './types'

// Restaurant type → preferred product tags (deterministic affinity map)
const TYPE_AFFINITY: Record<string, string[]> = {
  RESTAURANT: ['pos', 'qr', 'kitchen', 'waiter', 'reservations'],
  FAST_FOOD:  ['pos', 'kiosk', 'kitchen', 'display'],
  CAFE:       ['pos', 'loyalty', 'mobile', 'wifi'],
  HOTEL:      ['reservations', 'pos', 'reporting'],
  DEFAULT:    ['pos', 'analytics', 'reporting'],
}

export async function generateRecommendations(
  ctx: RecommendationContext,
  limit = 10,
): Promise<MarketplaceRecommendation[]> {
  const { default: prisma } = await import('../../prisma')

  const products = await (prisma as any).marketplaceProduct.findMany({
    where: { status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'MODULE_ONLY'] } },
    take: 100,
  })

  const scored: MarketplaceRecommendation[] = []

  for (const product of products) {
    const score = scoreProduct(product, ctx)
    if (score.confidence >= 20) {
      scored.push({ productId: product.id, product, type: inferType(product, ctx), score })
    }
  }

  scored.sort((a, b) =>
    b.score.priority - a.score.priority || b.score.confidence - a.score.confidence,
  )
  return scored.slice(0, limit)
}

function scoreProduct(product: Record<string, unknown>, ctx: RecommendationContext): AIScore {
  let confidence = 30
  let priority = 5
  const reasons: string[] = []

  const tags           = (product.tags as string[] | undefined) ?? []
  const supportedMods  = (product.supportedModules as string[] | undefined) ?? []

  // Type affinity
  const affinityTags = TYPE_AFFINITY[ctx.restaurantType ?? 'DEFAULT'] ?? TYPE_AFFINITY.DEFAULT
  const tagMatch     = tags.filter(t => affinityTags.includes(t)).length
  if (tagMatch > 0) { confidence += tagMatch * 15; reasons.push('يتطابق مع نوع مطعمك') }

  // Module compatibility
  if (ctx.installedModules?.length) {
    const compatible = supportedMods.some(m =>
      m === 'ALL' || ctx.installedModules!.includes(m.toLowerCase()),
    )
    if (compatible) { confidence += 20; reasons.push('متوافق مع وحداتك') }
  }

  // Already purchased → reduce weight
  if (ctx.orderHistory?.includes(product.id as string)) {
    confidence = Math.max(10, confidence - 40)
    reasons.push('تم شراؤه مسبقاً')
  }

  // AI usage
  if (ctx.aiUsage && tags.includes('ai')) {
    confidence += 25; priority = 7; reasons.push('يدعم استخدامك للذكاء الاصطناعي')
  }

  // Marketing activity
  if (ctx.marketingActive && tags.includes('marketing')) {
    confidence += 20; reasons.push('يدعم نشاطك التسويقي')
  }

  // Seasonality (summer: June–August)
  const month = ctx.month ?? (new Date().getMonth() + 1)
  if ([6, 7, 8].includes(month) && tags.includes('summer')) {
    confidence += 10; reasons.push('توصية موسمية')
  }

  confidence = Math.min(100, confidence)
  return { confidence, reason: reasons.join('؛ ') || 'توصية عامة', priority }
}

function inferType(product: Record<string, unknown>, ctx: RecommendationContext): RecommendationType {
  if (ctx.orderHistory?.includes(product.id as string)) return 'FREQUENTLY_BOUGHT_TOGETHER'
  const tags = (product.tags as string[] | undefined) ?? []
  if (tags.includes('upgrade'))  return 'UPGRADE_SUGGESTION'
  if (tags.includes('trending')) return 'TRENDING'
  if (tags.includes('ai'))       return 'AI_PICKS'
  return 'RECOMMENDED_FOR_YOU'
}

export async function getTrending(limit = 6): Promise<MarketplaceRecommendation[]> {
  const { default: prisma } = await import('../../prisma')
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const items = await (prisma as any).marketplaceOrderItem.findMany({
    where: { createdAt: { gte: since } },
    select: { productId: true, quantity: true },
  })

  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.productId] = (counts[item.productId] ?? 0) + item.quantity
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, qty]) => ({
      productId,
      type: 'TRENDING' as RecommendationType,
      score: {
        confidence: Math.min(95, 50 + qty * 5),
        reason: `طُلب ${qty} مرة خلال 30 يوماً`,
        priority: 8,
      },
    }))
}

export async function logRecommendation(
  tenantId: string,
  productId: string,
  rec: MarketplaceRecommendation,
): Promise<string> {
  const { default: prisma } = await import('../../prisma')
  const record = await (prisma as any).recommendationLog.create({
    data: {
      tenantId,
      productId,
      type:            rec.type,
      confidence:      rec.score.confidence,
      reason:          rec.score.reason,
      priority:        rec.score.priority,
      estimatedRoi:    rec.score.estimatedRoi,
      estimatedPayback: rec.score.estimatedPayback,
      status:          'VIEWED',
    },
  })
  eventBus.publish('RecommendationGenerated', { tenantId, productId, type: rec.type }, 'marketplace-ai')
  return record.id
}

export async function acceptRecommendation(logId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  const rec = await (prisma as any).recommendationLog.update({
    where: { id: logId }, data: { status: 'ACCEPTED' },
  })
  eventBus.publish('RecommendationAccepted', { logId, productId: rec.productId }, 'marketplace-ai')
}

export async function dismissRecommendation(logId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  const rec = await (prisma as any).recommendationLog.update({
    where: { id: logId }, data: { status: 'DISMISSED' },
  })
  eventBus.publish('RecommendationDismissed', { logId, productId: rec.productId }, 'marketplace-ai')
}

export async function getAnalytics(tenantId?: string): Promise<Record<string, unknown>> {
  const { default: prisma } = await import('../../prisma')
  const where = tenantId ? { tenantId } : {}
  const [total, accepted, dismissed, byType] = await Promise.all([
    (prisma as any).recommendationLog.count({ where }),
    (prisma as any).recommendationLog.count({ where: { ...where, status: 'ACCEPTED' } }),
    (prisma as any).recommendationLog.count({ where: { ...where, status: 'DISMISSED' } }),
    (prisma as any).recommendationLog.groupBy({
      by: ['type'], _count: { id: true }, where,
    }),
  ])
  const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0
  return { total, accepted, dismissed, conversionRate, byType }
}
