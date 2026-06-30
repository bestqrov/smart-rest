import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── Manual provider ──────────────────────────────────────────────────────────
// Human reviews the transaction and marks it paid/failed through the admin UI.
// All provider calls are no-ops — the SuperAdmin drives state changes directly.

export class ManualProvider implements IPaymentProvider {
  readonly name = 'MANUAL' as const

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult> {
    return {}   // manual — awaiting human action
  }

  async capture(_tx: PaymentTransaction): Promise<CaptureResult> {
    return { paidAt: new Date() }
  }

  async refund(tx: PaymentTransaction, amount?: number): Promise<RefundResult> {
    return {
      refundedAt:   new Date(),
      refundAmount: amount ?? tx.amount,
    }
  }

  async cancel(_tx: PaymentTransaction): Promise<void> {
    // nothing to cancel externally
  }
}
