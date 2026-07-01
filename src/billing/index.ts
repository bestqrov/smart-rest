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

export {
  getTrialDurationDays,
  getGracePeriodDays,
  getDefaultAutoRenew,
  getBillingCurrency,
  getInvoicePrefix,
  getWebhookSecret,
  getAllBillingSettings,
  updateBillingSetting,
} from './settings/BillingSettingsService'

export {
  logSubscriptionCreated,
  logSubscriptionRenewed,
  logSubscriptionCancelled,
  logSubscriptionExpired,
  logPaymentCreated,
  logPaymentSucceeded,
  logPaymentFailed,
  logSettingsUpdated,
  listBillingAudit,
} from './audit/BillingAuditService'
export type { BillingAuditFilter } from './audit/BillingAuditService'
