// ─── Marketplace Engine Adapter ───────────────────────────────────────────────
import { registerModule }                      from '../registry/IntegrationRegistry'
import type { SearchResult, ActivityEntry }    from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerMarketplaceAdapter(): void {
  registerModule({
    id:           'marketplace',
    name:         'Marketplace Engine',
    nameAr:       'محرك الماركت بليس',
    version:      '3.0.0',
    capabilities: ['search', 'events', 'widgets', 'commands', 'activity'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).marketplaceProduct.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'down', message: 'DB unreachable', checkedAt: new Date().toISOString() }
      }
    },

    searchProviders: [
      {
        entityType: 'MarketplaceProduct',
        labelAr:    'منتجات الماركت',
        labelEn:    'Marketplace Products',
        async search(query): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const rows   = await (prisma as any).marketplaceProduct.findMany({
            where:  {
              isArchived: false,
              OR: [
                { name:        { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { brand:       { contains: query, mode: 'insensitive' } },
              ],
            },
            take:   10,
            select: { id: true, name: true, brand: true, type: true, basePrice: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'MarketplaceProduct',
            moduleId:   'marketplace',
            title:      r.name,
            subtitle:   r.brand ?? r.type,
            url:        `/admin/marketplace/products/${r.id}`,
            metadata:   { price: r.basePrice },
          }))
        },
      },
      {
        entityType: 'MarketplaceOrder',
        labelAr:    'طلبات الماركت',
        labelEn:    'Marketplace Orders',
        async search(query, tenantId): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const where: any = {
            OR: [
              { orderNumber: { contains: query, mode: 'insensitive' } },
              { notes:       { contains: query, mode: 'insensitive' } },
            ],
          }
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).marketplaceOrder.findMany({
            where, take: 10,
            select: { id: true, orderNumber: true, status: true, totalPrice: true, cafeId: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'MarketplaceOrder',
            moduleId:   'marketplace',
            title:      `طلب ${r.orderNumber}`,
            subtitle:   r.status,
            url:        `/admin/marketplace/orders/${r.id}`,
          }))
        },
      },
      {
        entityType: 'MarketplaceBundle',
        labelAr:    'باقات الماركت',
        labelEn:    'Marketplace Bundles',
        async search(query): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const rows   = await (prisma as any).marketplaceBundle.findMany({
            where:  {
              isActive: true,
              OR: [
                { name:        { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            take:   10,
            select: { id: true, name: true, type: true, bundlePrice: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'MarketplaceBundle',
            moduleId:   'marketplace',
            title:      r.name,
            subtitle:   r.type,
            url:        `/admin/marketplace/bundles/${r.id}`,
          }))
        },
      },
    ],

    activitySources: [
      {
        sourceId: 'marketplace-orders',
        labelAr:  'طلبات الماركت',
        labelEn:  'Marketplace Orders',
        async getRecent(limit, tenantId): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const where: any = {}
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).marketplaceOrder.findMany({
            where, orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, orderNumber: true, status: true, cafeId: true, createdAt: true, totalPrice: true },
          })
          const levelMap: Record<string, ActivityEntry['level']> = {
            APPROVED: 'success', FULFILLED: 'success',
            REJECTED: 'error',  CANCELLED: 'warning',
            SUBMITTED: 'info',  UNDER_REVIEW: 'info', DRAFT: 'info',
          }
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'marketplace-orders',
            moduleId:   'marketplace',
            type:       'MARKETPLACE_ORDER',
            titleAr:    `طلب ${r.orderNumber} — ${r.status}`,
            titleEn:    `Order ${r.orderNumber} — ${r.status}`,
            entityId:   r.id,
            entityType: 'MarketplaceOrder',
            tenantId:   r.cafeId,
            level:      levelMap[r.status] ?? 'info',
            occurredAt: r.createdAt.toISOString(),
            metadata:   { total: r.totalPrice },
          }))
        },
      },
    ],

    commands: [
      {
        id:          'marketplace:refresh-recommendations',
        labelAr:     'تحديث التوصيات',
        labelEn:     'Refresh Recommendations',
        description: 'Re-run AI recommendation engine for all tenants',
        requiresSA:  true,
        async execute() {
          const { eventBus } = await import('../../core')
          eventBus.publish('RecommendationGenerated', { trigger: 'MANUAL', scope: 'ALL' }, 'CommandBus')
          return { ok: true, message: 'Recommendation refresh triggered' }
        },
      },
    ],

    widgets: [
      {
        id:         'marketplace:pending-orders',
        moduleId:   'marketplace',
        labelAr:    'الطلبات المعلقة',
        labelEn:    'Pending Orders',
        type:       'stat',
        size:       'sm',
        requiresSA: true,
        async getData() {
          const prisma = await getPrisma()
          const count  = await (prisma as any).marketplaceOrder.count({ where: { status: 'UNDER_REVIEW' } })
          return { count, label: 'طلبات تحت المراجعة' }
        },
      },
      {
        id:         'marketplace:total-products',
        moduleId:   'marketplace',
        labelAr:    'إجمالي المنتجات',
        labelEn:    'Total Products',
        type:       'stat',
        size:       'sm',
        requiresSA: true,
        async getData() {
          const prisma = await getPrisma()
          const count  = await (prisma as any).marketplaceProduct.count({ where: { isArchived: false } })
          return { count, label: 'منتج نشط' }
        },
      },
    ],
  })
}
