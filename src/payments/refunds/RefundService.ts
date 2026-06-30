import { getProvider }      from '../providers/registry'
import { getTransaction, updateTransaction } from '../transactions/TransactionService'
import { eventBus }         from '../../core'
import type { PaymentTransaction } from '../types'

// ─── Refund Service ───────────────────────────────────────────────────────────

export async function refundTransaction(
  txId:    string,
  amount?: number,
  reason?: string,
): Promise<PaymentTransaction> {
  const tx = await getTransaction(txId)
  if (!tx) throw new Error(`Transaction ${txId} not found`)
  if (tx.status !== 'PAID') {
    throw new Error(`Cannot refund transaction in status ${tx.status}. Only PAID transactions can be refunded.`)
  }

  const refundAmount = amount ?? tx.amount
  if (refundAmount > tx.amount) {
    throw new Error(`Refund amount (${refundAmount}) cannot exceed original amount (${tx.amount})`)
  }

  const provider = getProvider(tx.provider)
  const result   = await provider.refund(tx, refundAmount, reason)

  const updated = await updateTransaction(txId, {
    status:       'REFUNDED',
    refundedAt:   result.refundedAt,
    refundAmount: result.refundAmount,
    reference:    result.reference ?? tx.reference,
    notes:        reason ?? tx.notes,
  })

  eventBus.publish('PaymentRefunded', {
    txId,
    orderId:      tx.orderId,
    tenantId:     tx.tenantId,
    amount:       tx.amount,
    refundAmount,
    currency:     tx.currency,
    reference:    result.reference,
  }, 'payment-engine')

  return updated
}
