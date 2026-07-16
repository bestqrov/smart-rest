// ─── Smart Intelligence Executive Dashboard — Recommendations Summary (K55) ─
// Reuses K35's listRecommendations directly — no second count query.

import { listRecommendations } from '../recommendations'
import type { RecommendationsSummary } from './types'

export async function getRecommendationsSummary(tenantId: string): Promise<RecommendationsSummary> {
  const recommendations = await listRecommendations(tenantId)
  const active = recommendations.filter(r => r.status === 'NEW' || r.status === 'ACTIVE')

  const byPriority: Record<string, number> = {}
  for (const r of active) {
    byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1
  }

  return { total: recommendations.length, active: active.length, byPriority }
}
