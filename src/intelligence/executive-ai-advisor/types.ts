// ─── Smart Intelligence Executive AI Advisor v1 — Contracts (K66) ──────────
// Pure orchestration: aggregates the outputs of six already-built domain
// advisors (K60-K65) plus K53's Business Advisor and K55's Executive
// Dashboard — no new detection/calculation logic, only extraction and
// normalization of fields those modules already computed. Verified no
// dedicated "Sales Advisor" module exists; K52's Business Skills Pack
// (business-insights summary, category "operations"/"growth") is the
// closest existing sales/ops signal source and is reused for that role.

import type { BusinessHealthScore } from '../business-advisor'
import type { ExecutivePriority, ExecutiveCriticalAlert } from '../executive-dashboard'

export type { BusinessHealthScore, ExecutivePriority, ExecutiveCriticalAlert }

export interface AdvisorContribution {
  module:  string
  hasData: boolean
}

export interface CrossModuleOpportunity {
  module:      string
  title:       string
  description: string
}

export interface CrossModuleRisk {
  module:      string
  severity:    'HIGH' | 'MEDIUM'
  title:       string
  description: string
}

export interface ExecutiveActionItem {
  module:   string
  priority: 'URGENT' | 'HIGH' | 'MEDIUM'
  title:    string
}

export interface ExecutiveBriefing {
  tenantId:    string
  healthScore: BusinessHealthScore
  topPriorities: ExecutivePriority[]
  criticalAlerts: ExecutiveCriticalAlert[]
  crossModuleOpportunities: CrossModuleOpportunity[]
  crossModuleRisks: CrossModuleRisk[]
  actionPlan:  ExecutiveActionItem[]
  advisorContributions: AdvisorContribution[]
  generatedAt: Date
}
