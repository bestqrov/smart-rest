// ─── Smart Intelligence Staff Advisor v1 — Workload Distribution (K64) ─────
// Rule-based: flags staff whose hours deviate significantly from the team
// average. Reuses computeStaffPerformance — no new query.

import { computeStaffPerformance } from './StaffMetrics'
import type { WorkloadImbalance } from './types'

const DEVIATION_THRESHOLD_PCT = 30

export async function analyzeWorkloadDistribution(tenantId: string, windowDays?: number): Promise<WorkloadImbalance[]> {
  const performance = await computeStaffPerformance(tenantId, windowDays)
  const withHours = performance.filter(p => p.totalHours > 0)
  if (withHours.length === 0) return []

  const avgHours = withHours.reduce((sum, p) => sum + p.totalHours, 0) / withHours.length
  if (avgHours === 0) return []

  return withHours
    .map((p): WorkloadImbalance => ({
      staffId: p.staffId, name: p.name, totalHours: p.totalHours, closedOrders: p.closedOrders,
      deviationPct: Math.round(((p.totalHours - avgHours) / avgHours) * 100),
    }))
    .filter(w => Math.abs(w.deviationPct) >= DEVIATION_THRESHOLD_PCT)
    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
}
