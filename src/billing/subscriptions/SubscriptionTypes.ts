// ─── Billing Subscriptions — Types ────────────────────────────────────────

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface BillingSubscription {
  id:           string
  tenantId:     string
  planId:       string      // BillingPlan._id
  planCode:     string      // denormalized for display
  planName:     string      // denormalized for display
  status:       SubscriptionStatus
  startDate:    Date
  endDate:      Date | null
  renewalDate:  Date | null
  trialEndsAt:  Date | null
  cancelledAt:  Date | null
  graceEndsAt:  Date | null
  autoRenew:    boolean
  notes:        string | null
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateSubscriptionInput {
  tenantId:    string
  planId:      string
  planCode:    string
  planName:    string
  status:      SubscriptionStatus
  startDate:   Date
  endDate?:    Date
  renewalDate?: Date
  trialEndsAt?: Date
  autoRenew?:  boolean
  notes?:      string
}

export interface SubscriptionWithPlan extends BillingSubscription {
  plan?: {
    id:           string
    name:         string
    code:         string
    monthlyPrice: number
    currency:     string
    maxUsers:     number
    maxStorageGB: number
    aiCredits:    number
    marketplaceEnabled:   boolean
    automationEnabled:    boolean
    certificationEnabled: boolean
    apiAccess:    boolean
    supportLevel: string
  } | null
}
