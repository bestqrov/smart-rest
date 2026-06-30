export type RecommendationType =
  | 'RECOMMENDED_FOR_YOU'
  | 'FREQUENTLY_BOUGHT_TOGETHER'
  | 'UPGRADE_SUGGESTION'
  | 'REPLACEMENT_SUGGESTION'
  | 'TRENDING'
  | 'AI_PICKS'

export type AlertSeverity = 'INFO' | 'WARNING' | 'SUCCESS'

export interface AIScore {
  confidence: number       // 0–100
  reason: string
  priority: number         // 1–10, higher = more urgent
  estimatedRoi?: number    // MAD
  estimatedPayback?: number // months
}

export interface MarketplaceRecommendation {
  productId: string
  product?: Record<string, unknown>
  type: RecommendationType
  score: AIScore
}

export interface SmartAlert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  productId?: string
  actionLabel?: string
  actionUrl?: string
}

export interface MarketplaceBundle {
  id: string
  name: string
  slug: string
  description: string
  type: string
  bundlePrice: number
  currency: string
  savings: number
  productIds: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RecommendationContext {
  tenantId: string
  restaurantType?: string
  seats?: number
  certificationLevel?: string
  installedModules?: string[]
  orderHistory?: string[]     // productIds previously ordered
  marketingActive?: boolean
  aiUsage?: boolean
  month?: number              // 1–12 for seasonality
}

export interface WidgetData {
  pendingOrders: number
  approvedOrders: number
  totalSpent: number
  recommendations: MarketplaceRecommendation[]
  recentPurchases: Array<{
    id: string
    orderNumber: string
    status: string
    total: number
    createdAt: string
  }>
}
