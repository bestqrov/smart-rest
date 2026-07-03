// ─── Payment Engine Adapter ───────────────────────────────────────────────────
import { registerModule }                   from '../registry/IntegrationRegistry'
import type { SearchResult, ActivityEntry } from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerPaymentAdapter(): void {
  registerModule({
    id:           'payments',
    name:         'Payment Engine',
    nameAr:       'محرك المدفوعات',
    version:      '1.0.0',
    capabilities: ['search', 'widgets', 'commands', 'activity', 'events'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).paymentTransaction.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'down', message: 'DB unreachable', checkedAt: new Date().toISOString() }
      }
    },

    searchProviders: [
      {
        entityType: 'PaymentTransaction',
        labelAr:    'المعاملات المالية',
        labelEn:    'Payment Transactions',
        async search(query, tenantId): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const where: any = {
            OR: [
              { orderId:   { contains: query, mode: 'insensitive' } },
              { reference: { contains: query, mode: 'insensitive' } },
            ],
          }
          if (tenantId) where.tenantId = tenantId
          const rows = await (prisma as any).paymentTransaction.findMany({
            where, take: 10,
            select: { id: true, orderId: true, amount: true, status: true, provider: true, tenantId: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'PaymentTransaction',
            moduleId:   'payments',
            title:      `دفعة ${r.amount} — ${r.status}`,
            subtitle:   `${r.provider} • طلب ${r.orderId}`,
          }))
        },
      },
    ],

    activitySources: [
      {
        sourceId: 'payment-transactions',
        labelAr:  'المعاملات المالية',
        labelEn:  'Payment Transactions',
        async getRecent(limit, tenantId): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const where: any = {}
          if (tenantId) where.tenantId = tenantId
          const rows = await (prisma as any).paymentTransaction.findMany({
            where, orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, orderId: true, amount: true, status: true, tenantId: true, createdAt: true },
          })
          const levelMap: Record<string, ActivityEntry['level']> = {
            PAID: 'success', FAILED: 'error', REFUNDED: 'warning',
            PENDING: 'info', AUTHORIZED: 'info', CANCELLED: 'warning',
          }
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'payment-transactions',
            moduleId:   'payments',
            type:       'PAYMENT',
            titleAr:    `دفعة ${r.amount} — ${r.status}`,
            entityId:   r.id,
            entityType: 'PaymentTransaction',
            tenantId:   r.tenantId,
            level:      levelMap[r.status] ?? 'info',
            occurredAt: r.createdAt.toISOString(),
            metadata:   { amount: r.amount, orderId: r.orderId },
          }))
        },
      },
    ],

    commands: [
      {
        id:          'payments:reconcile',
        labelAr:     'مطابقة المدفوعات',
        labelEn:     'Reconcile Payments',
        description: 'Check and reconcile pending payment transactions',
        requiresSA:  true,
        async execute() {
          const { eventBus } = await import('../../core')
          eventBus.publish('PaymentCreated', { trigger: 'RECONCILE', scope: 'ALL' }, 'CommandBus')
          return { ok: true, message: 'Payment reconciliation triggered' }
        },
      },
    ],

    widgets: [
      {
        id:         'payments:total-volume',
        moduleId:   'payments',
        labelAr:    'حجم المدفوعات (30 يوم)',
        labelEn:    'Payment Volume (30d)',
        type:       'stat',
        size:       'sm',
        requiresSA: true,
        async getData() {
          const prisma  = await getPrisma()
          const since   = new Date(Date.now() - 30 * 86400000)
          const result  = await (prisma as any).paymentTransaction.aggregate({
            where:  { status: 'PAID', createdAt: { gte: since } },
            _sum:   { amount: true },
            _count: { id: true },
          })
          return { total: result._sum.amount ?? 0, count: result._count.id ?? 0 }
        },
      },
    ],
  })
}
