// ─── Bill payment via the restaurant's own gateway ───────────────────────────
// Customer (QR table page) pays every unpaid order of THEIR client session.
//
// Flow:
//   start()  → sum unpaid orders server-side → OnlinePayment(PENDING) → hosted page URL
//   verify() → re-fetch status from the provider with the restaurant's key
//              → claim PENDING→PAID atomically → mark those orders paid
//
// Orders are marked isPaid / ONLINE / CLOSED_VIRTUAL but their kitchen status is
// NOT changed: commission, inventory and loyalty still run exactly once, when the
// order reaches COMPLETED through the normal flow (orders.ts / waiter.ts).

import type { Server as SocketIOServer } from 'socket.io'
import prisma from '../../prisma'
import logger from '../../logger'
import { decryptSecret } from './secretBox'
import { releaseSettledSessions } from '../../tables/sessionRelease'
import { getPlanAccess } from '../../billing/planAccess'
import { createCheckout, fetchStatus, minorFactor, type OnlineProvider, ONLINE_PROVIDERS } from './gateways'

export class BillPaymentError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) { super(message) }
}

const PAYMENT_TTL_MS = 30 * 60 * 1000

async function loadGateway(cafeId: string) {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { id: true, name: true, isActive: true, currency: true, paymentConfig: true },
  })
  if (!cafe?.isActive) throw new BillPaymentError('VENUE_UNAVAILABLE', 'Venue unavailable', 403)
  const pc       = cafe.paymentConfig
  const provider = pc?.onlineProvider as OnlineProvider | ''
  if (!provider || !ONLINE_PROVIDERS.includes(provider) || !pc?.onlineSecretEnc) {
    throw new BillPaymentError('NOT_CONFIGURED', 'Online payment is not enabled for this venue')
  }
  return { cafe, provider, secretKey: decryptSecret(pc.onlineSecretEnc) }
}

export async function startBillPayment(sessionId: string, origin: string) {
  const session = await prisma.clientSession.findUnique({
    where:  { id: sessionId },
    select: { id: true, cafeId: true, expiresAt: true },
  })
  if (!session || session.expiresAt <= new Date()) {
    throw new BillPaymentError('SESSION_EXPIRED', 'Session expired', 401)
  }

  if (!(await getPlanAccess(session.cafeId)).features.onlinePayment) {
    throw new BillPaymentError('NOT_CONFIGURED', 'Online payment is not enabled for this venue')
  }
  const { cafe, provider, secretKey } = await loadGateway(session.cafeId)

  const orders = await prisma.order.findMany({
    where:  { cafeId: cafe.id, sessionId: session.id, isPaid: false, status: { not: 'CANCELLED' } },
    select: { id: true, totalPrice: true },
  })
  const amount = Math.round(orders.reduce((s, o) => s + o.totalPrice, 0) * minorFactor(cafe.currency)) / minorFactor(cafe.currency)
  if (!orders.length || amount <= 0) throw new BillPaymentError('NOTHING_TO_PAY', 'No unpaid orders')

  const pay = await prisma.onlinePayment.create({
    data: {
      cafe:            { connect: { id: cafe.id } },
      amount,
      currency:        cafe.currency,
      method:          provider,
      status:          'PENDING',
      clientSessionId: session.id,
      orderIds:        orders.map(o => o.id),
      expiresAt:       new Date(Date.now() + PAYMENT_TTL_MS),
    },
  })

  try {
    const { providerRef, redirectUrl } = await createCheckout(provider, {
      secretKey,
      amount,
      currency:    cafe.currency,
      payId:       pay.id,
      description: `${cafe.name} — bill`,
      returnUrl:   `${origin}/pay/return?p=${pay.id}`,
      callbackUrl: `${origin}/api/payment/online/callback/${pay.id}`,
    })
    await prisma.onlinePayment.update({ where: { id: pay.id }, data: { providerRef } })
    return { payId: pay.id, redirectUrl, amount, currency: cafe.currency }
  } catch (err) {
    await prisma.onlinePayment.update({ where: { id: pay.id }, data: { status: 'FAILED' } }).catch(() => null)
    logger.error({ msg: 'Bill payment: checkout creation failed', cafeId: cafe.id, provider, err: (err as Error).message })
    throw new BillPaymentError('GATEWAY_ERROR', 'Payment gateway unavailable', 502)
  }
}

export async function verifyBillPayment(payId: string, io: SocketIOServer | null) {
  const pay = await prisma.onlinePayment.findUnique({ where: { id: payId } })
  if (!pay || !pay.clientSessionId) throw new BillPaymentError('NOT_FOUND', 'Payment not found', 404)
  if (pay.status !== 'PENDING' || !pay.providerRef) return { status: pay.status }

  const { provider, secretKey } = await loadGateway(pay.cafeId)
  const st = await fetchStatus(provider, secretKey, pay.providerRef)

  if (st.failed) {
    await prisma.onlinePayment.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'FAILED' } })
    return { status: 'FAILED' as const }
  }
  if (!st.paid) {
    if (pay.expiresAt < new Date(Date.now() - PAYMENT_TTL_MS)) {
      await prisma.onlinePayment.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
      return { status: 'EXPIRED' as const }
    }
    return { status: 'PENDING' as const }
  }

  // Paid at the provider — make sure it is the amount and currency we asked for.
  const tolerance = 1 / minorFactor(pay.currency)
  if (st.currency !== pay.currency.toUpperCase() || st.amount + tolerance < pay.amount) {
    logger.error({ msg: 'Bill payment: amount/currency mismatch — NOT settling', payId, expected: [pay.amount, pay.currency], got: [st.amount, st.currency] })
    await prisma.onlinePayment.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'FAILED' } })
    return { status: 'FAILED' as const }
  }

  // Atomic claim — concurrent callback + return-page verify can't both settle.
  const claim = await prisma.onlinePayment.updateMany({
    where: { id: pay.id, status: 'PENDING' },
    data:  { status: 'PAID', confirmedAt: new Date() },
  })
  if (claim.count !== 1) return { status: 'PAID' as const }

  const settled = await prisma.order.updateMany({
    where: { id: { in: pay.orderIds }, cafeId: pay.cafeId, isPaid: false },
    data:  { isPaid: true, paymentMethod: 'ONLINE', billStatus: 'CLOSED_VIRTUAL', paidAt: new Date() },
  })
  logger.info({ msg: 'Bill paid online', payId, cafeId: pay.cafeId, provider, amount: pay.amount, orders: settled.count })
  {
    const first = await prisma.order.findFirst({ where: { id: { in: pay.orderIds } }, select: { tableId: true } })
    await releaseSettledSessions(pay.cafeId, first?.tableId)
  }

  if (io) {
    const orders = await prisma.order.findMany({ where: { id: { in: pay.orderIds } }, select: { id: true, tableId: true } })
    const payload = { payId, amount: pay.amount, currency: pay.currency, orderIds: pay.orderIds, tableId: orders[0]?.tableId ?? null }
    io.to(`room_${pay.cafeId}`).emit('bill_paid_online', payload)
  }
  return { status: 'PAID' as const }
}
