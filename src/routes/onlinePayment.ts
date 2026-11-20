/**
 * Online bill payment through the RESTAURANT's own gateway (Tap / Moyasar / Stripe).
 *
 *   Customer (no auth — clientSession id is the secret, same as /api/orders/session/*)
 *     POST /api/payment/online/start                 { sessionId } → { redirectUrl }
 *     POST /api/payment/online/:payId/verify         → { status }
 *     GET|POST /api/payment/online/callback/:payId   provider server callback → verify
 *     POST /api/payment/online/:payId/receipt        { phone, lang } → WhatsApp receipt (PAID only, once)
 *
 *   Admin
 *     GET  /api/admin/cafe/online-gateway            → { provider, secretHint, encryptionReady }
 *     PUT  /api/admin/cafe/online-gateway            { provider, secretKey? } (validated against the provider)
 *
 * Callbacks are never trusted: every path re-fetches the payment from the
 * provider with the restaurant's secret key before anything is marked paid.
 */

import express, { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requirePlanFeature } from '../billing/planAccess'
import { startBillPayment, verifyBillPayment, BillPaymentError } from '../payments/online/BillPaymentService'
import { sendBillReceipt } from '../payments/online/receipt'
import { encryptSecret, isEncryptionConfigured } from '../payments/online/secretBox'
import { ONLINE_PROVIDERS, looksLikeSecretKey, testCredentials, type OnlineProvider } from '../payments/online/gateways'

const router = express.Router()
const OBJECT_ID = /^[a-f0-9]{24}$/i

function originOf(req: Request): string {
  return `${req.protocol}://${req.get('host')}`
}

function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof BillPaymentError) return res.status(err.httpStatus).json({ error: err.message, code: err.code })
  logger.error({ msg: fallback, err: (err as Error)?.message })
  return res.status(500).json({ error: fallback })
}

// ─── Customer ────────────────────────────────────────────────────────────────

router.post('/api/payment/online/start', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '')
    if (!OBJECT_ID.test(sessionId)) return res.status(400).json({ error: 'sessionId required' })
    return res.json(await startBillPayment(sessionId, originOf(req)))
  } catch (err) {
    return sendError(res, err, 'Could not start payment')
  }
})

router.post('/api/payment/online/:payId/verify', async (req: Request, res: Response) => {
  try {
    const payId = String(req.params.payId)
    if (!OBJECT_ID.test(payId)) return res.status(400).json({ error: 'Invalid id' })
    const io = req.app.get('io') as SocketIOServer | null
    return res.json(await verifyBillPayment(payId, io))
  } catch (err) {
    return sendError(res, err, 'Could not verify payment')
  }
})

router.post('/api/payment/online/:payId/receipt', async (req: Request, res: Response) => {
  try {
    const payId = String(req.params.payId)
    if (!OBJECT_ID.test(payId)) return res.status(400).json({ error: 'Invalid id' })
    return res.json(await sendBillReceipt(payId, String(req.body?.phone ?? ''), String(req.body?.lang ?? 'ar')))
  } catch (err) {
    return sendError(res, err, 'Could not send receipt')
  }
})

async function handleCallback(req: Request, res: Response) {
  const payId = String(req.params.payId)
  if (!OBJECT_ID.test(payId)) return res.status(200).json({ ok: true })
  try {
    await verifyBillPayment(payId, req.app.get('io') as SocketIOServer | null)
  } catch (err) {
    logger.warn({ msg: 'Online payment callback verify failed', payId, err: (err as Error)?.message })
  }
  return res.status(200).json({ ok: true })
}
router.get('/api/payment/online/callback/:payId', handleCallback)
router.post('/api/payment/online/callback/:payId', handleCallback)

// ─── Admin: restaurant connects its own gateway ──────────────────────────────

router.get('/api/admin/cafe/online-gateway', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafe = await prisma.cafe.findUnique({ where: { id: req.admin!.cafeId }, select: { paymentConfig: true, currency: true } })
    const pc   = cafe?.paymentConfig
    return res.json({
      provider:        pc?.onlineProvider || '',
      connected:       !!(pc?.onlineProvider && pc?.onlineSecretEnc),
      secretHint:      pc?.onlineSecretHint || '',
      currency:        cafe?.currency ?? '',
      encryptionReady: isEncryptionConfigured(),
    })
  } catch (err) {
    return sendError(res, err, 'Failed')
  }
})

router.put('/api/admin/cafe/online-gateway', authorizeAdmin, requirePlanFeature('onlinePayment'), async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const provider  = String(req.body?.provider ?? '') as OnlineProvider | ''
    const secretKey = String(req.body?.secretKey ?? '').trim()

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { paymentConfig: true } })
    const pc   = cafe?.paymentConfig ?? {}

    // Disconnect
    if (provider === '') {
      await prisma.cafe.update({
        where: { id: cafeId },
        data:  { paymentConfig: { ...pc, onlineProvider: '', onlineSecretEnc: '', onlineSecretHint: '' } as any },
      })
      return res.json({ ok: true, connected: false })
    }

    if (!ONLINE_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider', code: 'BAD_PROVIDER' })
    if (!isEncryptionConfigured()) return res.status(503).json({ error: 'Server encryption key missing', code: 'NO_ENCRYPTION' })
    if (!looksLikeSecretKey(provider, secretKey)) {
      return res.status(400).json({ error: 'This does not look like a secret key (sk_test_… / sk_live_…)', code: 'BAD_KEY_FORMAT' })
    }

    try {
      await testCredentials(provider, secretKey)
    } catch (err) {
      logger.warn({ msg: 'Gateway credential test failed', cafeId, provider, err: (err as Error)?.message })
      return res.status(400).json({ error: 'The gateway rejected this key', code: 'KEY_REJECTED' })
    }

    await prisma.cafe.update({
      where: { id: cafeId },
      data:  {
        paymentConfig: {
          ...pc,
          onlineProvider:   provider,
          onlineSecretEnc:  encryptSecret(secretKey),
          onlineSecretHint: secretKey.slice(-4),
        } as any,
      },
    })
    logger.info({ msg: 'Online gateway connected', cafeId, provider, live: secretKey.includes('_live_') })
    return res.json({ ok: true, connected: true, provider, secretHint: secretKey.slice(-4) })
  } catch (err) {
    return sendError(res, err, 'Failed to save gateway')
  }
})

export default router
