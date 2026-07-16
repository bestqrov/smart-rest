// ─── Smart Intelligence Recommendation Engine — Contracts (K35) ────────────
// Rule-based, not ML/LLM: a rule is a pure function over data the platform
// already computed (K33's IntelligenceContext, K32's FeatureVector) — no new
// data fetching, no scoring model.

import type { IntelligenceContext } from '../context/types'
import type { FeatureVector } from '../data/DataProvider'

export type RecommendationCategory =
  | 'billing' | 'inventory' | 'reviews' | 'seo' | 'loyalty' | 'operations' | 'growth' | 'other'

export type RecommendationStatus = 'NEW' | 'ACTIVE' | 'DISMISSED' | 'COMPLETED'

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface RecommendationCandidate {
  category:    RecommendationCategory
  title:       string
  description: string
  score:       number    // 0-100, rule-defined
  metadata?:   Record<string, unknown>
}

export interface RecommendationRuleDefinition {
  id:       string
  name:     string
  category: RecommendationCategory
  evaluate: (
    context:  IntelligenceContext,
    features: FeatureVector,
  ) => RecommendationCandidate | null | Promise<RecommendationCandidate | null>
}
