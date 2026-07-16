// ─── Smart Intelligence Staff Advisor v1 — Staffing Optimization (K64) ─────
// Pure rule-based transform of the detectors above — no new detection.

import { detectPeakStaffingGaps } from './PeakStaffingDetection'
import { detectOvertimeAlerts } from './OvertimeMonitoring'
import { analyzeWorkloadDistribution } from './WorkloadDistributionAnalysis'
import { detectTrainingOpportunities } from './TrainingOpportunityDetection'
import type { StaffingOptimization } from './types'

export async function getStaffingOptimizations(tenantId: string): Promise<StaffingOptimization[]> {
  const [peakGaps, overtime, imbalances, training] = await Promise.all([
    detectPeakStaffingGaps(tenantId),
    detectOvertimeAlerts(tenantId),
    analyzeWorkloadDistribution(tenantId),
    detectTrainingOpportunities(tenantId),
  ])

  const optimizations: StaffingOptimization[] = []

  if (peakGaps.length > 0) {
    const gap = peakGaps[0]!
    optimizations.push({
      type: 'ADD_STAFF',
      title: `Add staff coverage around ${gap.hour}:00`,
      description: `${gap.orderCount} orders handled by ~${gap.staffOnDuty} staff instance(s) that hour — consider scheduling more coverage.`,
    })
  }

  if (overtime.length > 0) {
    optimizations.push({
      type: 'REDUCE_OVERTIME',
      title: `${overtime.length} staff member(s) trending into overtime`,
      description: `${overtime.map(o => o.name).join(', ')} are averaging 48+ hours/week — consider redistributing shifts.`,
    })
  }

  if (imbalances.length > 0) {
    optimizations.push({
      type: 'REBALANCE_WORKLOAD',
      title: 'Rebalance staff workload',
      description: `${imbalances.length} staff member(s) have hours significantly above or below the team average.`,
    })
  }

  if (training.length > 0) {
    optimizations.push({
      type: 'TRAINING',
      title: `${training.length} staff member(s) may benefit from training`,
      description: `Order throughput is well below the team average for these staff — consider pairing with a top performer.`,
    })
  }

  return optimizations
}
