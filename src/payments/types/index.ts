// ─── Payment Engine Types ──────────────────────────────────────────────────────

export type ProviderName =
  | 'MANUAL'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'STRIPE'
  | 'PAYPAL'
  | 'CMI'
  | 'PAYZONE'

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'WALLET'
  | 'INVOICE'
  | 'MANUAL'

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED'

export type PaymentModule = 'MARKETPLACE' | 'BILLING' | 'HOTEL' | 'CLINIC' | 'RETAIL'

export interface PaymentTransaction {
  id:           string
  orderId:      string
  tenantId:     string
  module:       string
  provider:     ProviderName
  method:       PaymentMethod
  status:       PaymentStatus
  amount:       number
  currency:     string
  reference?:   string
  notes?:       string
  paidAt?:      Date | string
  refundedAt?:  Date | string
  refundAmount?: number
  metadata?:    string
  createdAt:    Date | string
  updatedAt:    Date | string
}

export interface CreateTransactionInput {
  orderId:    string
  tenantId:   string
  module?:    string
  provider:   ProviderName
  method:     PaymentMethod
  amount:     number
  currency?:  string
  reference?: string
  notes?:     string
  metadata?:  Record<string, unknown>
}

export interface TransactionFilter {
  tenantId?:  string
  orderId?:   string
  status?:    PaymentStatus
  provider?:  ProviderName
  module?:    string
  page?:      number
  limit?:     number
}

export interface TransactionPage {
  transactions: PaymentTransaction[]
  total:        number
  page:         number
  limit:        number
}

// Provider abstraction result types
export interface AuthorizeResult {
  reference?: string
  metadata?:  Record<string, unknown>
}

export interface CaptureResult {
  reference?: string
  paidAt:     Date
  metadata?:  Record<string, unknown>
}

export interface RefundResult {
  reference?:   string
  refundedAt:   Date
  refundAmount: number
}

// Notification helper type
export interface PaymentNotificationPayload {
  tenantId:    string
  orderId:     string
  amount:      number
  currency:    string
  status:      PaymentStatus
  reference?:  string
  txId:        string
}
