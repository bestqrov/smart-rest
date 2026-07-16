/**
 * Payment Router — handles two market packs:
 *
 *   Gulf Pack (Stripe / Moyasar)
 *     POST /api/payment/gulf/checkout        → create Stripe Checkout Session
 *     POST /api/payment/gulf/stripe-webhook  → Stripe webhook → confirm order + emit KDS
 *     POST /api/payment/moyasar/webhook      → Moyasar webhook → confirm order + emit KDS
 *     GET  /api/payment/gulf/status/:id      → poll payment status
 *
 *   Africa Pack (Mobile Money)
 *     POST /api/payment/mobilemoney/init    → generate QR payloads + save session
 *     POST /api/payment/mobilemoney/confirm → staff confirms payment (admin JWT)
 *
 * Security:
 *   - Stripe webhook verified with raw body + STRIPE_WEBHOOK_SECRET
 *   - Moyasar webhook verified via HMAC-SHA256
 *   - Mobile Money confirm requires admin JWT
 */

import express, { Request, Response } from 'express'
// stripe v22 ships ESM-first types — use direct resource imports for type hints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStripe = any
import type { Server as SocketIOServer } from 'socket.io'
import crypto from 'crypto'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { buildMobileMoneyPayloads } from '../services/mobileMoneyQR'
import { emitKdsTicket } from '../services/kds'
import { applyOrderFee } from '../services/billing'
import { autoCheckInReservationForTable } from '../reservations/ReservationService'
import { OnlinePaymentMethod, OnlinePaymentStatus } from '@prisma/client'

const router = express.Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): AnyStripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return new StripeLib(key)
}

const GULF_COUNTRIES   = new Set(['SA', 'AE', 'KW', 'QA', 'BH', 'OM'])
const AFRICA_COUNTRIES = new Set([
  'MA','SN','CI','MR','TN','DZ','LY','SD','NG','GH','KE','TZ',
  'UG','ZM','CM','BJ','TG','ML','BF','NE','GN','SL','LR','GM','GW',
  'MZ','AO','CD','CG','GA',
])

function marketTypeOf(country: string): 'Gulf' | 'Africa' | 'Global' {
  if (GULF_COUNTRIES.has(country)) return 'Gulf'
  if (AFRICA_COUNTRIES.has(country)) return 'Africa'
  return 'Global'
}

type OrderItemInput = { productId: string; quantity: number; notes?: string }

interface CheckoutBody {
  tableToken?:    string
  seatToken?:     string
  customerPhone?: string
  items:          OrderItemInput[]
  successUrl:     string
  cancelUrl:      string
}

// ─── Shared: resolve table/cafe context from QR token ────────────────────────

async function resolveTableContext(tableToken?: string, seatToken?: string) {
  if (seatToken) {
    const seat = await prisma.seat.findUnique({
      where: { qrToken: seatToken },
      include: {
        table: { select: { id: true, cafeId: true, isActive: true, mergedIntoTableId: true, tableNumber: true } }
      }
    })
    if (!seat || !seat.table.isActive) throw new Error('Invalid seat token')
    return {
      cafeId:          seat.cafeId,
      tableId:         seat.table.mergedIntoTableId ?? seat.table.id,
      physicalTableId: seat.table.id,
      tableNumber:     seat.table.tableNumber,
      seatId:          seat.id,
      seatNumber:      seat.seatNumber,
    }
  }
  if (tableToken) {
    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || !table.isActive) throw new Error('Invalid table token')
    return {
      cafeId:          table.cafeId,
      tableId:         table.mergedIntoTableId ?? table.id,
      physicalTableId: table.id,
      tableNumber:     table.tableNumber,
      seatId:          null,
      seatNumber:      null,
    }
  }
  throw new Error('Provide tableToken or seatToken')
}

// ─── Shared: create a paid Order and emit KDS ────────────────────────────────

