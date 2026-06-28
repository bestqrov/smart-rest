import type { CollectorDefinition, CollectedData, Period } from '../../types'

async function collect(period: Period): Promise<CollectedData> {
  const { default: prisma } = await import('../../../prisma')

  // Cafe model has no createdAt — new_today/new_30d are not available
  const [
    totalCount,
    activeCount,
    orderCount,
    revenueAgg,
  ] = await Promise.all([
    prisma.cafe.count(),
    prisma.cafe.count({ where: { isActive: true } }),
    prisma.order.count({ where: { createdAt: { gte: period.start, lte: period.end } } }),
    (prisma.order as any).aggregate({
      where: { createdAt: { gte: period.start, lte: period.end } },
      _sum: { totalPrice: true },
    }),
  ])

  return {
    module:      'restaurants',
    collectedAt: new Date(),
    period,
    data: {
      'restaurants.total':     totalCount,
      'restaurants.active':    activeCount,
      'restaurants.new_today': null,    // Cafe model has no createdAt field
      'restaurants.new_30d':   null,    // Cafe model has no createdAt field
      'orders.total_30d':      orderCount,
      'orders.revenue_30d':    (revenueAgg as any)._sum?.totalPrice ?? null,
    },
  }
}

export const RESTAURANT_COLLECTOR: CollectorDefinition = {
  module:  'restaurants',
  name:    'Restaurant Collector',
  collect,
  metrics: [
    'restaurants.total',
    'restaurants.active',
    'restaurants.new_today',
    'restaurants.new_30d',
    'orders.total_30d',
    'orders.revenue_30d',
  ],
}
