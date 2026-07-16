// ─── Smart Intelligence Business Advisor v1 — Contracts (K53) ──────────────
// Fills in K46's Foundation with real content. K46's AgentEventHandler
// still returns void (unchanged, no refactor) — this module's actual
// output is delivered by direct function calls (getUnifiedBusinessSummary
// et al.), not through AdvisorResponse.content. Rule-based only, no LLM.

export interface BusinessHealthScore {
  score:     number     // 0-100
  label:     'Excellent' | 'Good' | 'Fair' | 'Needs Attention'
  breakdown: { criticalIssues: number; warningIssues: number; infoIssues: number }
}

export interface PriorityIssue {
  id:          string
  category:    string
  severity:    string
  title:       string
  description: string
  createdAt:   Date
}

export interface BusinessOpportunity {
  id:          string
  category:    string
  priority:    string
  title:       string
  description: string
  score:       number
}

export type NextActionSource = 'issue' | 'opportunity'

export interface RecommendedNextAction {
  source:      NextActionSource
  priority:    'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
  title:       string
  description: string
  refId:       string
}

export interface UnifiedBusinessSummary {
  tenantId:      string
  healthScore:   BusinessHealthScore
  issues:        PriorityIssue[]
  opportunities: BusinessOpportunity[]
  nextActions:   RecommendedNextAction[]
  generatedAt:   Date
}
