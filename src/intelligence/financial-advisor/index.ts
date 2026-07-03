// ─── Smart Intelligence Financial Advisor v1 — Public API (K65) ────────────

export type {
  RevenueTrend, ProfitEstimate, ExpenseCategoryTotal, ExpenseTrend, CashFlowDay,
  CashFlowOverview, AverageOrderValue, ProductMargin, MarginInsights,
  CostOptimizationOpportunity, FinancialHealthScore, FinancialAdvisorSummary,
} from './types'

export { fetchRevenue, fetchExpenses, type RevenueRow, type ExpenseRow } from './FinancialMetrics'
export { analyzeRevenueTrend } from './RevenueAnalysis'
export { estimateProfit } from './ProfitEstimation'
export { analyzeExpenseTrend } from './ExpenseTrendAnalysis'
export { getCashFlowOverview } from './CashFlowOverview'
export { getAverageOrderValue } from './AverageOrderValueAnalysis'
export { getMarginInsights } from './MarginInsights'
export { detectCostOptimizations } from './CostOptimizationDetection'
export { computeFinancialHealthScore } from './FinancialHealthScore'
export { financialOptimizationRecommendationRule } from './FinancialRecommendationRule'
export { getFinancialAdvisorSummary } from './FinancialAdvisorService'
export { registerFinancialAdvisorAgent } from './FinancialAdvisorAgent'
