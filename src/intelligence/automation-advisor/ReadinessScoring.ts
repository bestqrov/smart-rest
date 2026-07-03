// ─── Smart Intelligence Automation Advisor — Readiness Scoring (K54) ───────
// Reuses K37's Action Executor Registry directly — readiness reflects how
// much automation machinery already exists, not a new capability model.

import { getAllActionExecutors } from '../actions'
import { detectAutomationOpportunities } from './OpportunityDetection'
import type { AutomationReadinessScore } from './types'

export async function computeAutomationReadinessScore(tenantId: string): Promise<AutomationReadinessScore> {
  const executors    = getAllActionExecutors()
  const opportunities = await detectAutomationOpportunities(tenantId)

  const executorScore    = Math.min(50, executors.length * 10)
  const opportunityScore = Math.min(50, opportunities.length * 10)
  const score = executorScore + opportunityScore

  const label: AutomationReadinessScore['label'] =
    score >= 60 ? 'Ready' : score >= 25 ? 'Partial' : 'Not Ready'

  return {
    score, label,
    registeredExecutors:   executors.length,
    detectedOpportunities: opportunities.length,
  }
}
