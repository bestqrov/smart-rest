// ─── Smart Intelligence Financial Advisor v1 — Contracts (K65) ─────────────
// Rule-based only, no LLM. Verified adminStats.ts/adminExpenses.ts already
// compute revenue/margin/cash-flow views, but all inline in route
// handlers (not exported) and using three different, inconsistent
// "is this order revenue" filters across the codebase (isPaid,
// status='COMPLETED', billStatus in [CLOSED_PRINTED, CLOSED_VIRTUAL]).
// This module picks ONE convention — isPaid: true — the same one K52's
// RevenueInsightRule already uses, for consistency within the
// Intelligence module. computeCafeAOV (services/billing.ts) IS exported
// and tenant-scoped, so AverageOrderValueAnalysis wraps it directly
// rather than recomputing AOV a second way.

export interface RevenueTrend {
  windowDays:  number
  recentTotal: number
  priorTotal:  number
  changePct:   number
  dailyTotals: { date: string; total: number }[]
}

export interface ProfitEstimate {
  windowDays:      number
  totalRevenue:    number
  totalExpenses:   number
  estimatedProfit: number
  profitMarginPct: number
}

export interface ExpenseCategoryTotal {
  category: string
  total:    number
}

export interface ExpenseTrend {
  windowDays:  number
  recentTotal: number
  priorTotal:  number
  changePct:   number
  byCategory:  ExpenseCategoryTotal[]
}

export interface CashFlowDay {
  date:      string
  revenue:   number
  expenses:  number
  net:       number
}

export interface CashFlowOverview {
  windowDays:       number
  positiveDays:     number
  negativeDays:     number
  netTotal:         number
  days:             CashFlowDay[]
}

export interface AverageOrderValue {
  aov:        number
  orderCount: number
}

export interface ProductMargin {
  productId:   string
  productName: string
  price:       number
  cost:        number
  marginPct:   number
}

export interface MarginInsights {
  avgMarginPct: number
  bestMargin:   ProductMargin | null
  worstMargin:  ProductMargin | null
  lowMarginProducts: ProductMargin[]
}

export interface CostOptimizationOpportunity {
  type:        'RISING_EXPENSE_CATEGORY' | 'LOW_MARGIN_PRODUCT'
  title:       string
  description: string
}

export interface FinancialHealthScore {
  score:     number   // 0-100
  label:     'Excellent' | 'Good' | 'Fair' | 'Needs Attention'
  breakdown: { negativeCashFlowDays: number; lowMarginProducts: number; risingExpenseCategories: number }
}

export interface FinancialAdvisorSummary {
  tenantId:            string
  revenueTrend:        RevenueTrend
  profitEstimate:      ProfitEstimate
  expenseTrend:        ExpenseTrend
  cashFlow:            CashFlowOverview
  averageOrderValue:   AverageOrderValue
  marginInsights:      MarginInsights
  costOptimizations:   CostOptimizationOpportunity[]
  healthScore:         FinancialHealthScore
  generatedAt:         Date
}
