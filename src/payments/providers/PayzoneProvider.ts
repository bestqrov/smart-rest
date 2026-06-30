import type { IPaymentProvider } from './PaymentProvider'
import type { PaymentTransaction, AuthorizeResult, CaptureResult, RefundResult } from '../types'

// ─── Payzone provider — STUB ──────────────────────────────────────────────────
// Payzone — Moroccan digital payment gateway.
// Future: REST integration using PAYZONE_API_KEY from env.

export class PayzoneProvider implements IPaymentProvider {
  readonly name = 'PAYZONE' as const

  private notImplemented(): never {
    throw new Error('Payzone provider is not yet enabled.')
  }

  async authorize(_tx: PaymentTransaction): Promise<AuthorizeResult>  { return this.notImplemented() }
  async capture(_tx: PaymentTransaction):   Promise<CaptureResult>    { return this.notImplemented() }
  async refund(_tx: PaymentTransaction):    Promise<RefundResult>     { return this.notImplemented() }
  async cancel(_tx: PaymentTransaction):    Promise<void>             { return this.notImplemented() }
}
