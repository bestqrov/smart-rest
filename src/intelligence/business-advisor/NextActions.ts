// ─── Business Advisor v1 — Recommended Next Actions (K53) ──────────────────
// Merges the two existing rule-based signals (K36 issues, K35
// opportunities) into one ranked list — no new detection logic here.

import { detectPriorityIssues } from './PriorityIssueDetection'
import { detectOpportunities } from './OpportunityDetection'
import type { RecommendedNextAction } from './types'

const PRIORITY_WEIGHT: Record<RecommendedNextAction['priority'], number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }

function issueSeverityToPriority(severity: string): RecommendedNextAction['priority'] {
  return severity === 'CRITICAL' ? 'URGENT' : 'HIGH'
}

function recommendationPriorityToAction(priority: string): RecommendedNextAction['priority'] {
  if (priority === 'URGENT' || priority === 'HIGH' || priority === 'MEDIUM' || priority === 'LOW') return priority
  return 'MEDIUM'
}

export async function getRecommendedNextActions(tenantId: string, limit = 5): Promise<RecommendedNextAction[]> {
  const [issues, opportunities] = await Promise.all([
    detectPriorityIssues(tenantId, limit),
    detectOpportunities(tenantId, limit),
  ])

  const actions: RecommendedNextAction[] = [
    ...issues.map(i => ({
      source: 'issue' as const, priority: issueSeverityToPriority(i.severity),
      title: i.title, description: i.description, refId: i.id,
    })),
    ...opportunities.map(o => ({
      source: 'opportunity' as const, priority: recommendationPriorityToAction(o.priority),
      title: o.title, description: o.description, refId: o.id,
    })),
  ]

  return actions
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, limit)
}
