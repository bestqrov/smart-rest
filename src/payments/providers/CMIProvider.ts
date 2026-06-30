import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── CMI provider — STUB ──────────────────────────────────────────────────────
// CMI (Centre Monétique Interbancaire) — Moroccan interbank payment gateway.
// Future: Integrate CMI hosted payment page via POST redirect.
// Credentials: CMI_MERCHANT_ID, CMI_STORE_KEY from env.

export class CMIProvider implements IPaymentProvider {
  readonly name = 'CMI' as const

  private notImplemented(): never {
    throw new Error('CMI (Centre Monétique Interbancaire) provider is not yet enabled.')
  }

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult>  { return this.notImplemented() }
  async capture(_tx: PaymentTransaction):   Promise<CaptureResult>    { return this.notImplemented() }
  async refund(_tx: PaymentTransaction):    Promise<RefundResult>     { return this.notImplemented() }
  async cancel(_tx: PaymentTransaction):    Promise<void>             { return this.notImplemented() }
}
