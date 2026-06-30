// ─── Payment Engine — Public API ──────────────────────────────────────────────
// Provider-agnostic payment layer for SmartSuite OS.
// Reusable by Marketplace, Billing, Hotels, Clinics, and future modules.

export * from './types'

export {
  createTransaction,
  authorize,
  markPaid,
  fail,
  refund,
  cancel,
  getTransaction,
  getTransactions,
} from './services/PaymentService'

export { getProvider, listProviders, ACTIVE_PROVIDERS } from './providers/registry'
export { refundTransaction } from './refunds/RefundService'

export type { IPaymentProvider } from './providers/PaymentProvider'

// ─── Engine Init ──────────────────────────────────────────────────────────────
// Subscribes to platform events and seeds any necessary defaults.
// Called once at server startup.

export async function initPaymentEngine(): Promise<void> {
  try {
    const { eventBus } = await import('../core')
    const { createTransaction } = await import('./services/PaymentService')

    // When a Marketplace Order is approved, auto-create a PENDING payment transaction.
    // This wires the order lifecycle to the payment lifecycle without touching order code.
    eventBus.subscribe('MarketplaceOrderApproved', async (event: any) => {
      try {
        const { orderId, tenantId, total, currency } = event.payload as Record<string, any>
        if (!orderId || !tenantId || !total) return

        // Check if a transaction already exists for this order
        const { default: prisma } = await import('../prisma')
        const existing = await (prisma as any).paymentTransaction.findFirst({
          where: { orderId, tenantId },
        })
        if (existing) return   // idempotent — don't create twice

        await createTransaction({
          orderId,
          tenantId,
          module:   'MARKETPLACE',
          provider: 'MANUAL',
          method:   'MANUAL',
          amount:   Number(total),
          currency: String(currency ?? 'MAD'),
          notes:    'Auto-created on order approval',
        })
      } catch {
        // Non-fatal — order approval must not fail due to payment init
      }
    })
  } catch {
    // Non-fatal — engine still works if event subscription fails
  }
}
