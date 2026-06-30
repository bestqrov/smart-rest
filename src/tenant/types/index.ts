// ─── Tenant Lifecycle Engine — Types ─────────────────────────────────────────

export type TenantState =
  | 'PENDING'
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'ARCHIVED'

export type TenantType = 'RESTAURANT' | 'HOTEL' | 'CLINIC' | 'RETAIL' | 'OTHER'

export type Plan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM'

export type SuspensionType = 'MANUAL' | 'AUTOMATIC' | 'BILLING' | 'SECURITY' | 'MAINTENANCE'

// ─── Plan Definition ──────────────────────────────────────────────────────────

export interface PlanLimits {
  users:                       number
  tables:                      number
  qrCodes:                     number
  storageGb:                   number
  aiRequestsPerMonth:          number
  reservationsPerMonth:        number
  marketplaceOrdersPerMonth:   number
  automationExecutionsPerMonth: number
}

export interface PlanFeatures {
  marketplace:     boolean
  automation:      boolean
  certification:   boolean
  analytics:       boolean
  aiCenter:        boolean
  multiLocation:   boolean
  customBranding:  boolean
  prioritySupport: boolean
}

export interface PlanDefinition {
  name:      Plan
  modules:   string[]
  limits:    PlanLimits
  features:  PlanFeatures
  trialDays: number
}

// ─── Tenant Profile ───────────────────────────────────────────────────────────

export interface TempPromotion {
  id:        string
  feature:   string
  value:     boolean
  expiresAt: string
  reason:    string
}

export interface TenantProfile {
  id:                string
  tenantId:          string
  tenantType:        TenantType
  state:             TenantState
  plan:              Plan
  trialEndsAt?:      string
  suspendedAt?:      string
  suspensionType?:   SuspensionType
  suspensionReason?: string
  gracePeriodEndsAt?:string
  activatedAt?:      string
  cancelledAt?:      string
  archivedAt?:       string
  defaultLanguage:   string
  defaultCurrency:   string
  country:           string
  timezone:          string
  featureOverrides?: Record<string, boolean>
  tempPromotions?:   TempPromotion[]
  customLimits?:     Partial<PlanLimits>
  createdAt:         string
  updatedAt:         string
}

// ─── Feature Resolution ───────────────────────────────────────────────────────

export interface ResolvedFeatures {
  modules:       string[]
  limits:        PlanLimits
  features:      PlanFeatures
  overrides:     Record<string, boolean>
  activePromos:  TempPromotion[]
  resolvedAt:    string
  plan:          Plan
  state:         TenantState
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export interface UsageSummary {
  tenantId:         string
  period:           string
  storageBytes:     number
  storageGb:        number
  aiRequests:       number
  userCount:        number
  tableCount:       number
  qrCount:          number
  reservations:     number
  marketplaceOrders:number
  automations:      number
  limits:           PlanLimits
  percentages:      Record<string, number>
}

export type UsageField =
  | 'aiRequests'
  | 'reservations'
  | 'marketplaceOrders'
  | 'automations'

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateTenantInput {
  tenantId:        string
  tenantType?:     TenantType
  plan?:           Plan
  startTrial?:     boolean
  defaultLanguage?:string
  defaultCurrency?:string
  country?:        string
  timezone?:       string
  metadata?:       Record<string, unknown>
}

export interface SuspendInput {
  type:            SuspensionType
  reason:          string
  suspendedBy?:    string
  gracePeriodDays?:number
}

export interface AssignPlanInput {
  plan:          Plan
  changedBy?:    string
  customLimits?: Partial<PlanLimits>
}

export interface GracePeriodConfig {
  allowRead:        boolean
  allowWrite:       boolean
  allowMarketplace: boolean
  allowAutomation:  boolean
  durationDays:     number
}

export const DEFAULT_GRACE_PERIOD: GracePeriodConfig = {
  allowRead:        true,
  allowWrite:       false,
  allowMarketplace: false,
  allowAutomation:  false,
  durationDays:     7,
}
