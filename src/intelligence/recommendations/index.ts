// ─── Smart Intelligence Recommendation Engine — Public API (K35) ───────────

export type {
  RecommendationCategory, RecommendationStatus, RecommendationPriority,
  RecommendationCandidate, RecommendationRuleDefinition,
} from './types'

export {
  registerRecommendationRule,
  getRecommendationRule,
  hasRecommendationRule,
  getAllRecommendationRules,
  getRulesByCategory,
} from './RecommendationRuleRegistry'

export { scoreToPriority } from './PriorityScoring'

export {
  runRecommendationEngine,
  activateRecommendation,
  dismissRecommendation,
  completeRecommendation,
  listRecommendations,
  getRecommendation,
} from './RecommendationEngine'
