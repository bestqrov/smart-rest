// ─── Smart Intelligence Staff Advisor v1 — Training Opportunities (K64) ────
// Rule-based: staff performing well below the team average avgOrdersPerHour
// with meaningful hours logged. Reuses computeStaffPerformance — no new
// query.

import { computeStaffPerformance } from './StaffMetrics'
import type { TrainingOpportunity } from './types'

const MIN_HOURS_TO_ASSESS = 10
const BELOW_AVERAGE_RATIO = 0.6

export async function detectTrainingOpportunities(tenantId: string, windowDays?: number): Promise<TrainingOpportunity[]> {
  const performance = await computeStaffPerformance(tenantId, windowDays)
  const rated = performance.filter(p => p.avgOrdersPerHour !== null && p.totalHours >= MIN_HOURS_TO_ASSESS)
  if (rated.length === 0) return []

  const teamAvg = rated.reduce((sum, p) => sum + p.avgOrdersPerHour!, 0) / rated.length
  if (teamAvg === 0) return []

  return rated
    .filter(p => p.avgOrdersPerHour! < teamAvg * BELOW_AVERAGE_RATIO)
    .map((p): TrainingOpportunity => ({
      staffId: p.staffId, name: p.name,
      avgOrdersPerHour: p.avgOrdersPerHour!, teamAvgOrdersPerHour: Math.round(teamAvg * 100) / 100,
    }))
    .sort((a, b) => a.avgOrdersPerHour - b.avgOrdersPerHour)
}
