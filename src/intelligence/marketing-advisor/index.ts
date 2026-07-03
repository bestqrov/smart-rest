// ─── Smart Intelligence Marketing Advisor v1 — Public API (K62) ────────────

export type {
  Channel, EmailChannelMetrics, WhatsAppChannelMetrics, SocialChannelMetrics,
  CampaignPerformance, ChannelRanking, BestPostingHour, CampaignRoiEstimate,
  PromotionOpportunity, AudienceTargetSuggestion, MarketingAdvisorSummary,
} from './types'

export { computeEmailMetrics, computeWhatsAppMetrics, computeSocialMetrics, computeCampaignPerformance } from './MarketingMetrics'
export { rankChannelsByPerformance } from './BestChannelRecommendation'
export { detectBestPostingHours } from './BestPostingTimeDetection'
export { estimateCampaignRevenueImpact } from './RoiEstimation'
export { detectPromotionOpportunities } from './PromotionOpportunityDetection'
export { getAudienceTargetSuggestions } from './AudienceTargetingSuggestions'
export { marketingPromotionRecommendationRule } from './MarketingRecommendationRule'
export { getMarketingAdvisorSummary } from './MarketingAdvisorService'
export { registerMarketingAdvisorAgent } from './MarketingAdvisorAgent'
