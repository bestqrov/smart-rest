// Reuses FeedbackService.getSatisfactionScore (K23) — no new storage.
import { getSatisfactionScore } from '../../../feedback/FeedbackService'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const score = await getSatisfactionScore(tenantId)
  const computedAt = new Date()

  return [
    { key: 'feedback.total',     module: 'feedback', value: score.total,     tenantId, computedAt },
    { key: 'feedback.satisfied', module: 'feedback', value: score.satisfied, tenantId, computedAt },
    { key: 'feedback.csat',      module: 'feedback', value: score.csat,      unit: '%', tenantId, computedAt },
  ]
}

export const feedbackAdapter: DataAdapterDefinition = { module: 'feedback', name: 'Customer Satisfaction', fetch }
