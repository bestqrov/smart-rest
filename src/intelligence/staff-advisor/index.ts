// ─── Smart Intelligence Staff Advisor v1 — Public API (K64) ────────────────

export type {
  StaffPerformance, ProductivityScore, WorkloadImbalance, ShiftRecord,
  PeakStaffingGap, OvertimeAlert, AttendanceInsight, TrainingOpportunity,
  StaffingOptimization, StaffAdvisorSummary,
} from './types'

export { computeStaffPerformance, fetchShiftRecords } from './StaffMetrics'
export { analyzeEmployeePerformance } from './EmployeePerformanceAnalysis'
export { scoreProductivity } from './ProductivityScoring'
export { analyzeWorkloadDistribution } from './WorkloadDistributionAnalysis'
export { detectPeakStaffingGaps } from './PeakStaffingDetection'
export { detectOvertimeAlerts } from './OvertimeMonitoring'
export { getAttendanceInsights } from './AttendanceInsights'
export { detectTrainingOpportunities } from './TrainingOpportunityDetection'
export { getStaffingOptimizations } from './StaffingOptimizationRecommendations'
export { staffingOptimizationRecommendationRule } from './StaffRecommendationRule'
export { getStaffAdvisorSummary } from './StaffAdvisorService'
export { registerStaffAdvisorAgent } from './StaffAdvisorAgent'
