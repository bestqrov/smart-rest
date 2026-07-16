// ─── Smart Intelligence Decision Engine — Contracts (K38) ──────────────────
// A decision rule synthesizes already-computed platform state (K33 context,
// K32 features, K35 recommendations, K36 insights) — no new data-fetching,
// no LLM reasoning. "confidence" and "priority" are rule-declared, not
// computed by a shared model.

import type { IntelligenceContext } from '../context/types'
import type { FeatureVector } from '../data/DataProvider'
import type { listRecommendations } from '../recommendations'
import type { listInsights } from '../insights'

export type DecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
export type DecisionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface DecisionEvaluationInput {
  tenantId:        string
  context:         IntelligenceContext
  features:        FeatureVector
  recommendations: Awaited<ReturnType<typeof listRecommendations>>
  insights:        Awaited<ReturnType<typeof listInsights>>
}

export interface DecisionCandidate {
  category:                  string
  title:                     string
  description:               string
  priority:                  DecisionPriority
  confidence:                number              // 0-1
  suggestedActionExecutorId?: string             // an Action Engine (K37) executor id
  suggestedActionInput?:     Record<string, unknown>
  metadata?:                 Record<string, unknown>
}

export interface DecisionRuleDefinition {
  id:       string
  name:     string
  category: string
  evaluate: (input: DecisionEvaluationInput) => DecisionCandidate | null | Promise<DecisionCandidate | null>
}
