// ─── Smart Intelligence Context Engine — Agent-Facing API (K33) ────────────
// The entry point future AI agents use to get a tenant's context without
// knowing about resolveContext's full request-scoped signature (user/
// request/trace fields agents don't have).

import { resolveContext } from './ContextResolver'
import type { IntelligenceContext } from './types'
import type { PeriodType } from '../../analytics/types'

export async function getContextForTenant(cafeId: string, period?: PeriodType): Promise<IntelligenceContext> {
  return resolveContext({ cafeId, period, source: 'intelligence-agent' })
}
