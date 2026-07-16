// ─── Certification Engine Adapter ────────────────────────────────────────────
import { registerModule }                   from '../registry/IntegrationRegistry'
import type { SearchResult, ActivityEntry } from '../registry/IntegrationRegistry'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export function registerCertificationAdapter(): void {
  registerModule({
    id:           'certification',
    name:         'Certification Engine',
    nameAr:       'محرك الشهادات',
    version:      '1.0.0',
    capabilities: ['search', 'widgets', 'commands', 'activity', 'hooks', 'events'],
    enabled:      true,

    healthCheck: async () => {
      try {
        const prisma = await getPrisma()
        await (prisma as any).certificationResult.count()
        return { status: 'healthy', checkedAt: new Date().toISOString() }
      } catch {
        return { status: 'down', message: 'DB unreachable', checkedAt: new Date().toISOString() }
      }
    },

    searchProviders: [
      {
        entityType: 'CertificationResult',
        labelAr:    'الشهادات',
        labelEn:    'Certificates',
        async search(query, tenantId): Promise<SearchResult[]> {
          const prisma = await getPrisma()
          const where: any = {
            OR: [
              { profileId:   { contains: query, mode: 'insensitive' } },
              { level:       { contains: query, mode: 'insensitive' } },
            ],
          }
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).certificationResult.findMany({
            where, take: 10,
            select: { id: true, profileId: true, level: true, score: true, cafeId: true, issuedAt: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            entityType: 'CertificationResult',
            moduleId:   'certification',
            title:      `شهادة ${r.level} — ${r.score}٪`,
            subtitle:   r.profileId,
            metadata:   { cafeId: r.cafeId, issuedAt: r.issuedAt },
          }))
        },
      },
    ],

    activitySources: [
      {
        sourceId: 'certification-results',
        labelAr:  'نتائج الشهادات',
        labelEn:  'Certification Results',
        async getRecent(limit, tenantId): Promise<ActivityEntry[]> {
          const prisma = await getPrisma()
          const where: any = {}
          if (tenantId) where.cafeId = tenantId
          const rows = await (prisma as any).certificationResult.findMany({
            where, orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, profileId: true, level: true, score: true, cafeId: true, status: true, createdAt: true },
          })
          return rows.map((r: any) => ({
            id:         r.id,
            sourceId:   'certification-results',
            moduleId:   'certification',
            type:       'CERTIFICATION',
            titleAr:    `تقييم ${r.level} — ${r.score}٪`,
            titleEn:    `${r.level} eval — ${r.score}%`,
            entityId:   r.id,
            entityType: 'CertificationResult',
            tenantId:   r.cafeId,
            level:      r.score >= 80 ? 'success' : r.score >= 50 ? 'warning' : 'error' as any,
            occurredAt: r.createdAt.toISOString(),
          }))
        },
      },
    ],

    commands: [
      {
        id:          'certification:reevaluate-all',
        labelAr:     'إعادة تقييم جميع المطاعم',
        labelEn:     'Re-evaluate All Restaurants',
        description: 'Trigger certification re-evaluation for all active tenants',
        requiresSA:  true,
        async execute() {
          const { eventBus } = await import('../../core')
          eventBus.publish('CertificateIssued', { trigger: 'MANUAL_REEVALUATION', scope: 'ALL' }, 'CommandBus')
          return { ok: true, message: 'Re-evaluation triggered for all tenants' }
        },
      },
    ],

    widgets: [
      {
        id:         'certification:top-performers',
        moduleId:   'certification',
        labelAr:    'أعلى المطاعم تقييماً',
        labelEn:    'Top Performers',
        type:       'list',
        size:       'md',
        requiresSA: true,
        async getData() {
          const prisma = await getPrisma()
          return (prisma as any).certificationResult.findMany({
            where:   { status: 'ISSUED' },
            orderBy: { score: 'desc' },
            take:    10,
            select:  { id: true, cafeId: true, level: true, score: true, issuedAt: true },
          })
        },
      },
    ],
  })
}
