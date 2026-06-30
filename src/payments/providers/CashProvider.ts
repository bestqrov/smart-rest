import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── Cash provider ────────────────────────────────────────────────────────────
// Payment is collected in person. Authorize + capture auto-succeed.
// Refunds are handled offline (cash returned to customer).

export class CashProvider implements IPaymentProvider {
  readonly name = 'CASH' as const

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult> {
    return { reference: `CASH-${Date.now()}` }
  }

  async capture(_tx: PaymentTransaction): Promise<CaptureResult> {
    return { paidAt: new Date(), reference: `CASH-${Date.now()}` }
  }

  async refund(tx: PaymentTransaction, amount?: number): Promise<RefundResult> {
    return {
      refundedAt:   new Date(),
      refundAmount: amount ?? tx.amount,
      reference:    `CASH-REFUND-${Date.now()}`,
    }
  }

  async cancel(_tx: PaymentTransaction): Promise<void> {
    // cash is cancelled by not collecting it
  }
}
