// ─── Smart Intelligence Recommendation Engine — Priority Scoring (K35) ─────
// Deterministic bucketing of a rule's 0-100 score into a priority label —
// not a model, just a fixed threshold table.

import type { RecommendationPriority } from './types'

export function scoreToPriority(score: number): RecommendationPriority {
  if (score >= 76) return 'URGENT'
  if (score >= 51) return 'HIGH'
  if (score >= 26) return 'MEDIUM'
  return 'LOW'
}
