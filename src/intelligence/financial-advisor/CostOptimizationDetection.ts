// ─── Smart Intelligence Financial Advisor v1 — Cost Optimization (K65) ─────
// Pure rule-based transform of ExpenseTrendAnalysis + MarginInsights — no
// new detection.

import { analyzeExpenseTrend } from './ExpenseTrendAnalysis'
import { getMarginInsights } from './MarginInsights'
import type { CostOptimizationOpportunity } from './types'

const RISING_EXPENSE_THRESHOLD_PCT = 25

export async function detectCostOptimizations(tenantId: string): Promise<CostOptimizationOpportunity[]> {
  const [expenseTrend, margins] = await Promise.all([
    analyzeExpenseTrend(tenantId),
    getMarginInsights(tenantId),
  ])

  const opportunities: CostOptimizationOpportunity[] = []

  if (expenseTrend.changePct >= RISING_EXPENSE_THRESHOLD_PCT && expenseTrend.byCategory.length > 0) {
    const top = expenseTrend.byCategory[0]!
    opportunities.push({
      type: 'RISING_EXPENSE_CATEGORY',
      title: `"${top.category}" expenses rising`,
      description: `Overall expenses are up ${expenseTrend.changePct}% — "${top.category}" is the largest category at ${top.total}.`,
    })
  }

  if (margins.lowMarginProducts.length > 0) {
    const worst = margins.lowMarginProducts[0]!
    opportunities.push({
      type: 'LOW_MARGIN_PRODUCT',
      title: `${margins.lowMarginProducts.length} product(s) with low margin`,
      description: `"${worst.productName}" has only ${worst.marginPct}% margin — consider repricing or reducing ingredient cost.`,
    })
  }

  return opportunities
}
