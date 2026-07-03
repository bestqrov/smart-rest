// ─── Smart Intelligence Executive Dashboard — DTOs (K55) ───────────────────
// Pure read-only aggregation. Every field is sourced from an already-
// existing function (K35/K36/K52/K53/K54/Analytics) — no recomputation.

export interface ExecutiveKpi {
  metricId: string
  module:   string
  name:     string
  value:    number | null
  unit:     string
  trend?:   number
}

export interface ExecutivePriority {
  source:      'issue' | 'opportunity'
  priority:    string
  title:       string
  description: string
  refId:       string
}

export interface ExecutiveCriticalAlert {
  eventName:  string
  module:     string
  resourceId: string | null
  timestamp:  Date
  message?:   string
}

export interface RecommendationsSummary {
  total:  number
  active: number
  byPriority: Record<string, number>
}

export interface OpportunitiesSummary {
  businessOpportunities:   number
  automationOpportunities: number
  topOpportunityTitles:    string[]
}

export interface ExecutiveTimelineEntry {
  eventName:  string
  module:     string
  resourceId: string | null
  timestamp:  Date
}

export interface ExecutiveDashboard {
  tenantId:        string
  healthScore:     { score: number; label: string }
  kpis:            ExecutiveKpi[]
  topPriorities:   ExecutivePriority[]
  criticalAlerts:  ExecutiveCriticalAlert[]
  recommendations: RecommendationsSummary
  opportunities:   OpportunitiesSummary
  timeline:        ExecutiveTimelineEntry[]
  generatedAt:     Date
}
