// ─── Analytics Engine Adapter ─────────────────────────────────────────────────
import { registerModule }         from '../registry/IntegrationRegistry'
import type { ActivityEntry }     from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerAnalyticsAdapter(): void {
  registerModule({
    id:           'analytics',
    name:         'SmartSuite Analytics Engine',
    nameAr:       'محرك التحليلات',
    version:      '1.0.0',
    capabilities: ['widgets', 'commands', 'activity', 'events'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).metricSnapshot.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'degraded', message: 'MetricSnapshot table missing', checkedAt: new Date().toISOString() }
      }
    },

    activitySources: [
      {
        sourceId: 'analytics-snapshots',
        labelAr:  'لقطات التحليلات',
        labelEn:  'Analytics Snapshots',
        async getRecent(limit, tenantId): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const where: any = { type: 'DAILY' }
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).metricSnapshot.findMany({
            where, orderBy: { date: 'desc' }, take: limit,
            select: { id: true, cafeId: true, date: true, revenue: true, orders: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'analytics-snapshots',
            moduleId:   'analytics',
            type:       'ANALYTICS_SNAPSHOT',
            titleAr:    `تحليل يومي — ${r.date?.toISOString?.()?.slice(0, 10) ?? ''}`,
            entityId:   r.id,
            entityType: 'MetricSnapshot',
            tenantId:   r.cafeId,
            level:      'info',
            occurredAt: r.date?.toISOString?.() ?? new Date().toISOString(),
            metadata:   { revenue: r.revenue, orders: r.orders },
          }))
        },
      },
    ],

    commands: [
      {
        id:          'analytics:sync-all',
        labelAr:     'مزامنة التحليلات',
        labelEn:     'Sync Analytics',
        description: 'Rebuild metric snapshots for all cafes for current period',
        requiresSA:  true,
        async execute() {
          // Trigger via event bus — the analytics engine subscribes
          const { eventBus } = await import('../../core')
          eventBus.publish('AIGenerationCompleted', { trigger: 'ANALYTICS_SYNC', scope: 'ALL' }, 'CommandBus')
          return { ok: true, message: 'Analytics sync triggered' }
        },
      },
    ],

    widgets: [
      {
        id:         'analytics:platform-revenue',
        moduleId:   'analytics',
        labelAr:    'إيرادات المنصة (30 يوم)',
        labelEn:    'Platform Revenue (30d)',
        type:       'stat',
        size:       'md',
        requiresSA: true,
        async getData() {
          const prisma    = await getPrisma()
          const since     = new Date(Date.now() - 30 * 86400000)
          const result    = await (prisma as any).metricSnapshot.aggregate({
            where:   { type: 'DAILY', date: { gte: since } },
            _sum:    { revenue: true, orders: true },
          })
          return {
            revenue: result._sum.revenue ?? 0,
            orders:  result._sum.orders  ?? 0,
            period:  '30d',
          }
        },
      },
    ],
  })
}