async function confirmAndCreateOrder(opts: {
  cafeId:          string
  tableId:         string
  physicalTableId: string
  seatId:          string | null
  seatNumber:      number | null
  items:           OrderItemInput[]
  totalPrice:      number
  customerPhone?:  string
  paymentSessionId: string
  io:              SocketIOServer | null
}) {
  const { cafeId, tableId, physicalTableId, seatId, seatNumber, items, totalPrice, customerPhone, paymentSessionId, io } = opts

  const productIds = items.map(i => i.productId)
  const products   = await prisma.product.findMany({
    where:  { id: { in: productIds }, isAvailable: true, category: { cafeId } },
    select: { id: true, price: true, commissionRate: true }
  })
  if (products.length !== productIds.length) throw new Error('Product mismatch')

  const priceMap = new Map(products.map(p => [p.id, p.price]))
  const commMap  = new Map(products.map(p => [p.id, p.commissionRate]))

  // Recompute total from DB prices — reject if client-sent total doesn't match
  const computedTotal = parseFloat(
    items.reduce((sum, it) => sum + (priceMap.get(it.productId) ?? 0) * it.quantity, 0).toFixed(2)
  )
  const clientTotal = parseFloat(Number(totalPrice).toFixed(2))
  if (Math.abs(computedTotal - clientTotal) > 0.02) {
    throw new Error(`Price mismatch: client sent ${clientTotal}, server computed ${computedTotal}`)
  }

  // Pre-compute per-item data and commission total before entering the transaction
  let totalComm = 0
  const itemsData = items.map(it => {
    const unitPrice      = priceMap.get(it.productId) ?? 0
    const commissionRate = commMap.get(it.productId)  ?? 0
    totalComm           += unitPrice * commissionRate * it.quantity
    return {
      product:      { connect: { id: it.productId } },
      quantity:     it.quantity,
      notes:        it.notes ?? null,
      unitPrice,
      commissionRate,
    }
  })

  // Atomic: create order + confirm payment session in a single transaction
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        cafe:          { connect: { id: cafeId } },
        table:         { connect: { id: tableId } },
        originalTable: { connect: { id: physicalTableId } },
        ...(seatId ? { seat: { connect: { id: seatId } }, seatNumber } : {}),
        status:        'PENDING',
        paymentMethod: 'ONLINE',
        isPaid:        true,
        totalPrice:    computedTotal,
        totalCommission: totalComm,
        customerPhone: customerPhone ?? null,
        orderSource:   'QR_CODE',
        billStatus:    'OPENED',
        waiterNotification: { type: 'none', isActive: false },
        items: { create: itemsData },
      }
    })
    await tx.onlinePayment.update({
      where: { id: paymentSessionId },
      data:  { orderId: order.id, status: 'PAID', confirmedAt: new Date() }
    })
    return order
  })

  const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })
  if (cafe) {
    await applyOrderFee(
      prisma as unknown as import('@prisma/client').Prisma.TransactionClient,
      cafeId, order.id, totalPrice, cafe.country, false, items.length
    )
  }

  if (io) await emitKdsTicket(io, order.id)

  await autoCheckInReservationForTable(cafeId, physicalTableId)

  return order
}

// ════════════════════════════════════════════════════════════════════════════
//  GULF PACK — STRIPE
// ════════════════════════════════════════════════════════════════════════════

