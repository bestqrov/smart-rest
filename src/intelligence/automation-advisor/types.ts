// ─── Smart Intelligence Automation Advisor — Contracts (K54) ───────────────
// Advisory only: nothing here executes an action or approves a decision.
// "Automating" a detected pattern is always a human's explicit two-step —
// proposeAutomationForApproval() (this module) then K38's existing
// approveDecision()/executeDecision() (unchanged) — the same "never
// auto-execute" boundary K37/K38 already enforce on every other caller.

export interface AutomationOpportunity {
  ruleId:      string    // the K36 Insight rule (or other source) whose recurrence was detected
  category:    string
  occurrences: number
  windowDays:  number
  description: string
  severities:  string[]  // distinct severities observed across occurrences
}

export interface AutomationRecommendation {
  opportunity: AutomationOpportunity
  suggestion:  string      // human-readable proposal, e.g. "Auto-create a reorder action when this recurs"
  confidence:  number      // 0-1, occurrence-based
}

export interface AutomationReadinessScore {
  score:              number   // 0-100
  label:              'Ready' | 'Partial' | 'Not Ready'
  registeredExecutors: number  // K37 ActionExecutorDefinition count
  detectedOpportunities: number
}

export interface AutomationActionPlanStep {
  order:       number
  description: string
}

export interface AutomationActionPlan {
  opportunity: AutomationOpportunity
  steps:       AutomationActionPlanStep[]
}

export interface AutomationImpactEstimate {
  opportunity:            AutomationOpportunity
  estimatedMonthlyOccurrences: number
  estimatedManualEffortMinutes: number   // rough, 10min/occurrence assumption, advisory only
}

export interface PendingAutomationDecision {
  id:        string
  category:  string
  title:     string
  status:    string
  createdAt: Date
}

export interface AutomationAdvisorSummary {
  tenantId:       string
  readiness:      AutomationReadinessScore
  opportunities:  AutomationOpportunity[]
  recommendations: AutomationRecommendation[]
  pendingApprovals: PendingAutomationDecision[]
  generatedAt:    Date
}
