// ─── Smart Intelligence AI Chat Copilot Foundation — Advisor Integration (K67) ─
// Grounds the copilot's reply in already-computed advisor data — reuses
// each domain advisor's own getXAdvisorSummary() as-is, no recomputation.
// 'general' intent has no grounding data (small talk / unclassified).

import { getInventoryAdvisorSummary } from '../inventory-advisor'
import { getCustomerAdvisorSummary } from '../customer-advisor'
import { getMarketingAdvisorSummary } from '../marketing-advisor'
import { getReservationAdvisorSummary } from '../reservation-advisor'
import { getStaffAdvisorSummary } from '../staff-advisor'
import { getFinancialAdvisorSummary } from '../financial-advisor'
import { getUnifiedBusinessSummary } from '../business-advisor'
import type { CopilotIntent } from './types'

// Keeps the prompt small — only a compact JSON snapshot, not the full
// nested advisor summary.
function compact(data: unknown): string {
  return JSON.stringify(data).slice(0, 2000)
}

export async function getGroundingData(tenantId: string, intent: CopilotIntent): Promise<string> {
  switch (intent) {
    case 'inventory':   return compact(await getInventoryAdvisorSummary(tenantId))
    case 'customer':    return compact(await getCustomerAdvisorSummary(tenantId))
    case 'marketing':   return compact(await getMarketingAdvisorSummary(tenantId))
    case 'reservation': return compact(await getReservationAdvisorSummary(tenantId))
    case 'staff':       return compact(await getStaffAdvisorSummary(tenantId))
    case 'financial':   return compact(await getFinancialAdvisorSummary(tenantId))
    case 'business':    return compact(await getUnifiedBusinessSummary(tenantId))
    case 'general':     return '{}'
    default:            return '{}'
  }
}
