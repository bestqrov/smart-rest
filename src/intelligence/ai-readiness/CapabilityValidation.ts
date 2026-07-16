// ─── Smart Intelligence AI Readiness — Capability Validation (K58) ─────────
// Reuses K33's Context Engine (TenantContext.features, itself sourced from
// the existing Plan/PlanFeatures system) — no new plan/feature lookup.
// Distinct from ProviderAvailability's provider/model existence checks:
// this asks "is this tenant even entitled to AI features."

import { getContextForTenant } from '../context'
import type { AICapabilityValidationResult } from './types'

export async function checkAICapability(tenantId: string): Promise<AICapabilityValidationResult> {
  const context = await getContextForTenant(tenantId)
  const reasons: string[] = []

  if (!context.tenant.features.aiCenter) {
    reasons.push(`tenant plan "${context.tenant.plan}" does not include the aiCenter feature`)
  }
  if (context.tenant.state === 'SUSPENDED' || context.tenant.state === 'CANCELLED') {
    reasons.push(`tenant state is "${context.tenant.state}"`)
  }

  return { ready: reasons.length === 0, reasons }
}
