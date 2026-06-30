// ─── Billing Platform — Public API ────────────────────────────────────────

export * from './services/BillingOrchestrator'

export type {
  InvoiceStatus,
  TaxType,
  BillingEventType,
  PlatformInvoice,
  TaxCalculation,
  QuotaCheckResult,
  BillingEventPayload,
} from './types'

export {
  getPlanWithPricing,
  listPlansWithPricing,
  getPriceForTenant,
} from './plans/PlanCatalogService'

export { markOverdueInvoices } from './invoices/InvoiceService'

export { checkQuota, checkAllQuotas, isAllowed } from './quotas/QuotaService'

export { notifyTrialEnding } from './notifications/BillingNotifications'
