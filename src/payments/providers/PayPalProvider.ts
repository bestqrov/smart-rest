import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── PayPal provider — STUB ───────────────────────────────────────────────────
// Future: Call PayPal Orders API v2.
// Auth: OAuth2 client_credentials with PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET.

export class PayPalProvider implements IPaymentProvider {
  readonly name = 'PAYPAL' as const

  private notImplemented(): never {
    throw new Error('PayPal provider is not yet enabled.')
  }

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult>  { return this.notImplemented() }
  async capture(_tx: PaymentTransaction):   Promise<CaptureResult>    { return this.notImplemented() }
  async refund(_tx: PaymentTransaction):    Promise<RefundResult>     { return this.notImplemented() }
  async cancel(_tx: PaymentTransaction):    Promise<void>             { return this.notImplemented() }
}
