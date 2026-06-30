// ─── Billing Platform — Types ──────────────────────────────────────────────

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'

export type TaxType = 'VAT' | 'SALES_TAX' | 'NONE'

export type BillingEventType =
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PAID'
  | 'QUOTA_EXCEEDED'
  | 'TRIAL_ENDING'

export interface PlatformInvoice {
  id:            string
  invoiceNumber: string
  tenantId:      string
  module:        string
  plan:          string
  status:        InvoiceStatus
  subtotal:      number
  taxAmount:     number
  taxType:       TaxType
  taxRate:       number
  total:         number
  currency:      string
  periodStart:   Date
  periodEnd:     Date
  dueDate:       Date
  paidAt?:       Date
  notes?:        string
  metadata?:     Record<string, unknown>
  createdAt:     Date
  updatedAt:     Date
}

export interface TaxCalculation {
  subtotal:  number
  taxType:   TaxType
  taxRate:   number
  taxAmount: number
  total:     number
  currency:  string
}

export interface QuotaCheckResult {
  allowed:    boolean
  field:      string
  current:    number
  limit:      number
  percentage: number
  message?:   string
}

export interface BillingEventPayload {
  tenantId:   string
  module:     string
  plan?:      string
  invoiceId?: string
  field?:     string
  metadata?:  Record<string, unknown>
}
