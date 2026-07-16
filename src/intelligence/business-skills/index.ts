// ─── Smart Intelligence Business Skills Pack v1 — Public API (K52) ─────────
// The first business-content sprint on top of the Foundation-only K30-K51
// infrastructure: seven rule-based (no LLM) Insight Engine (K36)
// registrations plus a dashboard summary reusing K36's own listInsights.
// Same "registerBuiltin*" idiom as K32's registerBuiltinDataAdapters /
// K42's registerBuiltinModels.

import { registerInsightRule } from '../insights'
import { salesInsightRule } from './SalesInsightRule'
import { revenueInsightRule } from './RevenueInsightRule'
import { customerInsightRule } from './CustomerInsightRule'
import { inventoryInsightRule } from './InventoryInsightRule'
import { reservationInsightRule } from './ReservationInsightRule'
import { staffInsightRule } from './StaffInsightRule'
import { reviewInsightRule } from './ReviewInsightRule'

const BUILTIN_BUSINESS_INSIGHT_RULES = [
  salesInsightRule, revenueInsightRule, customerInsightRule, inventoryInsightRule,
  reservationInsightRule, staffInsightRule, reviewInsightRule,
]

export function registerBusinessSkillsPack(): void {
  for (const rule of BUILTIN_BUSINESS_INSIGHT_RULES) {
    registerInsightRule(rule)
  }
}

export {
  salesInsightRule, revenueInsightRule, customerInsightRule, inventoryInsightRule,
  reservationInsightRule, staffInsightRule, reviewInsightRule,
}
export { getBusinessInsightsSummary, type BusinessInsightsSummary } from './DashboardSummary'
