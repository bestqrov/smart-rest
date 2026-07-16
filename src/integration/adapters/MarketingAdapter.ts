// ─── Marketing Brain Adapter ──────────────────────────────────────────────────
import { registerModule }                   from '../registry/IntegrationRegistry'
import type { SearchResult, ActivityEntry } from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerMarketingAdapter(): void {
  registerModule({
    id:           'marketing',
    name:         'Marketing Brain',
    nameAr:       'المخ التسويقي',
    version:      '1.0.0',
    capabilities: ['search', 'widgets', 'commands', 'activity', 'events'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).marketingCampaign.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'down', message: 'DB unreachable', checkedAt: new Date().toISOString() }
      }
    },

    searchProviders: [
      {
        entityType: 'MarketingCampaign',
        labelAr:    'الحملات التسويقية',
        labelEn:    'Marketing Campaigns',
        async search(query, tenantId): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const where: any = {
            OR: [
              { name:    { contains: query, mode: 'insensitive' } },
              { subject: { contains: query, mode: 'insensitive' } },
            ],
          }
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).marketingCampaign.findMany({
            where, take: 10,
            select: { id: true, name: true, status: true, channel: true, cafeId: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'MarketingCampaign',
            moduleId:   'marketing',
            title:      r.name,
            subtitle:   `${r.channel} — ${r.status}`,
          }))
        },
      },
    ],

    activitySources: [
      {
        sourceId: 'marketing-campaigns',
        labelAr:  'الحملات التسويقية',
        labelEn:  'Marketing Campaigns',
        async getRecent(limit, tenantId): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const where: any = {}
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).marketingCampaign.findMany({
            where, orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, name: true, status: true, channel: true, cafeId: true, createdAt: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'marketing-campaigns',
            moduleId:   'marketing',
            type:       'CAMPAIGN',
            titleAr:    `حملة: ${r.name} — ${r.status}`,
            titleEn:    `Campaign: ${r.name} — ${r.status}`,
            entityId:   r.id,
            entityType: 'MarketingCampaign',
            tenantId:   r.cafeId,
            level:      r.status === 'COMPLETED' ? 'success' : r.status === 'FAILED' ? 'error' : 'info' as any,
            occurredAt: r.createdAt.toISOString(),
          }))
        },
      },
    ],

    commands: [
      {
        id:          'marketing:run-brain',
        labelAr:     'تشغيل المخ التسويقي',
        labelEn:     'Run Marketing Brain',
        description: 'Trigger AI campaign generation for all eligible tenants',
        requiresSA:  true,
        async execute() {
          const { eventBus } = await import('../../core')
          eventBus.publish('CampaignCompleted', { trigger: 'MANUAL_RUN', scope: 'ALL' }, 'CommandBus')
          return { ok: true, message: 'Marketing Brain triggered' }
        },
      },
    ],

    widgets: [
      {
        id:         'marketing:active-campaigns',
        moduleId:   'marketing',
        labelAr:    'الحملات النشطة',
        labelEn:    'Active Campaigns',
        type:       'stat',
        size:       'sm',
        requiresSA: false,
        async getData(tenantId) {
          const prisma = await getPrisma()
          const where: any = { status: 'RUNNING' }
          if (tenantId) where.cafeId = tenantId
          const count = await (prisma as any).marketingCampaign.count({ where })
          return { count, label: 'حملة نشطة' }
        },
      },
    ],
  })
}
