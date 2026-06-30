// ─── Billing Platform — Event Publishers ──────────────────────────────────

import { eventBus }             from '../../core'
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

export async function emitSubscriptionCreated(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionCreated', p, 'billing')
  await log('SUBSCRIPTION_CREATED', p.tenantId, p.module, p)
}

export async function emitSubscriptionRenewed(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionRenewed', p, 'billing')
  await log('SUBSCRIPTION_RENEWED', p.tenantId, p.module, p)
}

export async function emitSubscriptionCancelled(p: BillingEventPayload): Promise<void> {
  eventBus.publish('SubscriptionCancelled', p, 'billing')
  await log('SUBSCRIPTION_CANCELLED', p.tenantId, p.module, p)
}

export async function emitInvoiceGenerated(p: BillingEventPayload): Promise<void> {
  eventBus.publish('InvoiceGenerated', p, 'billing')
  await log('INVOICE_GENERATED', p.tenantId, p.module, p)
}

export async function emitInvoicePaid(p: BillingEventPayload): Promise<void> {
  eventBus.publish('InvoicePaid', p, 'billing')
  await log('INVOICE_PAID', p.tenantId, p.module, p)
}

export async function emitQuotaExceeded(p: BillingEventPayload): Promise<void> {
  eventBus.publish('QuotaExceeded', p, 'billing')
  await log('QUOTA_EXCEEDED', p.tenantId, p.module, p)
}

export async function emitTrialEnding(p: BillingEventPayload): Promise<void> {
  eventBus.publish('TrialEnding', p, 'billing')
  await log('TRIAL_ENDING', p.tenantId, p.module, p)
}
