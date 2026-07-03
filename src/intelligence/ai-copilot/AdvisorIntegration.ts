// ─── Smart Intelligence AI Chat Copilot Foundation — Advisor Integration (K67-K68) ─
// Grounds the copilot's reply in already-computed advisor data — reuses
// each domain advisor's own getXAdvisorSummary() as-is, no recomputation.
// 'general' intent has no grounding data (small talk / unclassified).
// K68 adds 'executive' (K66's getExecutiveBriefing) and 'sales' (K52's
// getBusinessInsightsSummary, since no dedicated Sales Advisor module
// exists — same substitution K66 already established) plus a
// multi-module fetch built on the same per-intent lookup, not a second
// switch statement.

import { getInventoryAdvisorSummary } from '../inventory-advisor'
import { getCustomerAdvisorSummary } from '../customer-advisor'
import { getMarketingAdvisorSummary } from '../marketing-advisor'
import { getReservationAdvisorSummary } from '../reservation-advisor'
import { getStaffAdvisorSummary } from '../staff-advisor'
import { getFinancialAdvisorSummary } from '../financial-advisor'
import { getUnifiedBusinessSummary } from '../business-advisor'
import { getExecutiveBriefing } from '../executive-ai-advisor'
import { getBusinessInsightsSummary } from '../business-skills'
import type { CopilotIntent } from './types'

// Keeps the prompt small — only a compact JSON snapshot, not the full
// nested advisor summary.
function compact(data: unknown): string {
  return JSON.stringify(data).slice(0, 2000)
}

async function fetchGroundingFor(tenantId: string, intent: CopilotIntent): Promise<string> {
  switch (intent) {
    case 'inventory':   return compact(await getInventoryAdvisorSummary(tenantId))
    case 'customer':    return compact(await getCustomerAdvisorSummary(tenantId))
    case 'marketing':   return compact(await getMarketingAdvisorSummary(tenantId))
    case 'reservation': return compact(await getReservationAdvisorSummary(tenantId))
    case 'staff':       return compact(await getStaffAdvisorSummary(tenantId))
    case 'financial':   return compact(await getFinancialAdvisorSummary(tenantId))
    case 'business':    return compact(await getUnifiedBusinessSummary(tenantId))
    case 'executive':   return compact(await getExecutiveBriefing(tenantId))
    case 'sales':       return compact(await getBusinessInsightsSummary(tenantId))
    case 'general':     return '{}'
    default:            return '{}'
  }
}

// Single-intent grounding, kept for backward compatibility.
export async function getGroundingData(tenantId: string, intent: CopilotIntent): Promise<string> {
  return fetchGroundingFor(tenantId, intent)
}

export interface ModuleGrounding {
  module: CopilotIntent
  data:   string
}

// Multi-module grounding: fetches every requested intent's data in
// parallel via the same fetchGroundingFor lookup — no second switch.
export async function getMultiModuleGrounding(tenantId: string, intents: CopilotIntent[]): Promise<ModuleGrounding[]> {
  const unique = [...new Set(intents)]
  const results = await Promise.all(unique.map(async (module): Promise<ModuleGrounding> => ({
    module, data: await fetchGroundingFor(tenantId, module),
  })))
  return results.filter(r => r.data !== '{}')
}
