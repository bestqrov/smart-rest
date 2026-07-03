// ─── Smart Intelligence Financial Advisor v1 — Service (K65) ───────────────
// Combines every detector above into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { analyzeRevenueTrend } from './RevenueAnalysis'
import { estimateProfit } from './ProfitEstimation'
import { analyzeExpenseTrend } from './ExpenseTrendAnalysis'
import { getCashFlowOverview } from './CashFlowOverview'
import { getAverageOrderValue } from './AverageOrderValueAnalysis'
import { getMarginInsights } from './MarginInsights'
import { detectCostOptimizations } from './CostOptimizationDetection'
import { computeFinancialHealthScore } from './FinancialHealthScore'
import type { FinancialAdvisorSummary } from './types'

const NAMESPACE = 'financial-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Financial Advisor summaries',
  })
}

export async function getFinancialAdvisorSummary(tenantId: string): Promise<FinancialAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as FinancialAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [revenueTrend, profitEstimate, expenseTrend, cashFlow, averageOrderValue, marginInsights, costOptimizations, healthScore] = await Promise.all([
    analyzeRevenueTrend(tenantId),
    estimateProfit(tenantId),
    analyzeExpenseTrend(tenantId),
    getCashFlowOverview(tenantId),
    getAverageOrderValue(tenantId),
    getMarginInsights(tenantId),
    detectCostOptimizations(tenantId),
    computeFinancialHealthScore(tenantId),
  ])

  const summary: FinancialAdvisorSummary = {
    tenantId, revenueTrend, profitEstimate, expenseTrend, cashFlow, averageOrderValue,
    marginInsights, costOptimizations, healthScore, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
