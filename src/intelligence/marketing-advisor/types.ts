// ─── Smart Intelligence Marketing Advisor v1 — Contracts (K62) ─────────────
// Rule-based only, no LLM. Verified src/marketing-brain/models/
// TemplatePerformance.ts + MessageTemplate.ts already compute
// open/click/conversion rates — but those are platform-wide content
// templates (keyed by persona/country, no cafeId), not this tenant's
// actual sends. This module measures THIS tenant's own
// WhatsAppMessage/EmailMessage/SocialPost/MarketingCampaign records
// (Prisma, cafeId-scoped) — a different, tenant-scoped concern, not a
// duplicate of the platform-wide template analytics.
//
// Similarly, ChannelPlanner.planChannels()/TimingPlanner.planTiming()
// already exist — but they're static, persona/country-knowledge-based
// pre-send guidance for content generation, not measured historical
// performance for a specific tenant. BestChannelRecommendation and
// BestPostingTimeDetection here compute the latter from this tenant's
// own message history — genuinely missing functionality, not a
// duplicate of that pre-send planning logic.

import type { Channel } from '../../marketing-brain/models/MessageTemplate'

export type { Channel }

export interface EmailChannelMetrics {
  sent: number
  opened: number
  clicked: number
  bounced: number
  openRate: number
  clickRate: number
}

export interface WhatsAppChannelMetrics {
  sent: number
  failed: number
  sendSuccessRate: number
}

export interface SocialChannelMetrics {
  published: number
  failed: number
  successRate: number
  byPlatform: Record<string, number>
}

export interface CampaignPerformance {
  total:        number
  published:    number
  failed:       number
  successRate:  number
}

export interface ChannelRanking {
  channel: Channel | 'SOCIAL'
  score:   number   // 0-100, rule-derived from the relevant engagement/success rate
  volume:  number
}

export interface BestPostingHour {
  hour:  number   // 0-23, UTC
  opens: number
}

export interface CampaignRoiEstimate {
  campaignId:  string
  productName: string
  publishedAt: Date | null
  estimatedRevenueImpact: number   // rough: paid order revenue in the 3 days after
}

export interface PromotionOpportunity {
  reason:      'OVERSTOCK' | 'CHURN_RISK'
  title:       string
  description: string
  refCount:    number
}

export interface AudienceTargetSuggestion {
  segment:    'VIP' | 'NEW'
  count:      number
  suggestion: string
}

export interface MarketingAdvisorSummary {
  tenantId:            string
  email:               EmailChannelMetrics
  whatsapp:            WhatsAppChannelMetrics
  social:               SocialChannelMetrics
  campaigns:           CampaignPerformance
  channelRanking:      ChannelRanking[]
  bestPostingHours:    BestPostingHour[]
  roiEstimates:        CampaignRoiEstimate[]
  promotionOpportunities: PromotionOpportunity[]
  audienceTargets:     AudienceTargetSuggestion[]
  generatedAt:         Date
}
