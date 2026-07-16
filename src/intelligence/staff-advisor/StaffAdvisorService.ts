// ─── Smart Intelligence Staff Advisor v1 — Service (K64) ───────────────────
// Combines every detector above into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { analyzeEmployeePerformance } from './EmployeePerformanceAnalysis'
import { scoreProductivity } from './ProductivityScoring'
import { analyzeWorkloadDistribution } from './WorkloadDistributionAnalysis'
import { detectPeakStaffingGaps } from './PeakStaffingDetection'
import { detectOvertimeAlerts } from './OvertimeMonitoring'
import { getAttendanceInsights } from './AttendanceInsights'
import { detectTrainingOpportunities } from './TrainingOpportunityDetection'
import { getStaffingOptimizations } from './StaffingOptimizationRecommendations'
import type { StaffAdvisorSummary } from './types'

const NAMESPACE = 'staff-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Staff Advisor summaries',
  })
}

export async function getStaffAdvisorSummary(tenantId: string): Promise<StaffAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as StaffAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [performance, productivityScores, workloadImbalances, peakStaffingGaps, overtimeAlerts, attendanceInsights, trainingOpportunities, optimizations] = await Promise.all([
    analyzeEmployeePerformance(tenantId),
    scoreProductivity(tenantId),
    analyzeWorkloadDistribution(tenantId),
    detectPeakStaffingGaps(tenantId),
    detectOvertimeAlerts(tenantId),
    getAttendanceInsights(tenantId),
    detectTrainingOpportunities(tenantId),
    getStaffingOptimizations(tenantId),
  ])

  const summary: StaffAdvisorSummary = {
    tenantId, performance, productivityScores, workloadImbalances, peakStaffingGaps,
    overtimeAlerts, attendanceInsights, trainingOpportunities, optimizations, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
