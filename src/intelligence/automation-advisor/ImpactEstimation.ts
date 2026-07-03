// ─── Smart Intelligence Automation Advisor — Impact Estimation (K54) ───────
// Rough, advisory arithmetic over the same recurrence data — no new
// tracking, no ML forecast.

import type { AutomationImpactEstimate, AutomationOpportunity } from './types'

const ASSUMED_MINUTES_PER_OCCURRENCE = 10

export function estimateAutomationImpact(opportunity: AutomationOpportunity): AutomationImpactEstimate {
  const monthlyOccurrences = Math.round((opportunity.occurrences / opportunity.windowDays) * 30)

  return {
    opportunity,
    estimatedMonthlyOccurrences: monthlyOccurrences,
    estimatedManualEffortMinutes: monthlyOccurrences * ASSUMED_MINUTES_PER_OCCURRENCE,
  }
}
