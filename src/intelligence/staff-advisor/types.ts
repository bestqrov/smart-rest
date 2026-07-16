// ─── Smart Intelligence Staff Advisor v1 — Contracts (K64) ─────────────────
// Rule-based only, no LLM. Verified src/routes/adminWaitersPerf.ts already
// computes per-waiter closedOrders/totalRevenue/totalHours/
// avgOrdersPerHour (WaiterShift hours + Order revenue via
// assignedWaiterId) — that logic isn't exported for reuse (it's inline in
// a route handler), so StaffMetrics.ts mirrors the same formula/fields
// rather than inventing a different one, and every detector below reuses
// that single computation. Verified K52's staffInsightRule already flags
// orders-per-on-duty-staff overload reactively off PosOrderClosed — this
// module's WorkloadDistributionAnalysis/PeakStaffingDetection compute a
// richer per-staff/per-hour breakdown from a separate shared shift-record
// query, not a second identical on-duty-count check.

export interface StaffPerformance {
  staffId:          string
  name:             string
  role:             string
  closedOrders:     number
  totalRevenue:     number
  totalHours:       number
  avgOrdersPerHour: number | null
}

export interface ProductivityScore {
  staffId: string
  name:    string
  score:   number   // 0-100, relative to team average avgOrdersPerHour
}

export interface WorkloadImbalance {
  staffId:     string
  name:        string
  totalHours:  number
  closedOrders: number
  deviationPct: number   // vs team average hours, positive = overloaded
}

export interface ShiftRecord {
  staffId: string
  start:   Date
  end:     Date
}

export interface PeakStaffingGap {
  hour:           number   // 0-23 UTC
  orderCount:     number
  staffOnDuty:    number
  ordersPerStaff: number
}

export interface OvertimeAlert {
  staffId:   string
  name:      string
  weekHours: number
}

export interface AttendanceInsight {
  staffId:      string
  name:         string
  shiftsWorked: number
  avgShiftHours: number
}

export interface TrainingOpportunity {
  staffId: string
  name:    string
  avgOrdersPerHour: number
  teamAvgOrdersPerHour: number
}

export interface StaffingOptimization {
  type:        'ADD_STAFF' | 'REDUCE_OVERTIME' | 'REBALANCE_WORKLOAD' | 'TRAINING'
  title:       string
  description: string
}

export interface StaffAdvisorSummary {
  tenantId:            string
  performance:         StaffPerformance[]
  productivityScores:  ProductivityScore[]
  workloadImbalances:  WorkloadImbalance[]
  peakStaffingGaps:    PeakStaffingGap[]
  overtimeAlerts:      OvertimeAlert[]
  attendanceInsights:  AttendanceInsight[]
  trainingOpportunities: TrainingOpportunity[]
  optimizations:       StaffingOptimization[]
  generatedAt:         Date
}
