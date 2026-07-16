// ─── Smart Intelligence Automation Advisor — Service (K54) ─────────────────
// Combines detection/scoring/recommendations/approvals into one summary,
// cached through K44's Memory Engine (same 5-minute short-term pattern
// K53's UnifiedBusinessSummary uses) as the dashboard integration hook.
// getBusinessAndAutomationSummary composes K53's getUnifiedBusinessSummary
// (unchanged) alongside this module's summary — Advisor integration
// without modifying K53's stable files.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { getUnifiedBusinessSummary, type UnifiedBusinessSummary } from '../business-advisor'
import { detectAutomationOpportunities } from './OpportunityDetection'
import { computeAutomationReadinessScore } from './ReadinessScoring'
import { generateAutomationRecommendations } from './RecommendationEngine'
import { listPendingAutomationApprovals } from './ApprovalWorkflow'
import type { AutomationAdvisorSummary } from './types'

const NAMESPACE = 'automation-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Automation Advisor summaries for dashboard polling',
  })
}

export async function getAutomationAdvisorSummary(tenantId: string): Promise<AutomationAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as AutomationAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [readiness, opportunities, recommendations, pendingApprovals] = await Promise.all([
    computeAutomationReadinessScore(tenantId),
    detectAutomationOpportunities(tenantId),
    generateAutomationRecommendations(tenantId),
    listPendingAutomationApprovals(tenantId),
  ])

  const summary: AutomationAdvisorSummary = {
    tenantId, readiness, opportunities, recommendations, pendingApprovals, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}

export interface BusinessAndAutomationSummary {
  business:   UnifiedBusinessSummary
  automation: AutomationAdvisorSummary
}

export async function getBusinessAndAutomationSummary(tenantId: string): Promise<BusinessAndAutomationSummary> {
  const [business, automation] = await Promise.all([
    getUnifiedBusinessSummary(tenantId),
    getAutomationAdvisorSummary(tenantId),
  ])
  return { business, automation }
}
