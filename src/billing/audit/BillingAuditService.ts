// ─── Billing Platform — Audit Trail ─────────────────────────────────────────
// Thin wrapper over the existing core AuditService, scoped to module 'BILLING'.
// entityId carries the tenantId (so tenant filtering reuses AuditFilter.entityId
// as-is); the specific resource (subscription/invoice/transaction id) travels
// in metadata.resourceId.

import { AuditService } from '../../core'
import logger from '../../logger'
import type { AuditEntry, AuditFilter, PagedResult } from '../../core/types'

const MODULE = 'BILLING'

async function log(
  entity:      string,
  tenantId:    string,
  action:      string,
  resourceId:  string,
  performedBy: string,
  metadata?:   Record<string, unknown>,
): Promise<void> {
  await AuditService.createAudit({
    module:      MODULE,
    entity,
    entityId:    tenantId,
    action,
    performedBy,
    metadata:    { resourceId, ...metadata },
  }).catch(err => {
    logger.error({ msg: '[BillingAudit] failed to write audit entry', entity, action, tenantId, err: err.message })
  })
}

export async function logSubscriptionCreated(tenantId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('SUBSCRIPTION', tenantId, 'SUBSCRIPTION_CREATED', tenantId, performedBy, metadata)
}

export async function logSubscriptionRenewed(tenantId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('SUBSCRIPTION', tenantId, 'SUBSCRIPTION_RENEWED', tenantId, performedBy, metadata)
}

export async function logSubscriptionCancelled(tenantId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('SUBSCRIPTION', tenantId, 'SUBSCRIPTION_CANCELLED', tenantId, performedBy, metadata)
}

export async function logSubscriptionExpired(tenantId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('SUBSCRIPTION', tenantId, 'SUBSCRIPTION_EXPIRED', tenantId, performedBy, metadata)
}

export async function logPaymentCreated(tenantId: string, transactionId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('PAYMENT', tenantId, 'PAYMENT_CREATED', transactionId, performedBy, metadata)
}

export async function logPaymentSucceeded(tenantId: string, transactionId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('PAYMENT', tenantId, 'PAYMENT_SUCCEEDED', transactionId, performedBy, metadata)
}

export async function logPaymentFailed(tenantId: string, transactionId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('PAYMENT', tenantId, 'PAYMENT_FAILED', transactionId, performedBy, metadata)
}

export async function logSettingsUpdated(key: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('SETTINGS', 'PLATFORM', 'SETTINGS_UPDATED', key, performedBy, metadata)
}

export async function logUsageReset(tenantId: string, performedBy: string, metadata?: Record<string, unknown>): Promise<void> {
  await log('USAGE', tenantId, 'USAGE_RESET', tenantId, performedBy, metadata)
}

export interface BillingAuditFilter {
  tenantId?: string
  action?:   string
  from?:     Date
  to?:       Date
  page?:     number
  limit?:    number
}

export async function listBillingAudit(filter: BillingAuditFilter = {}): Promise<PagedResult<AuditEntry>> {
  const auditFilter: AuditFilter = {
    module:   MODULE,
    entityId: filter.tenantId,
    action:   filter.action,
    from:     filter.from,
    to:       filter.to,
    page:     filter.page,
    limit:    filter.limit,
  }
  return AuditService.getAuditHistory(auditFilter)
}
