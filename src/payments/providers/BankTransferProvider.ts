import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── Bank Transfer provider ───────────────────────────────────────────────────
// Customer transfers funds. SuperAdmin confirms receipt by marking paid.
// No external API calls — human validates the bank statement.

export class BankTransferProvider implements IPaymentProvider {
  readonly name = 'BANK_TRANSFER' as const

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult> {
    return {}   // awaiting customer transfer + admin confirmation
  }

  async capture(tx: PaymentTransaction): Promise<CaptureResult> {
    return {
      paidAt:    new Date(),
      reference: tx.reference ?? `BT-${Date.now()}`,
    }
  }

  async refund(tx: PaymentTransaction, amount?: number): Promise<RefundResult> {
    return {
      refundedAt:   new Date(),
      refundAmount: amount ?? tx.amount,
      reference:    tx.reference ? `REFUND-${tx.reference}` : `BT-REFUND-${Date.now()}`,
    }
  }

  async cancel(_tx: PaymentTransaction): Promise<void> {
    // nothing to cancel externally
  }
}
