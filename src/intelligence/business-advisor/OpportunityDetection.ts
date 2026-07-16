// ─── Business Advisor v1 — Opportunity Detection (K53) ─────────────────────
// Reuses K35's Recommendation Engine directly. Recommendation rows are
// upserted per (tenantId, ruleId) — runRecommendationEngine is cheap and
// idempotent, so a self-heal on first-ever read (no rows yet) does not
// create duplicates or drift from a normal event-triggered run.

import { listRecommendations, runRecommendationEngine } from '../recommendations'
import type { BusinessOpportunity } from './types'

export async function detectOpportunities(tenantId: string, limit = 5): Promise<BusinessOpportunity[]> {
  let recommendations = await listRecommendations(tenantId)
  let active = recommendations.filter(r => r.status === 'NEW' || r.status === 'ACTIVE')

  if (active.length === 0) {
    recommendations = await runRecommendationEngine(tenantId)
    active = recommendations.filter(r => r.status === 'NEW' || r.status === 'ACTIVE')
  }

  return active
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ id: r.id, category: r.category, priority: r.priority, title: r.title, description: r.description, score: r.score }))
}
