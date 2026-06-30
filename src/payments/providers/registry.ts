import type { IPaymentProvider }    from './PaymentProvider'
import type { ProviderName }         from '../types'
import { ManualProvider }            from './ManualProvider'
import { CashProvider }              from './CashProvider'
import { BankTransferProvider }      from './BankTransferProvider'
import { StripeProvider }            from './StripeProvider'
import { PayPalProvider }            from './PayPalProvider'
import { CMIProvider }               from './CMIProvider'
import { PayzoneProvider }           from './PayzoneProvider'

// ─── Provider Registry ────────────────────────────────────────────────────────
// Singleton map of all registered payment providers.
// Only MANUAL, CASH, and BANK_TRANSFER are active.
// Others are stubs that throw NotImplemented errors.

const providers = new Map<ProviderName, IPaymentProvider>()
providers.set('MANUAL',        new ManualProvider())
providers.set('CASH',          new CashProvider())
providers.set('BANK_TRANSFER', new BankTransferProvider())
providers.set('STRIPE',        new StripeProvider())
providers.set('PAYPAL',        new PayPalProvider())
providers.set('CMI',           new CMIProvider())
providers.set('PAYZONE',       new PayzoneProvider())

export function getProvider(name: ProviderName): IPaymentProvider {
  const p = providers.get(name)
  if (!p) throw new Error(`Unknown payment provider: ${name}`)
  return p
}

export function listProviders(): ProviderName[] {
  return [...providers.keys()]
}

export const ACTIVE_PROVIDERS: ProviderName[] = ['MANUAL', 'CASH', 'BANK_TRANSFER']
