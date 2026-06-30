import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult, ProviderName } from '../types'

// ─── Abstract provider contract ───────────────────────────────────────────────
// Every payment provider must implement this interface.
// Manual/Cash providers approve synchronously.
// Real gateways (Stripe, CMI, Payzone) will call external APIs.

export interface IPaymentProvider {
  readonly name: ProviderName

  /**
   * Initiate authorization (pre-auth / hold).
   * For manual/cash providers this is a no-op that resolves immediately.
   */
  authorize(
    tx: PaymentTransaction,
    metadata?: Record<string, unknown>,
  ): Promise<AuthorizeResult>

  /**
   * Capture the authorized amount (completes the payment).
   */
  capture(
    tx: PaymentTransaction,
    metadata?: Record<string, unknown>,
  ): Promise<CaptureResult>

  /**
   * Refund a completed payment, full or partial.
   */
  refund(
    tx: PaymentTransaction,
    amount?: number,
    reason?: string,
  ): Promise<RefundResult>

  /**
   * Cancel a pending / authorized payment before capture.
   */
  cancel(tx: PaymentTransaction): Promise<void>
}
