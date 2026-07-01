// ─── Shared SmartSuite Core Types ─────────────────────────────────────────────

// ── Result monad ──────────────────────────────────────────────────────────────

export type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; code?: string }

export function ok<T>(data: T): Result<T>        { return { ok: true,  data } }
export function err(error: string, code?: string): Result<never> { return { ok: false, error, code } }

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PageOptions {
  page?:  number
  limit?: number
}

export interface PagedResult<T> {
  items:  T[]
  total:  number
  page:   number
  pages:  number
  limit:  number
}

// ── Timestamped ───────────────────────────────────────────────────────────────

export interface TimestampedEntity {
  createdAt:  Date
  updatedAt?: Date
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditEntry extends TimestampedEntity {
  id:          string
  module:      string
  entity:      string
  entityId:    string
  action:      string
  performedBy: string
  timestamp:   Date
  metadata?:   Record<string, unknown>
}

export interface CreateAuditInput {
  module:      string
  entity:      string
  entityId:    string
  action:      string
  performedBy: string
  metadata?:   Record<string, unknown>
}

export interface AuditFilter extends PageOptions {
  module?:      string
  entity?:      string
  entityId?:    string
  action?:      string
  performedBy?: string
  from?:        Date
  to?:          Date
}

// ── Notification ──────────────────────────────────────────────────────────────

export type NotificationLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'SYSTEM'

export interface Notification extends TimestampedEntity {
  id:        string
  level:     NotificationLevel
  title:     string
  message:   string
  module?:   string
  entityId?: string
  targetId?: string
  read:      boolean
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface CreateNotificationInput {
  level:     NotificationLevel
  title:     string
  message:   string
  module?:   string
  entityId?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

export interface NotificationFilter extends PageOptions {
  level?:    NotificationLevel
  module?:   string
  read?:     boolean
  from?:     Date
  to?:       Date
}

// ── File ──────────────────────────────────────────────────────────────────────

export type FileProviderType = 'local' | 's3' | 'r2' | 'supabase'

export interface StoredFile extends TimestampedEntity {
  id:           string
  key:          string
  originalName: string
  mimeType:     string
  sizeBytes:    number
  provider:     FileProviderType
  bucket?:      string
  path:         string
  url?:         string
  module?:      string
  entityId?:    string
  uploadedBy?:  string
  metadata?:    Record<string, unknown>
  createdAt:    Date
}

export interface StoreFileInput {
  key:          string
  originalName: string
  mimeType:     string
  sizeBytes:    number
  buffer:       Buffer
  module?:      string
  entityId?:    string
  uploadedBy?:  string
  metadata?:    Record<string, unknown>
}

// ── Feature Flag ──────────────────────────────────────────────────────────────

export type FlagStatus = 'enabled' | 'disabled' | 'beta' | 'comingSoon'
export type FlagScope  = 'global'  | 'tenant'   | 'role'

export interface FeatureFlag extends TimestampedEntity {
  id:          string
  key:         string
  name:        string
  description?: string
  status:      FlagStatus
  scope:       FlagScope
  targetIds:   string[]
  metadata?:   Record<string, unknown>
  updatedAt:   Date
  createdAt:   Date
}

export interface FlagContext {
  tenantId?: string
  role?:     string
}

// ── Platform Events ───────────────────────────────────────────────────────────

export type PlatformEventName =
  | 'RestaurantCreated'
  | 'RestaurantActivated'
  | 'RestaurantSuspended'
  | 'BillingPaid'
  | 'BillingOverdue'
  | 'TrialExpired'
  | 'TrialExtended'
  | 'CertificateIssued'
  | 'CertificateExpired'
  | 'CampaignCompleted'
  | 'CampaignFailed'
  | 'AIGenerationCompleted'
  | 'AIGenerationFailed'
  | 'AutomationExecuted'
  | 'AutomationFailed'
  | 'DemoRequestSubmitted'
  | 'DemoActivated'
  | 'UserPasswordReset'
  // Marketplace Engine
  | 'ProductCreated'
  | 'ProductUpdated'
  | 'ProductArchived'
  | 'SupplierCreated'
  | 'InventoryUpdated'
  | 'CategoryCreated'
  // Marketplace Orders
  | 'MarketplaceOrderCreated'
  | 'MarketplaceOrderSubmitted'
  | 'MarketplaceOrderApproved'
  | 'MarketplaceOrderRejected'
  | 'MarketplaceOrderCancelled'
  | 'MarketplaceOrderFulfilled'
  // Marketplace AI
  | 'RecommendationGenerated'
  | 'BundleViewed'
  | 'RecommendationAccepted'
  | 'RecommendationDismissed'
  // Payment Engine
  | 'PaymentCreated'
  | 'PaymentAuthorized'
  | 'PaymentSucceeded'
  | 'PaymentFailed'
  | 'PaymentRefunded'
  // Tenant Lifecycle Engine
  | 'TenantCreated'
  | 'TenantActivated'
  | 'TenantPlanChanged'
  | 'TenantSuspended'
  | 'TenantReactivated'
  | 'TenantArchived'
  | 'TenantTrialStarted'
  | 'TenantGracePeriodStarted'
  // Tenant Provisioning (from Restaurant / other SaaS modules)
  | 'CafeCreated'
  // Billing Platform Engine
  | 'SubscriptionCreated'
  | 'SubscriptionRenewed'
  | 'SubscriptionCancelled'
  | 'InvoiceGenerated'
  | 'InvoicePaid'
  | 'QuotaExceeded'
  | 'TrialEnding'
  // Billing Plan Management
  | 'PlanCreated'
  | 'PlanUpdated'
  | 'PlanDeleted'
  | 'PlanActivated'
  | 'PlanDeactivated'
  // POS Core Engine
  | 'PosOrderOpened'
  | 'PosOrderItemAdded'
  | 'PosOrderItemUpdated'
  | 'PosOrderItemRemoved'
  | 'PosOrderClosed'
  // Notifications
  | 'NotificationCreated'
  // Order Management Core
  | 'OrderCreated'
  | 'OrderUpdated'
  | 'OrderCompleted'
  | 'OrderCancelled'
  // Kitchen Display System
  | 'KitchenOrderAccepted'
  | 'KitchenOrderPreparing'
  | 'KitchenOrderReady'
  | 'KitchenOrderServed'
  // Inventory Intelligence (restaurant recipe/stock — distinct from marketplace InventoryUpdated)
  | 'StockLevelChanged'
  | 'StockLow'
  // Tables Management
  | 'TableStatusChanged'
  | 'TableTransferred'
  | 'TableMerged'
  | 'TableUnmerged'
  // Reservation Management
  | 'ReservationCreated'
  | 'ReservationUpdated'
  | 'ReservationConfirmed'
  | 'ReservationCancelled'
  | 'ReservationCheckedIn'
  | 'ReservationNoShow'
  // POS Advanced
  | 'PosOrderHeld'
  | 'PosOrderResumed'
  | 'PosOrderSplit'
  | 'PosOrdersMerged'
  | 'PosReceiptReprinted'
  | 'PosOrderNotesUpdated'
  // Multi-Branch Operations
  | 'BranchAdded'
  | 'BranchRemoved'
  // CRM Foundation
  | 'CustomerTagged'
  | 'CustomerUntagged'
  | 'CustomerNoteUpdated'
  | 'CustomerFavoriteAdded'
  | 'CustomerFavoriteRemoved'

export interface PlatformEvent<T = unknown> {
  name:      PlatformEventName
  payload:   T
  source:    string
  timestamp: Date
  traceId?:  string
}

// ── Standard Event Payload (K11: Platform Event Standardization) ──────────────
// Shared payload shape for Subscriptions/Billing/Payments/Notifications
// events published via eventBus.publish — see core/events/StandardEvent.ts.
export interface StandardEventPayload {
  eventId:    string
  eventName:  PlatformEventName
  tenantId:   string
  actor:      string
  timestamp:  Date
  resourceId: string
  metadata?:  Record<string, unknown>
}
