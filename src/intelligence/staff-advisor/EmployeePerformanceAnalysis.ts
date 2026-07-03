// ─── Smart Intelligence Staff Advisor v1 — Employee Performance (K64) ──────
// Reuses computeStaffPerformance directly — no new query.

import { computeStaffPerformance } from './StaffMetrics'
import type { StaffPerformance } from './types'

export async function analyzeEmployeePerformance(tenantId: string, windowDays?: number): Promise<StaffPerformance[]> {
  const performance = await computeStaffPerformance(tenantId, windowDays)
  return [...performance].sort((a, b) => b.totalRevenue - a.totalRevenue)
}
