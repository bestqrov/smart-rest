import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── Stripe provider — STUB ───────────────────────────────────────────────────
// No Stripe SDK. No hardcoded keys.
// This stub exists to define the integration surface and throw a clear error
// until the provider is enabled via feature flag.
//
// Future implementation:
//   - Read STRIPE_SECRET_KEY from env
//   - Call Stripe API via node-fetch or the official SDK
//   - Map Stripe PaymentIntent statuses to PaymentStatus

export class StripeProvider implements IPaymentProvider {
  readonly name = 'STRIPE' as const

  private notImplemented(): never {
    throw new Error('Stripe provider is not yet enabled. Contact your SmartSuite administrator.')
  }

  async authorize(_tx: PaymentTransaction, _metadata?: Record<string, unknown>): Promise<AuthorizeResult> {
    return this.notImplemented()
  }

  async capture(_tx: PaymentTransaction): Promise<CaptureResult> {
    return this.notImplemented()
  }

  async refund(_tx: PaymentTransaction, _amount?: number): Promise<RefundResult> {
    return this.notImplemented()
  }

  async cancel(_tx: PaymentTransaction): Promise<void> {
    return this.notImplemented()
  }
}
