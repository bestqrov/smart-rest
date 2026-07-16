// ─── Business Advisor v1 — Opportunity Recommendation Rules (K53) ──────────
// Rule-based only, no LLM. Registered into K35's Recommendation Engine —
// the same "Foundation shipped zero business rules" gap K52 filled for
// Insights (K36), now filled for Recommendations. Pure functions over
// K33's IntelligenceContext + K32's FeatureVector — no new data fetching.

import type { RecommendationRuleDefinition } from '../recommendations/types'

export const seoOpportunityRule: RecommendationRuleDefinition = {
  id:       'seo-improvement-opportunity',
  name:     'SEO Improvement Opportunity',
  category: 'seo',
  evaluate(_context, features) {
    const score = features['seo.score']
    if (typeof score !== 'number' || score >= 50) return null

    return {
      category:    'seo',
      title:       'Improve local SEO visibility',
      description: `Local SEO score is ${score}/100 — completing your Google Business Profile and citations can improve discoverability.`,
      score:       Math.round(100 - score),
      metadata:    { seoScore: score },
    }
  },
}

export const reviewVolumeOpportunityRule: RecommendationRuleDefinition = {
  id:       'review-volume-opportunity',
  name:     'Review Volume Opportunity',
  category: 'reviews',
  evaluate(_context, features) {
    const count   = features['reviews.count']
    const average = features['reviews.averageRating']
    if (typeof count !== 'number' || typeof average !== 'number') return null
    if (count >= 20 || average < 4) return null

    return {
      category:    'reviews',
      title:       'Request more customer reviews',
      description: `Only ${count} reviews so far with a strong ${average.toFixed(1)} average — asking satisfied customers to review can build trust faster.`,
      score:       Math.round(60 - count * 2),
      metadata:    { reviewCount: count, averageRating: average },
    }
  },
}

export const trialConversionOpportunityRule: RecommendationRuleDefinition = {
  id:       'trial-conversion-opportunity',
  name:     'Trial Conversion Opportunity',
  category: 'billing',
  evaluate(context) {
    if (context.tenant.state !== 'TRIAL') return null
    const trialEndsAt = context.tenant.trialEndsAt ? new Date(context.tenant.trialEndsAt) : null
    if (!trialEndsAt) return null

    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    if (daysLeft > 7 || daysLeft < 0) return null

    return {
      category:    'billing',
      title:       'Trial ending soon',
      description: `Your trial ends in ${daysLeft} day(s) — upgrade now to avoid interruption and unlock full features.`,
      score:       Math.round(100 - daysLeft * 10),
      metadata:    { daysLeft },
    }
  },
}

export const BUILTIN_OPPORTUNITY_RULES = [seoOpportunityRule, reviewVolumeOpportunityRule, trialConversionOpportunityRule]
