import type { CollectorDefinition, CollectedData, Period } from '../../types'

async function collect(period: Period): Promise<CollectedData> {
  const { default: prisma } = await import('../../../prisma')

  const periodFilter = { createdAt: { gte: period.start, lte: period.end } }

  const [
    evaluations,
    avgScoreAgg,
    goldPlus,
    platinumPlus,
  ] = await Promise.all([
    (prisma as any).certificationResult.count({ where: { ...periodFilter, status: 'COMPLETED' } }),
    (prisma as any).certificationResult.aggregate({
      where: { status: 'COMPLETED', ...periodFilter },
      _avg: { score: true },
    }),
    // gold+ = GOLD, PLATINUM, DIAMOND (latest per tenant, non-expired)
    (prisma as any).certificationResult.count({
      where: {
        status: 'COMPLETED',
        level:  { in: ['GOLD', 'PLATINUM', 'DIAMOND'] },
        expiresAt: { gt: new Date() },
      },
    }),
    (prisma as any).certificationResult.count({
      where: {
        status: 'COMPLETED',
        level:  { in: ['PLATINUM', 'DIAMOND'] },
        expiresAt: { gt: new Date() },
      },
    }),
  ])

  return {
    module:      'certification',
    collectedAt: new Date(),
    period,
    data: {
      'certification.evaluations':  evaluations,
      'certification.avg_score':    avgScoreAgg._avg?.score != null
                                      ? Math.round(avgScoreAgg._avg.score * 10) / 10
                                      : null,
      'certification.gold_plus':    goldPlus,
      'certification.platinum_plus': platinumPlus,
    },
  }
}

export const CERTIFICATION_COLLECTOR: CollectorDefinition = {
  module:  'certification',
  name:    'Certification Collector',
  collect,
  metrics: [
    'certification.evaluations',
    'certification.avg_score',
    'certification.gold_plus',
    'certification.platinum_plus',
  ],
}
