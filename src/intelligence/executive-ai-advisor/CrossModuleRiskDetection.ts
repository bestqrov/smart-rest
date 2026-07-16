// ─── Smart Intelligence Executive AI Advisor v1 — Cross-Module Risks (K66) ─
// Pure extraction from the already-fetched AdvisorBundle — no new
// detection, no additional query.

import type { AdvisorBundle } from './AdvisorAggregation'
import type { CrossModuleRisk } from './types'

export function detectCrossModuleRisks(bundle: AdvisorBundle): CrossModuleRisk[] {
  const risks: CrossModuleRisk[] = []

  if (bundle.inventory.outOfStockSoon.length > 0) {
    const top = bundle.inventory.outOfStockSoon[0]!
    risks.push({
      module: 'inventory', severity: 'HIGH',
      title: `${bundle.inventory.outOfStockSoon.length} ingredient(s) predicted to run out`,
      description: `"${top.ingredientName}" has ~${top.daysUntilOutOfStock} days of stock left.`,
    })
  }

  if (bundle.customer.segments.churnRisk > 0) {
    risks.push({
      module: 'customer', severity: bundle.customer.segments.churnRisk >= 5 ? 'HIGH' : 'MEDIUM',
      title: `${bundle.customer.segments.churnRisk} customer(s) at churn risk`,
      description: 'Previously-regular customers have gone quiet — a win-back offer could recover them.',
    })
  }

  if (bundle.staff.overtimeAlerts.length > 0) {
    risks.push({
      module: 'staff', severity: 'MEDIUM',
      title: `${bundle.staff.overtimeAlerts.length} staff member(s) trending into overtime`,
      description: `${bundle.staff.overtimeAlerts.map(a => a.name).join(', ')} are averaging 48+ hours/week.`,
    })
  }

  if (bundle.reservation.noShowAnalysis.ratePct >= 20) {
    risks.push({
      module: 'reservation', severity: bundle.reservation.noShowAnalysis.ratePct >= 35 ? 'HIGH' : 'MEDIUM',
      title: 'High reservation no-show rate',
      description: `${bundle.reservation.noShowAnalysis.ratePct}% of reservations are no-shows.`,
    })
  }

  if (bundle.financial.healthScore.breakdown.negativeCashFlowDays > 0) {
    risks.push({
      module: 'financial', severity: bundle.financial.healthScore.breakdown.negativeCashFlowDays >= 10 ? 'HIGH' : 'MEDIUM',
      title: `${bundle.financial.healthScore.breakdown.negativeCashFlowDays} day(s) of negative cash flow`,
      description: `Net cash flow over the tracked window totals ${bundle.financial.cashFlow.netTotal}.`,
    })
  }

  return risks
}
