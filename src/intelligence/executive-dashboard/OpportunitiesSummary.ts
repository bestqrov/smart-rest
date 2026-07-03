// ─── Smart Intelligence Executive Dashboard — Opportunities Summary (K55) ──
// Reuses K53's detectOpportunities and K54's detectAutomationOpportunities
// directly — no second opportunity scan.

import { detectOpportunities } from '../business-advisor'
import { detectAutomationOpportunities } from '../automation-advisor'
import type { OpportunitiesSummary } from './types'

export async function getOpportunitiesSummary(tenantId: string): Promise<OpportunitiesSummary> {
  const [business, automation] = await Promise.all([
    detectOpportunities(tenantId),
    detectAutomationOpportunities(tenantId),
  ])

  return {
    businessOpportunities:   business.length,
    automationOpportunities: automation.length,
    topOpportunityTitles:    business.slice(0, 3).map(o => o.title),
  }
}
