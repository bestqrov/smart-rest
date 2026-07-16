// ─── Smart Intelligence Marketing Advisor v1 — Audience Targeting (K62) ────
// Reuses K61's identifyVipCustomers and detectNewCustomers directly — no
// new segmentation logic.

import { identifyVipCustomers, detectNewCustomers } from '../customer-advisor'
import type { AudienceTargetSuggestion } from './types'

export async function getAudienceTargetSuggestions(tenantId: string): Promise<AudienceTargetSuggestion[]> {
  const [vip, newCustomers] = await Promise.all([
    identifyVipCustomers(tenantId),
    detectNewCustomers(tenantId),
  ])

  const suggestions: AudienceTargetSuggestion[] = []

  if (vip.length > 0) {
    suggestions.push({
      segment: 'VIP', count: vip.length,
      suggestion: `Target your ${vip.length} VIP customer(s) with an exclusive/early-access offer.`,
    })
  }

  if (newCustomers.length > 0) {
    suggestions.push({
      segment: 'NEW', count: newCustomers.length,
      suggestion: `Send a welcome series to your ${newCustomers.length} new customer(s) to encourage a second visit.`,
    })
  }

  return suggestions
}
