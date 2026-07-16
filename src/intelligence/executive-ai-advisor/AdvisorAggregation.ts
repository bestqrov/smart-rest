// ─── Smart Intelligence Executive AI Advisor v1 — Advisor Aggregation (K66) ─
// The single fetch of every domain advisor's own summary — every detector
// below reuses this bundle instead of calling each advisor a second time.
// No recomputation: each call is the advisor module's own public
// getXAdvisorSummary(), already cached by that module's own K44 Memory
// Engine namespace.

import { getBusinessInsightsSummary, type BusinessInsightsSummary } from '../business-skills'
import { getInventoryAdvisorSummary, type InventoryAdvisorSummary } from '../inventory-advisor'
import { getCustomerAdvisorSummary, type CustomerAdvisorSummary } from '../customer-advisor'
import { getMarketingAdvisorSummary, type MarketingAdvisorSummary } from '../marketing-advisor'
import { getReservationAdvisorSummary, type ReservationAdvisorSummary } from '../reservation-advisor'
import { getStaffAdvisorSummary, type StaffAdvisorSummary } from '../staff-advisor'
import { getFinancialAdvisorSummary, type FinancialAdvisorSummary } from '../financial-advisor'
import type { AdvisorContribution } from './types'

export interface AdvisorBundle {
  sales:       BusinessInsightsSummary   // no dedicated Sales Advisor exists — K52's Business Skills Pack fills that role
  inventory:   InventoryAdvisorSummary
  customer:    CustomerAdvisorSummary
  marketing:   MarketingAdvisorSummary
  reservation: ReservationAdvisorSummary
  staff:       StaffAdvisorSummary
  financial:   FinancialAdvisorSummary
}

export async function fetchAdvisorBundle(tenantId: string): Promise<AdvisorBundle> {
  const [sales, inventory, customer, marketing, reservation, staff, financial] = await Promise.all([
    getBusinessInsightsSummary(tenantId),
    getInventoryAdvisorSummary(tenantId),
    getCustomerAdvisorSummary(tenantId),
    getMarketingAdvisorSummary(tenantId),
    getReservationAdvisorSummary(tenantId),
    getStaffAdvisorSummary(tenantId),
    getFinancialAdvisorSummary(tenantId),
  ])

  return { sales, inventory, customer, marketing, reservation, staff, financial }
}

export function getAdvisorContributions(bundle: AdvisorBundle): AdvisorContribution[] {
  return [
    { module: 'sales',       hasData: bundle.sales.totalOpen > 0 },
    { module: 'inventory',   hasData: bundle.inventory.lowStockItems > 0 || bundle.inventory.reorderSuggestions.length > 0 },
    { module: 'customer',    hasData: bundle.customer.segments.totalCustomers > 0 },
    { module: 'marketing',   hasData: bundle.marketing.campaigns.total > 0 || bundle.marketing.email.sent > 0 || bundle.marketing.whatsapp.sent > 0 },
    { module: 'reservation', hasData: bundle.reservation.noShowAnalysis.total > 0 },
    { module: 'staff',       hasData: bundle.staff.performance.length > 0 },
    { module: 'financial',   hasData: bundle.financial.revenueTrend.recentTotal > 0 || bundle.financial.revenueTrend.priorTotal > 0 },
  ]
}
