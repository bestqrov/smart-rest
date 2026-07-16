// ─── Smart Intelligence AI Readiness — Context Completeness (K58) ──────────
// Reuses K33's getContextForTenant directly — no new context fetching.

import { getContextForTenant } from '../context'
import type { ContextCompletenessResult } from './types'

const REQUIRED_FIELD_COUNT = 4

export async function checkContextCompleteness(tenantId: string): Promise<ContextCompletenessResult> {
  const context = await getContextForTenant(tenantId)
  const missingFields: string[] = []

  if (!context.business.name)    missingFields.push('business.name')
  if (!context.business.country) missingFields.push('business.country')
  if (!context.tenant.plan)      missingFields.push('tenant.plan')
  if (!context.tenant.state)     missingFields.push('tenant.state')

  const completenessPct = Math.round(((REQUIRED_FIELD_COUNT - missingFields.length) / REQUIRED_FIELD_COUNT) * 100)

  return {
    ready: missingFields.length === 0, missingFields, completenessPct,
    reasons: missingFields.map(f => `missing context field: ${f}`),
  }
}
