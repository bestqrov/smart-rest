// ─── Billing Payments — Service (Sprint K3) ────────────────────────────────
// Bridges the generic Payment Engine (src/payments) with the Subscription
// Engine (src/billing/subscriptions), without touching either module's
// internals — only their public APIs.

import * as Payments from '../../payments'
import * as Subscriptions from '../subscriptions/SubscriptionService'
import { AuditService } from '../../core'
import type { PaymentTransaction, ProviderName, PaymentMethod, TransactionFilter } from '../../payments'

async function audit(action: string, entityId: string, by: string, meta?: Record<string, unknown>) {
  await AuditService.createAudit({
    module:      'BILLING_PAYMENTS',
    entity:      'PaymentTransaction',
    entityId,
    action,
    performedBy: by,
    metadata:    meta,
  }).catch(() => undefined)
}

export async function initiatePayment(
  subscriptionId: string,
  by:             string,
  opts: { amount: number; currency?: string; provider?: ProviderName; method?: PaymentMethod; notes?: string },
): Promise<PaymentTransaction> {
  const sub = await Subscriptions.getSubscription(subscriptionId)
  if (!sub) throw new Error('Subscription not found')

  const tx = await Payments.createTransaction({
    orderId:  subscriptionId,
    tenantId: sub.tenantId,
    module:   'BILLING',
    provider: opts.provider ?? 'MANUAL',
    method:   opts.method   ?? 'MANUAL',
    amount:   opts.amount,
    currency: opts.currency ?? 'MAD',
    notes:    opts.notes,
  })
  await audit('INITIATE', tx.id, by, { subscriptionId, amount: tx.amount })
  return tx
}

// Confirms a payment and safely advances the linked subscription's lifecycle.
// Idempotent: if the subscription is already in the target state, the
// transition is a no-op rather than an error (webhooks may be retried).
export async function confirmPayment(txId: string, by: string): Promise<PaymentTransaction> {
  const tx = await Payments.markPaid(txId)

  try {
    const sub = await Subscriptions.getSubscription(tx.orderId)
    if (sub) {
      if (sub.status === 'TRIAL' || sub.status === 'SUSPENDED') {
        await Subscriptions.activate(sub.id, by)
      } else if (sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD') {
        await Subscriptions.renew(sub.id, by)
      }
    }
  } catch {
    // Subscription may already be in the target state (duplicate webhook
    // delivery) or in a terminal state — payment is still recorded as PAID.
  }

  await audit('CONFIRM', tx.id, by, { subscriptionId: tx.orderId })
  return tx
}

export async function failPayment(txId: string, reason: string): Promise<PaymentTransaction> {
  const tx = await Payments.fail(txId, reason)
  await audit('FAIL', tx.id, 'system', { subscriptionId: tx.orderId, reason })
  return tx
}

export async function getPayment(txId: string): Promise<PaymentTransaction | null> {
  return Payments.getTransaction(txId)
}

export async function getPaymentsForSubscription(subscriptionId: string) {
  return Payments.getTransactions({ orderId: subscriptionId, module: 'BILLING' })
}

export async function listBillingPayments(filter: Omit<TransactionFilter, 'module'>) {
  return Payments.getTransactions({ ...filter, module: 'BILLING' })
}
