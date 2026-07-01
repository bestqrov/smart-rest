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

export { markOverdueInvoices, getInvoice, listInvoices } from './invoices/InvoiceService'

export { getSubscription } from './subscriptions/SubscriptionService'

export { getUsageSummary } from './usage/BillingUsageService'

export { checkQuota, checkAllQuotas, isAllowed } from './quotas/QuotaService'

export { notifyTrialEnding } from './notifications/BillingNotifications'

export {
  getMRR,
  getSubscriptionCounts,
  getFailedPaymentsCount,
  getRevenueDashboard,
} from './metrics/BillingMetricsService'

export {
  runTrialEndingReminders,
  runSubscriptionExpirationCheck,
  runGracePeriodExpirationCheck,
  runAutomaticRenewalChecks,
  runSubscriptionLifecycleSweep,
} from './lifecycle/SubscriptionLifecycleJobs'
