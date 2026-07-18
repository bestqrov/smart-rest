// ─── Billing Payment Webhook ────────────────────────────────────────────────
// Generic confirmation endpoint for the billing payment provider (MANUAL by
// default; STRIPE etc. are registered as stubs in the payment engine and can
// be wired to call this same confirm/fail path once live keys are added).
//
// This endpoint can flip a transaction to PAID (which activates/renews the
// linked subscription), so it requires a shared secret even though no real
// gateway is wired yet — an open, unauthenticated confirm endpoint would let
// anyone grant themselves a paid subscription.
//
// Idempotency: reuses the platform's existing `ProcessedWebhook` dedup table
// (provider+eventId unique constraint) — the same pattern used by the
// Stripe/Moyasar order-payment webhooks in src/routes/payment.ts.

import { Router } from 'express'
import prisma from '../prisma'
import * as BillingPayments from '../billing/payments/BillingPaymentService'

const router = Router()

router.post('/api/billing/webhooks/payment', async (req, res) => {
  try {
    const secret = process.env.BILLING_WEBHOOK_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'Webhook not configured' })
    }
    if (req.headers['x-billing-webhook-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { eventId, txId, status, reason } = req.body as {
      eventId?: string; txId?: string; status?: 'PAID' | 'FAILED'; reason?: string
    }
    if (!eventId || !txId || !status) {
      return res.status(400).json({ error: 'eventId, txId, and status are required' })
    }

    try {
      await prisma.processedWebhook.create({ data: { provider: 'billing-manual', eventId } })
    } catch {
      // Unique constraint violation → already processed; ack idempotently
      return res.status(200).json({ ok: true, duplicate: true })
    }

    if (status === 'PAID') {
      await BillingPayments.confirmPayment(txId, 'webhook')
    } else {
      await BillingPayments.failPayment(txId, reason ?? 'Payment failed')
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Webhook processing failed' })
  }
})

export default router
