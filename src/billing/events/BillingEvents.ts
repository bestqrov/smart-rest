// ─── Billing Platform — Event Publishers ──────────────────────────────────

import { publishStandardEvent } from '../../core'
import type { BillingEventPayload } from '../types'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

async function log(type: string, tenantId: string, module: string, payload: unknown) {
  const prisma = await getPrisma()
  await (prisma as any).billingEventLog.create({
    data: { tenantId, type, module, payload: JSON.stringify(payload) },
  }).catch(() => undefined)
}

// Standardized payload: eventId/eventName/tenantId/actor/timestamp are added
// by publishStandardEvent; resourceId is the invoice when present, otherwise
// the tenant itself; module/plan/field/extra metadata travel in `metadata`.
function toStandardInput(p: BillingEventPayload) {
  return {
    tenantId:   p.tenantId,
    resourceId: p.invoiceId ?? p.tenantId,
    metadata:   { module: p.module, plan: p.plan, field: p.field, ...p.metadata },
  }
}

export async function emitSubscriptionCreated(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('SubscriptionCreated', toStandardInput(p), 'billing')
  await log('SUBSCRIPTION_CREATED', p.tenantId, p.module, p)
}

export async function emitSubscriptionRenewed(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('SubscriptionRenewed', toStandardInput(p), 'billing')
  await log('SUBSCRIPTION_RENEWED', p.tenantId, p.module, p)
}

export async function emitSubscriptionCancelled(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('SubscriptionCancelled', toStandardInput(p), 'billing')
  await log('SUBSCRIPTION_CANCELLED', p.tenantId, p.module, p)
}

export async function emitInvoiceGenerated(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('InvoiceGenerated', toStandardInput(p), 'billing')
  await log('INVOICE_GENERATED', p.tenantId, p.module, p)
}

export async function emitInvoicePaid(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('InvoicePaid', toStandardInput(p), 'billing')
  await log('INVOICE_PAID', p.tenantId, p.module, p)
}

export async function emitQuotaExceeded(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('QuotaExceeded', toStandardInput(p), 'billing')
  await log('QUOTA_EXCEEDED', p.tenantId, p.module, p)
}

export async function emitTrialEnding(p: BillingEventPayload): Promise<void> {
  publishStandardEvent('TrialEnding', toStandardInput(p), 'billing')
  await log('TRIAL_ENDING', p.tenantId, p.module, p)
}
