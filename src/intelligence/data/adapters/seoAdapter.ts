// Reuses SeoService.calculateLocalSeoScore (K29) — no new storage. Uses the
// score directly rather than getPerformanceInsights to avoid recomputing
// rating/CSAT a second time (reviewsAdapter/feedbackAdapter already cover those).
import { calculateLocalSeoScore } from '../../../seo/SeoService'
import type { DataAdapterDefinition, NormalizedMetric } from '../types'

async function fetch(tenantId: string): Promise<NormalizedMetric[]> {
  const seo = await calculateLocalSeoScore(tenantId)
  const computedAt = new Date()

  return [
    { key: 'seo.score', module: 'seo', value: seo.score, tenantId, computedAt },
  ]
}

export const seoAdapter: DataAdapterDefinition = { module: 'seo', name: 'Local SEO Score', fetch }
