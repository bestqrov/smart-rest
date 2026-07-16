// ─── Smart Intelligence Financial Advisor v1 — Financial Health Score (K65) ─
// Same "100 minus weighted penalties, floor 0, 4-tier label" idiom as
// K53's BusinessHealthScore — different inputs (finance-specific, not
// K36 insights), reusing CashFlowOverview/MarginInsights/
// ExpenseTrendAnalysis for those inputs rather than a second calculation.

import { getCashFlowOverview } from './CashFlowOverview'
import { getMarginInsights } from './MarginInsights'
import { analyzeExpenseTrend } from './ExpenseTrendAnalysis'
import type { FinancialHealthScore } from './types'

const RISING_EXPENSE_THRESHOLD_PCT = 25

export async function computeFinancialHealthScore(tenantId: string): Promise<FinancialHealthScore> {
  const [cashFlow, margins, expenseTrend] = await Promise.all([
    getCashFlowOverview(tenantId),
    getMarginInsights(tenantId),
    analyzeExpenseTrend(tenantId),
  ])

  const negativeCashFlowDays = cashFlow.negativeDays
  const lowMarginProducts = margins.lowMarginProducts.length
  const risingExpenseCategories = expenseTrend.changePct >= RISING_EXPENSE_THRESHOLD_PCT ? 1 : 0

  const score = Math.max(0, 100 - negativeCashFlowDays * 3 - lowMarginProducts * 5 - risingExpenseCategories * 15)

  const label: FinancialHealthScore['label'] =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention'

  return { score, label, breakdown: { negativeCashFlowDays, lowMarginProducts, risingExpenseCategories } }
}
