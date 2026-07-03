// ─── Smart Intelligence Executive AI Advisor v1 — Action Plan (K66) ────────
// Merges K53's getRecommendedNextActions (already reused, not
// recomputed) with the cross-module risks/opportunities detected above —
// no new prioritization model, just a shared priority mapping.

import { getRecommendedNextActions } from '../business-advisor'
import type { CrossModuleOpportunity, CrossModuleRisk, ExecutiveActionItem } from './types'

const PRIORITY_WEIGHT: Record<ExecutiveActionItem['priority'], number> = { URGENT: 2, HIGH: 1, MEDIUM: 0 }

export async function buildExecutiveActionPlan(
  tenantId: string, risks: CrossModuleRisk[], opportunities: CrossModuleOpportunity[], limit = 5,
): Promise<ExecutiveActionItem[]> {
  const nextActions = await getRecommendedNextActions(tenantId, limit)

  const items: ExecutiveActionItem[] = [
    ...nextActions.map((a): ExecutiveActionItem => ({
      module: 'business', priority: a.priority === 'URGENT' || a.priority === 'HIGH' ? a.priority : 'MEDIUM', title: a.title,
    })),
    ...risks.map((r): ExecutiveActionItem => ({ module: r.module, priority: r.severity === 'HIGH' ? 'URGENT' : 'MEDIUM', title: r.title })),
    ...opportunities.map((o): ExecutiveActionItem => ({ module: o.module, priority: 'MEDIUM', title: o.title })),
  ]

  return items
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, limit)
}
