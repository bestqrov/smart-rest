// Reuses ReviewService.getRatingAnalytics (K21) — no new storage.
import { getRatingAnalytics } from '../../../reviews/ReviewService'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const analytics = await getRatingAnalytics(tenantId)
  const computedAt = new Date()

  return [
    { key: 'reviews.count',          module: 'reviews', value: analytics.count,          tenantId, computedAt },
    { key: 'reviews.averageRating',  module: 'reviews', value: analytics.averageRating,  tenantId, computedAt },
  ]
}

export const reviewsAdapter: DataAdapterDefinition = { module: 'reviews', name: 'Review Ratings', fetch }
