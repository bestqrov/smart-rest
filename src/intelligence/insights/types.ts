// ─── Smart Intelligence Insight Engine — Contracts (K36) ───────────────────
// Distinct from Recommendation (K35): an insight is an observation
// triggered by a platform event, not a standing actionable item computed
// on demand. Rules receive the same NormalizedIntelligenceEvent agents
// already get (K31), plus K33's context and K32's features for the same
// reason recommendation rules get them — no new data-fetching.

import type { PlatformEventName } from '../../core'
import type { NormalizedIntelligenceEvent } from '../types'
import type { IntelligenceContext } from '../context/types'
import type { FeatureVector } from '../data/DataProvider'

export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type InsightCategory =
  | 'billing' | 'inventory' | 'reviews' | 'seo' | 'loyalty' | 'operations' | 'growth' | 'other'

export type InsightStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'

export interface InsightCandidate {
  category:    InsightCategory
  severity:    InsightSeverity
  title:       string
  description: string
  metadata?:   Record<string, unknown>
}

export interface InsightRuleDefinition {
  id:       string
  name:     string
  category: InsightCategory
  events:   PlatformEventName[] | '*'    // which platform events can trigger this insight
  evaluate: (
    event:    NormalizedIntelligenceEvent,
    context:  IntelligenceContext,
    features: FeatureVector,
  ) => InsightCandidate | null | Promise<InsightCandidate | null>
}
