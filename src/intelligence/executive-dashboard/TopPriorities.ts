// ─── Smart Intelligence Executive Dashboard — Top Priorities (K55) ─────────
// Reuses K53's getRecommendedNextActions as-is — its RecommendedNextAction
// shape already matches ExecutivePriority field-for-field, no adapter logic.

import { getRecommendedNextActions } from '../business-advisor'
import type { ExecutivePriority } from './types'

export async function getTopPriorities(tenantId: string, limit = 5): Promise<ExecutivePriority[]> {
  return getRecommendedNextActions(tenantId, limit)
}
