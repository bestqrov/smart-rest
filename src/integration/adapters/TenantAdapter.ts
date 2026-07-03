// ─── Tenant Lifecycle Engine Adapter ─────────────────────────────────────────
import { registerModule }                   from '../registry/IntegrationRegistry'
import type { SearchResult, ActivityEntry } from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerTenantAdapter(): void {
  registerModule({
    id:           'tenant',
    name:         'Tenant Lifecycle Engine',
    nameAr:       'محرك دورة حياة المستأجر',
    version:      '1.0.0',
    capabilities: ['search', 'widgets', 'commands', 'activity', 'events'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).tenantProfile.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'down', message: 'DB unreachable', checkedAt: new Date().toISOString() }
      }
    },

    searchProviders: [
      {
        entityType: 'TenantProfile',
        labelAr:    'المستأجرون',
        labelEn:    'Tenants',
        async search(query): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const rows   = await (prisma as any).tenantProfile.findMany({
            where:  { tenantId: { contains: query, mode: 'insensitive' } },
            take:   10,
            select: { id: true, tenantId: true, plan: true, state: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'TenantProfile',
            moduleId:   'tenant',
            title:      r.tenantId,
            subtitle:   `${r.plan} — ${r.state}`,
            url:        `/superadmin/tenants/${r.tenantId}`,
          }))
        },
      },
    ],

    activitySources: [
      {
        sourceId: 'tenant-lifecycle',
        labelAr:  'أحداث المستأجرين',
        labelEn:  'Tenant Lifecycle',
        async getRecent(limit): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const rows   = await (prisma as any).tenantProfile.findMany({
            orderBy: { updatedAt: 'desc' }, take: limit,
            select:  { id: true, tenantId: true, state: true, plan: true, updatedAt: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'tenant-lifecycle',
            moduleId:   'tenant',
            type:       'TENANT_STATE',
            titleAr:    `مستأجر ${r.tenantId} — ${r.state}`,
            entityId:   r.tenantId,
            entityType: 'TenantProfile',
            level:      r.state === 'SUSPENDED' || r.state === 'CANCELLED' ? 'warning' : 'info' as any,
            occurredAt: r.updatedAt.toISOString(),
          }))
        },
      },
    ],

    commands: [
      {
        id:          'tenant:process-expired-trials',
        labelAr:     'معالجة التجارب المنتهية',
        labelEn:     'Process Expired Trials',
        description: 'Expire trials + enter grace period for overdue tenants',
        requiresSA:  true,
        async execute() {
          const { expireTrials, expireGracePeriods } = await import('../../tenant')
          const [expired, graceExpired] = await Promise.all([expireTrials(7), expireGracePeriods()])
          return { ok: true, data: { expired: expired.length, graceExpired: graceExpired.length } }
        },
      },
    ],

    widgets: [
      {
        id:         'tenant:state-breakdown',
        moduleId:   'tenant',
        labelAr:    'توزيع حالات المستأجرين',
        labelEn:    'Tenant State Breakdown',
        type:       'chart',
        size:       'md',
        requiresSA: true,
        async getData() {
          const prisma  = await getPrisma()
          const states  = ['PENDING','TRIAL','ACTIVE','GRACE_PERIOD','SUSPENDED','CANCELLED','ARCHIVED']
          const counts  = await Promise.all(
            states.map(async s => ({
              state: s,
              count: await (prisma as any).tenantProfile.count({ where: { state: s } }),
            }))
          )
          return counts
        },
      },
      {
        id:         'tenant:active-count',
        moduleId:   'tenant',
        labelAr:    'المستأجرون النشطون',
        labelEn:    'Active Tenants',
        type:       'stat',
        size:       'sm',
        requiresSA: true,
        async getData() {
          const prisma = await getPrisma()
          const count  = await (prisma as any).tenantProfile.count({ where: { state: 'ACTIVE' } })
          return { count, label: 'مستأجر نشط' }
        },
      },
    ],
  })
}
