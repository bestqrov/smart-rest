// ─── Smart Intelligence Automation Advisor — Recommendation Engine (K54) ───
// Rule-based, no LLM: maps each detected opportunity (recurrence data) to
// a human-readable proposal. No new detection logic — reuses
// detectAutomationOpportunities as-is.

import { detectAutomationOpportunities } from './OpportunityDetection'
import type { AutomationRecommendation } from './types'

export async function generateAutomationRecommendations(tenantId: string): Promise<AutomationRecommendation[]> {
  const opportunities = await detectAutomationOpportunities(tenantId)

  return opportunities.map(opportunity => ({
    opportunity,
    suggestion: `Consider an automated Action for "${opportunity.ruleId}" (${opportunity.category}) — it recurred ${opportunity.occurrences} times in ${opportunity.windowDays} days.`,
    confidence: Math.min(1, opportunity.occurrences / 10),
  }))
}
