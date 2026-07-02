// ─── Smart Intelligence Insight Engine — Public API (K36) ──────────────────

export type {
  InsightSeverity, InsightCategory, InsightStatus, InsightCandidate, InsightRuleDefinition,
} from './types'

export {
  registerInsightRule,
  unregisterInsightRule,
  getInsightRule,
  hasInsightRule,
  getAllInsightRules,
  getInsightRulesByCategory,
} from './InsightRuleRegistry'

export {
  createInsightFromCandidate,
  acknowledgeInsight,
  resolveInsight,
  dismissInsight,
  listInsights,
  getInsight,
} from './InsightEngine'
