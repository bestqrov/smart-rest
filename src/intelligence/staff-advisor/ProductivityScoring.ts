// ─── Smart Intelligence Staff Advisor v1 — Productivity Scoring (K64) ──────
// Rule-based, not ML: score = this staff member's avgOrdersPerHour
// relative to the team average, clamped 0-100. Reuses
// computeStaffPerformance — no new query.

import { computeStaffPerformance } from './StaffMetrics'
import type { ProductivityScore } from './types'

export async function scoreProductivity(tenantId: string, windowDays?: number): Promise<ProductivityScore[]> {
  const performance = await computeStaffPerformance(tenantId, windowDays)
  const rated = performance.filter(p => p.avgOrdersPerHour !== null)
  if (rated.length === 0) return []

  const teamAvg = rated.reduce((sum, p) => sum + p.avgOrdersPerHour!, 0) / rated.length
  if (teamAvg === 0) return []

  return rated
    .map((p): ProductivityScore => ({
      staffId: p.staffId, name: p.name,
      score: Math.min(100, Math.round((p.avgOrdersPerHour! / teamAvg) * 50)),
    }))
    .sort((a, b) => b.score - a.score)
}
