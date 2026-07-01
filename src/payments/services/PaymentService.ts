import { getProvider }    from '../providers/registry'
import {
  createTransaction as dbCreate,
  getTransaction,
  getTransactions,
  updateTransaction,
} from '../transactions/TransactionService'
import { refundTransaction } from '../refunds/RefundService'
import { eventBus, NotificationService } from '../../core'
import {
  logPaymentCreated, logPaymentSucceeded, logPaymentFailed,
} from '../../billing/audit/BillingAuditService'
import type {
  CreateTransactionInput, PaymentTransaction, TransactionFilter, TransactionPage,
} from '../types'

// ─── Payment Service (main facade) ────────────────────────────────────────────

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<PaymentTransaction> {
  const tx = await dbCreate(input)

  eventBus.publish('PaymentCreated', {
    txId:     tx.id,
    orderId:  tx.orderId,
    tenantId: tx.tenantId,
    amount:   tx.amount,
    currency: tx.currency,
    provider: tx.provider,
    method:   tx.method,
  }, 'payment-engine')

  NotificationService.createNotification({
    level:    'INFO',
    title:    'دفع مطلوب',
    message:  `مبلغ ${tx.amount} ${tx.currency} مطلوب لطلب ${tx.orderId}`,
    module:   'PAYMENTS',
    entityId: tx.id,
    targetId: tx.tenantId,
  }).catch(() => undefined)

  await logPaymentCreated(tx.tenantId, tx.id, 'system', { amount: tx.amount, currency: tx.currency, provider: tx.provider })

  return tx
}

export async function authorize(
  txId:     string,
  metadata?: Record<string, unknown>,
): Promise<PaymentTransaction> {
  const tx = await getTransaction(txId)
  if (!tx) throw new Error(`Transaction ${txId} not found`)
  if (tx.status !== 'PENDING') throw new Error(`Cannot authorize transaction in status ${tx.status}`)

  const provider = getProvider(tx.provider)
  const result   = await provider.authorize(tx, metadata)

  const updated = await updateTransaction(txId, {
    status:    'AUTHORIZED',
    reference: result.reference ?? tx.reference,
  })

  eventBus.publish('PaymentAuthorized', {
    txId, orderId: tx.orderId, tenantId: tx.tenantId, amount: tx.amount,
  }, 'payment-engine')

  return updated
}

export async function markPaid(
  txId:       string,
  reference?: string,
  paidAt?:    Date,
  notes?:     string,
): Promise<PaymentTransaction> {
  const tx = await getTransaction(txId)
  if (!tx) throw new Error(`Transaction ${txId} not found`)
  if (!['PENDING', 'AUTHORIZED'].includes(tx.status)) {
    throw new Error(`Cannot mark paid: transaction is ${tx.status}`)
  }

  // For providers that have a separate capture step, call it
  const provider = getProvider(tx.provider)
  let captureRef = reference
  if (!captureRef) {
    const result = await provider.capture(tx)
    captureRef = result.reference
  }

  const updated = await updateTransaction(txId, {
    status:    'PAID',
    paidAt:    paidAt ?? new Date(),
    reference: captureRef ?? tx.reference,
    notes:     notes ?? tx.notes,
  })

  eventBus.publish('PaymentSucceeded', {
    txId, orderId: tx.orderId, tenantId: tx.tenantId,
    amount: tx.amount, currency: tx.currency, reference: captureRef,
  }, 'payment-engine')

  NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'تم تأكيد الدفع',
    message:  `تم استلام مبلغ ${tx.amount} ${tx.currency} لطلب ${tx.orderId}`,
    module:   'PAYMENTS',
    entityId: tx.id,
    targetId: tx.tenantId,
  }).catch(() => undefined)

  await logPaymentSucceeded(tx.tenantId, tx.id, 'system', { amount: tx.amount, currency: tx.currency, reference: captureRef })

  return updated
}

export async function fail(
  txId:   string,
  reason?: string,
): Promise<PaymentTransaction> {
  const tx = await getTransaction(txId)
  if (!tx) throw new Error(`Transaction ${txId} not found`)
  if (['PAID', 'REFUNDED', 'CANCELLED'].includes(tx.status)) {
    throw new Error(`Cannot fail transaction in status ${tx.status}`)
  }

  const updated = await updateTransaction(txId, {
    status: 'FAILED',
    notes:  reason ?? tx.notes,
  })

  eventBus.publish('PaymentFailed', {
    txId, orderId: tx.orderId, tenantId: tx.tenantId, reason,
  }, 'payment-engine')

  await logPaymentFailed(tx.tenantId, tx.id, 'system', { reason })

  return updated
}

export async function refund(
  txId:    string,
  amount?: number,
  reason?: string,
): Promise<PaymentTransaction> {
  const updated = await refundTransaction(txId, amount, reason)

  NotificationService.createNotification({
    level:    'INFO',
    title:    'تم استرداد المبلغ',
    message:  `تم استرداد مبلغ ${updated.refundAmount ?? updated.amount} ${updated.currency}`,
    module:   'PAYMENTS',
    entityId: txId,
    targetId: updated.tenantId,
  }).catch(() => undefined)

  return updated
}

export async function cancel(txId: string): Promise<PaymentTransaction> {
  const tx = await getTransaction(txId)
  if (!tx) throw new Error(`Transaction ${txId} not found`)
  if (['PAID', 'REFUNDED', 'CANCELLED'].includes(tx.status)) {
    throw new Error(`Cannot cancel transaction in status ${tx.status}`)
  }

  const provider = getProvider(tx.provider)
  await provider.cancel(tx)

  return updateTransaction(txId, { status: 'CANCELLED' })
}

// Re-export read methods for convenience
export { getTransaction, getTransactions }
export type { TransactionFilter, TransactionPage }
