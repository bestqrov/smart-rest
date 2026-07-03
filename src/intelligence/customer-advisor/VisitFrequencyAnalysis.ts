// ─── Smart Intelligence Customer Advisor v1 — Visit Frequency Analysis (K61) ─
// Rule-based bucketing over the same computeCustomerMetrics window — no
// new calculation.

import { computeCustomerMetrics } from './CustomerMetrics'
import type { VisitFrequencyBucket } from './types'

function bucketFor(orderCount: number, windowDays: number): VisitFrequencyBucket['bucket'] {
  const perMonth = orderCount / (windowDays / 30)
  if (perMonth >= 4) return 'FREQUENT'
  if (perMonth >= 1) return 'REGULAR'
  if (perMonth > 0)  return 'OCCASIONAL'
  return 'RARE'
}

export async function analyzeVisitFrequency(tenantId: string, windowDays = 90): Promise<VisitFrequencyBucket[]> {
  const metrics = await computeCustomerMetrics(tenantId, windowDays)

  const counts: Record<VisitFrequencyBucket['bucket'], number> = { FREQUENT: 0, REGULAR: 0, OCCASIONAL: 0, RARE: 0 }
  for (const m of metrics) {
    counts[bucketFor(m.orderCount, windowDays)] += 1
  }

  return (Object.keys(counts) as VisitFrequencyBucket['bucket'][]).map(bucket => ({ bucket, count: counts[bucket] }))
}
