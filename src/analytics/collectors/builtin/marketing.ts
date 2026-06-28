import type { CollectorDefinition, CollectedData, Period } from '../../types'

async function collect(period: Period): Promise<CollectedData> {
  const { default: prisma } = await import('../../../prisma')

  const periodFilter = { createdAt: { gte: period.start, lte: period.end } }

  const [total, completed, failed] = await Promise.all([
    prisma.marketingCampaign.count({ where: periodFilter }),
    prisma.marketingCampaign.count({ where: { ...periodFilter, status: 'published' } }),
    prisma.marketingCampaign.count({ where: { ...periodFilter, status: 'failed' } }),
  ])

  const successRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : null

  return {
    module:      'marketing',
    collectedAt: new Date(),
    period,
    data: {
      'marketing.campaigns_total':     total,
      'marketing.campaigns_completed': completed,
      'marketing.campaigns_failed':    failed,
      'marketing.success_rate':        successRate,
    },
  }
}

export const MARKETING_COLLECTOR: CollectorDefinition = {
  module:  'marketing',
  name:    'Marketing Collector',
  collect,
  metrics: [
    'marketing.campaigns_total',
    'marketing.campaigns_completed',
    'marketing.campaigns_failed',
    'marketing.success_rate',
  ],
}
