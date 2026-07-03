// ─── Smart Intelligence Reservation Advisor v1 — Service (K63) ─────────────
// Combines every detector above into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { analyzeReservationTrend } from './TrendAnalysis'
import { predictPeakSlots } from './PeakPrediction'
import { detectLowOccupancySlots } from './LowOccupancyDetection'
import { analyzeNoShows } from './NoShowAnalysis'
import { analyzeCancellations } from './CancellationAnalysis'
import { getTableUtilization } from './UtilizationInsights'
import { getReservationOptimizations } from './OptimizationRecommendations'
import type { ReservationAdvisorSummary } from './types'

const NAMESPACE = 'reservation-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Reservation Advisor summaries',
  })
}

export async function getReservationAdvisorSummary(tenantId: string): Promise<ReservationAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as ReservationAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [trend, peakPredictions, lowOccupancySlots, noShowAnalysis, cancellationAnalysis, utilization, optimizations] = await Promise.all([
    analyzeReservationTrend(tenantId),
    predictPeakSlots(tenantId),
    detectLowOccupancySlots(tenantId),
    analyzeNoShows(tenantId),
    analyzeCancellations(tenantId),
    getTableUtilization(tenantId),
    getReservationOptimizations(tenantId),
  ])

  const summary: ReservationAdvisorSummary = {
    tenantId, trend, peakPredictions, lowOccupancySlots, noShowAnalysis,
    cancellationAnalysis, utilization, optimizations, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