router.post('/api/payment/gulf/checkout', async (req: Request, res: Response) => {
  try {
    const { tableToken, seatToken, customerPhone, items, successUrl, cancelUrl } = req.body as CheckoutBody

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] required' })
    }

    const ctx  = await resolveTableContext(tableToken, seatToken)
    const cafe = await prisma.cafe.findUnique({
      where:  { id: ctx.cafeId },
      select: { isActive: true, country: true, currency: true, paymentConfig: true }
    })
    if (!cafe?.isActive) return res.status(403).json({ error: 'Venue unavailable' })
    if (marketTypeOf(cafe.country) !== 'Gulf') {
      return res.status(400).json({ error: 'Gulf pack only available for Gulf countries' })
    }

    const productIds = items.map(i => i.productId)
    const products   = await prisma.product.findMany({
      where:  { id: { in: productIds }, isAvailable: true, category: { cafeId: ctx.cafeId } },
      select: { id: true, price: true, nameEn: true, imageUrl: true }
    })
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more items unavailable' })
    }

    const priceMap = new Map(products.map(p => [p.id, p]))
    let   totalAmt = 0
    const lineItems: AnyStripe[] = []

    for (const it of items) {
      const prod = priceMap.get(it.productId)!
      const qty  = Math.max(1, Math.round(it.quantity))
      totalAmt  += prod.price * qty
      lineItems.push({
        price_data: {
          currency:     cafe.currency.toLowerCase(),
          unit_amount:  Math.round(prod.price * 100),
          product_data: {
            name:   prod.nameEn,
            ...(prod.imageUrl ? { images: [prod.imageUrl] } : {}),
          },
        },
        quantity: qty,
      })
    }

    const paySession = await prisma.onlinePayment.create({
      data: {
        cafe:          { connect: { id: ctx.cafeId } },
        amount:        totalAmt,
        currency:      cafe.currency,
        method:        OnlinePaymentMethod.STRIPE,
        status:        OnlinePaymentStatus.PENDING,
        tableToken:    tableToken ?? null,
        seatToken:     seatToken  ?? null,
        customerPhone: customerPhone ?? null,
        itemsSnapshot: items,
        expiresAt:     new Date(Date.now() + 30 * 60 * 1000),
      }
    })

    const session = await getStripe().checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items:           lineItems,
      success_url:          `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:           cancelUrl,
      client_reference_id:  paySession.id,
      metadata: {
        paySessionId:  paySession.id,
        cafeId:        ctx.cafeId,
        tableToken:    tableToken    ?? '',
        seatToken:     seatToken     ?? '',
        customerPhone: customerPhone ?? '',
      },
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    await prisma.onlinePayment.update({
      where: { id: paySession.id },
      data:  { stripeSessionId: session.id }
    })

    return res.json({ sessionId: session.id, url: session.url })

  } catch (err) {
    logger.error({ msg: 'Gulf checkout error', err })
    return res.status(500).json({ error: 'Checkout creation failed' })
  }
})

// ─── Poll status ──────────────────────────────────────────────────────────────

router.get('/api/payment/gulf/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const pay = await prisma.onlinePayment.findFirst({
      where:  { stripeSessionId: req.params.sessionId as string },
      select: { status: true, orderId: true }
    })
    if (!pay) return res.status(404).json({ error: 'Session not found' })
    return res.json({ status: pay.status, orderId: pay.orderId })
  } catch (err) {
    return res.status(500).json({ error: 'Status check failed' })
  }
})

// ─── Stripe webhook (raw body — mounted before bodyParser in server.ts) ───────

router.post(
  '/api/payment/gulf/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig    = req.headers['stripe-signature'] as string
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return res.status(500).send('Webhook secret not configured')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, secret)
    } catch (err) {
      logger.warn({ msg: 'Stripe webhook signature failed', err })
      return res.status(400).send('Webhook signature verification failed')
    }

    // Idempotency guard — if Stripe retries the webhook we skip already-processed events
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const stripeEventId = event.id as string
    try {
      await prisma.processedWebhook.create({ data: { provider: 'stripe', eventId: stripeEventId } })
    } catch {
      // Unique constraint violation → already processed; acknowledge and return
      return res.status(200).send('ok')
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (event.type === 'checkout.session.completed') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const session = event.data.object as Record<string, unknown>
      const meta    = session.metadata as Record<string, string> | undefined
      const payId   = meta?.paySessionId
      if (!payId) return res.status(200).send('ok')

      try {
        const pay = await prisma.onlinePayment.findUnique({
          where:  { id: payId },
          select: { id: true, cafeId: true, status: true, tableToken: true, seatToken: true, customerPhone: true, itemsSnapshot: true }
        })
        if (!pay || pay.status !== 'PENDING') return res.status(200).send('ok')

        const ctx   = await resolveTableContext(pay.tableToken ?? undefined, pay.seatToken ?? undefined)
        const io    = req.app.get('io') as SocketIOServer | null
        const items = pay.itemsSnapshot as OrderItemInput[]
        const amountTotal = (session.amount_total as number | null) ?? 0

        await confirmAndCreateOrder({
          cafeId:          pay.cafeId,
          tableId:         ctx.tableId,
          physicalTableId: ctx.physicalTableId,
          seatId:          ctx.seatId,
          seatNumber:      ctx.seatNumber,
          items,
          totalPrice:      amountTotal / 100,
          customerPhone:   pay.customerPhone ?? undefined,
          paymentSessionId: pay.id,
          io,
        })

        await prisma.onlinePayment.update({
          where: { id: payId },
          data:  { stripePaymentIntent: session.payment_intent as string }
        })

      } catch (err) {
        logger.error({ msg: 'Stripe webhook order creation failed', err, payId })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (event.type === 'checkout.session.expired') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const session = event.data.object as Record<string, unknown>
      const meta    = session.metadata as Record<string, string> | undefined
      const payId   = meta?.paySessionId
      if (payId) {
        await prisma.onlinePayment.updateMany({
          where: { id: payId, status: 'PENDING' },
          data:  { status: 'EXPIRED' }
        }).catch(() => null)
      }
    }

    return res.status(200).send('ok')
  }
)

// ─── Moyasar webhook ──────────────────────────────────────────────────────────

router.post('/api/payment/moyasar/webhook', async (req: Request, res: Response) => {
  try {
    const secret    = process.env.MOYASAR_SECRET_KEY
    const signature = req.headers['x-moyasar-signature'] as string | undefined

    // Signature verification is REQUIRED when MOYASAR_SECRET_KEY is configured.
    // Reject ALL requests when the key is set but signature is absent or invalid.
    if (secret) {
      if (!signature) return res.status(401).json({ error: 'Missing Moyasar signature' })
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex')
      if (expected !== signature) {
        logger.warn({ msg: 'Moyasar webhook signature mismatch' })
        return res.status(400).json({ error: 'Invalid signature' })
      }
    } else {
      // Key not configured — block in production, log warning
      if (process.env.NODE_ENV === 'production') {
        logger.error({ msg: 'Moyasar webhook received but MOYASAR_SECRET_KEY not set — rejecting' })
        return res.status(500).json({ error: 'Webhook not configured' })
      }
    }

    const { type, data } = req.body as { type: string; data: Record<string, unknown> }
    const moyasarId = data?.id as string | undefined

    // Idempotency guard — deduplicate Moyasar event replays
    if (moyasarId) {
      try {
        await prisma.processedWebhook.create({ data: { provider: 'moyasar', eventId: moyasarId } })
      } catch {
        return res.status(200).json({ ok: true })
      }
    }

    if (type === 'payment_paid') {
      const pay = moyasarId ? await prisma.onlinePayment.findFirst({
        where:  { moyasarPaymentId: moyasarId, status: 'PENDING' },
        select: { id: true, cafeId: true, tableToken: true, seatToken: true, customerPhone: true, itemsSnapshot: true }
      }) : null
      if (!pay) return res.status(200).json({ ok: true })

      const ctx   = await resolveTableContext(pay.tableToken ?? undefined, pay.seatToken ?? undefined)
      const io    = req.app.get('io') as SocketIOServer | null
      const items = pay.itemsSnapshot as OrderItemInput[]

      await confirmAndCreateOrder({
        cafeId:          pay.cafeId,
        tableId:         ctx.tableId,
        physicalTableId: ctx.physicalTableId,
        seatId:          ctx.seatId,
        seatNumber:      ctx.seatNumber,
        items,
        totalPrice:      Number(data.amount) / 100,
        customerPhone:   pay.customerPhone ?? undefined,
        paymentSessionId: pay.id,
        io,
      })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'Moyasar webhook error', err })
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  AFRICA PACK — MOBILE MONEY
// ════════════════════════════════════════════════════════════════════════════

router.post('/api/payment/mobilemoney/init', async (req: Request, res: Response) => {
  try {
    const { tableToken, seatToken, customerPhone, items } = req.body as Omit<CheckoutBody, 'successUrl' | 'cancelUrl'>

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] required' })
    }

    const ctx  = await resolveTableContext(tableToken, seatToken)
    const cafe = await prisma.cafe.findUnique({
      where:  { id: ctx.cafeId },
      select: { isActive: true, country: true, currency: true, paymentConfig: true }
    })
    if (!cafe?.isActive) return res.status(403).json({ error: 'Venue unavailable' })
    if (marketTypeOf(cafe.country) !== 'Africa') {
      return res.status(400).json({ error: 'Mobile Money only available for African markets' })
    }

    const productIds = items.map(i => i.productId)
    const products   = await prisma.product.findMany({
      where:  { id: { in: productIds }, isAvailable: true, category: { cafeId: ctx.cafeId } },
      select: { id: true, price: true, nameEn: true }
    })
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more items unavailable' })
    }

    const priceMap    = new Map(products.map(p => [p.id, p]))
    let   total       = 0
    const itemSummary: { name: string; qty: number }[] = []

    for (const it of items) {
      const prod = priceMap.get(it.productId)!
      const qty  = Math.max(1, Math.round(it.quantity))
      total     += prod.price * qty
      itemSummary.push({ name: prod.nameEn, qty })
    }

    const paySession = await prisma.onlinePayment.create({
      data: {
        cafe:          { connect: { id: ctx.cafeId } },
        amount:        total,
        currency:      cafe.currency,
        method:        OnlinePaymentMethod.ORANGE_MONEY,
        status:        OnlinePaymentStatus.PENDING,
        tableToken:    tableToken ?? null,
        seatToken:     seatToken  ?? null,
        customerPhone: customerPhone ?? null,
        itemsSnapshot: items,
        expiresAt:     new Date(Date.now() + 60 * 60 * 1000),
      }
    })

    const pc = cafe.paymentConfig
    const config = {
      orangeMoneyNumber: pc?.orangeMoneyNumber ?? '',
      mtnMoMoNumber:     pc?.mtnMoMoNumber     ?? '',
      waveWallet:        pc?.waveWallet         ?? '',
    }
    const payloads = await buildMobileMoneyPayloads(
      config,
      { total, currency: cafe.currency, tableNumber: ctx.tableNumber, items: itemSummary, orderId: paySession.id },
      cafe.country,
    )

    return res.json({
      paySessionId: paySession.id,
      total,
      currency:    cafe.currency,
      tableNumber: ctx.tableNumber,
      expiresAt:   paySession.expiresAt,
      operators:   payloads,
    })

  } catch (err) {
    logger.error({ msg: 'Mobile Money init error', err })
    return res.status(500).json({ error: 'Payment init failed' })
  }
})

router.post('/api/payment/mobilemoney/confirm', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { paySessionId, operator, mobileMoneyRef } = req.body as {
      paySessionId:    string
      operator:        'orange' | 'mtn' | 'wave'
      mobileMoneyRef?: string
    }

    const pay = await prisma.onlinePayment.findUnique({
      where:  { id: paySessionId },
      select: { id: true, cafeId: true, status: true, amount: true, tableToken: true, seatToken: true, customerPhone: true, itemsSnapshot: true, expiresAt: true }
    })
    if (!pay)                             return res.status(404).json({ error: 'Payment session not found' })
    if (pay.cafeId !== req.admin!.cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (pay.status !== 'PENDING')         return res.status(409).json({ error: 'Payment already processed' })
    if (new Date() > pay.expiresAt) {
      await prisma.onlinePayment.updateMany({ where: { id: paySessionId, status: 'PENDING' }, data: { status: 'EXPIRED' } })
      return res.status(410).json({ error: 'Payment session expired — please start a new payment' })
    }

    const methodMap: Record<string, OnlinePaymentMethod> = {
      orange: OnlinePaymentMethod.ORANGE_MONEY,
      mtn:    OnlinePaymentMethod.MTN_MOMO,
      wave:   OnlinePaymentMethod.WAVE,
    }

    await prisma.onlinePayment.update({
      where: { id: paySessionId },
      data:  { method: methodMap[operator] ?? OnlinePaymentMethod.ORANGE_MONEY, mobileMoneyOperator: operator, mobileMoneyRef: mobileMoneyRef ?? null }
    })

    const ctx   = await resolveTableContext(pay.tableToken ?? undefined, pay.seatToken ?? undefined)
    const io    = req.app.get('io') as SocketIOServer | null
    const items = pay.itemsSnapshot as OrderItemInput[]

    const order = await confirmAndCreateOrder({
      cafeId:          pay.cafeId,
      tableId:         ctx.tableId,
      physicalTableId: ctx.physicalTableId,
      seatId:          ctx.seatId,
      seatNumber:      ctx.seatNumber,
      items,
      totalPrice:      pay.amount,
      customerPhone:   pay.customerPhone ?? undefined,
      paymentSessionId: pay.id,
      io,
    })

    return res.json({ ok: true, orderId: order.id })

  } catch (err) {
    logger.error({ msg: 'Mobile Money confirm error', err })
    return res.status(500).json({ error: 'Confirm failed' })
  }
})

export default router
