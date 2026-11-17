/**
 * Payment Router — Africa Mobile Money pack.
 * (Gulf online payments live in routes/onlinePayment.ts.)
 *
 *   Africa Pack (Mobile Money)
 *     POST /api/payment/mobilemoney/init    → generate QR payloads + save session
 *     POST /api/payment/mobilemoney/confirm → staff confirms payment (admin JWT)
 *
 * Security:
 *   - Mobile Money confirm requires admin JWT
 */

import express, { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { buildMobileMoneyPayloads } from '../services/mobileMoneyQR'
import { emitKdsTicket } from '../services/kds'
import { autoCheckInReservationForTable } from '../reservations/ReservationService'
import { OnlinePaymentMethod, OnlinePaymentStatus } from '@prisma/client'

const router = express.Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  // Commission is applied once, when this order later reaches COMPLETED via the
  // normal kitchen/waiter flow (PATCH /api/orders/:orderId/status ->
  // completeOrderFinancials in orderCompletion.ts) — same lifecycle as every
  // other order type. Do NOT apply it here too: this order starts PENDING, so
  // the COMPLETED-transition guard elsewhere would fire again and double-charge.

  if (io) await emitKdsTicket(io, order.id)

  await autoCheckInReservationForTable(cafeId, physicalTableId)

  return order
}

// Gulf payments moved to routes/onlinePayment.ts — they now charge through the
// RESTAURANT's own gateway account (Tap / Moyasar / Stripe) instead of the
// platform's STRIPE_SECRET_KEY / MOYASAR_SECRET_KEY.

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
