import type { CollectorDefinition, CollectedData, Period } from '../../types'

async function collect(period: Period): Promise<CollectedData> {
  const { default: prisma } = await import('../../../prisma')

  const periodFilter = { completedAt: { gte: period.start, lte: period.end } }

  const [
    completed,
    failed,
    running,
    queued,
    tokenAndCostAgg,
    durationAgg,
  ] = await Promise.all([
    prisma.aIJob.count({ where: { ...periodFilter, status: 'COMPLETED' } }),
    prisma.aIJob.count({ where: { ...periodFilter, status: 'FAILED' } }),
    prisma.aIJob.count({ where: { status: 'RUNNING' } }),
    prisma.aIJob.count({ where: { status: 'QUEUED' } }),
    prisma.aIJob.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: period.start, lte: period.end } },
      _sum: { totalTokens: true, estimatedCost: true },
    }),
    prisma.aIJob.aggregate({
      where: { status: 'COMPLETED', durationMs: { not: null }, completedAt: { gte: period.start, lte: period.end } },
      _avg: { durationMs: true },
    }),
  ])

  const total     = completed + failed
  const successRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : null

  return {
    module:      'ai',
    collectedAt: new Date(),
    period,
    data: {
      'ai.jobs_completed':   completed,
      'ai.jobs_failed':      failed,
      'ai.jobs_running':     running,
      'ai.jobs_queued':      queued,
      'ai.tokens_total':     (tokenAndCostAgg as any)._sum?.totalTokens     ?? null,
      'ai.cost_total':       (tokenAndCostAgg as any)._sum?.estimatedCost   ?? null,
      'ai.avg_duration_ms':  (durationAgg as any)._avg?.durationMs          ?? null,
      'ai.success_rate':     successRate,
    },
  }
}

export const AI_COLLECTOR: CollectorDefinition = {
  module:  'ai',
  name:    'AI Collector',
  collect,
  metrics: [
    'ai.jobs_completed',
    'ai.jobs_failed',
    'ai.jobs_running',
    'ai.jobs_queued',
    'ai.tokens_total',
    'ai.cost_total',
    'ai.avg_duration_ms',
    'ai.success_rate',
  ],
}
