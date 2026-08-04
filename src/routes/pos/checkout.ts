/**
 * PATCH /api/pos/orders/:orderId/checkout
 *
 * Close a bill: recalculate per-item commission, mark isPaid, set billStatus.
 * Requires POS Bearer token (authorizePOS).
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
import { completeOrderFinancials, awardLoyaltyBestEffort } from '../../services/orderCompletion'

const router = express.Router()

router.patch('/api/pos/orders/:orderId/checkout', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const orderId = req.params['orderId'] as string
    const { paymentMethod, printReceipt } = req.body as {
      paymentMethod?: 'CASH' | 'CARD' | 'ONLINE'
      printReceipt?:  boolean
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId as string, cafeId },
      include: { items: { include: { product: true } } }
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.isPaid) return res.status(409).json({ error: 'Order is already paid' })
    if (order.billStatus === 'CLOSED_PRINTED' || order.billStatus === 'CLOSED_VIRTUAL') {
      return res.status(409).json({ error: 'Bill is already closed' })
    }

    // Recalculate commission from live item snapshots
    const totalCommission = order.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity * item.commissionRate,
      0
    )

    const billStatus = printReceipt ? 'CLOSED_PRINTED' : 'CLOSED_VIRTUAL'
    const method = paymentMethod ?? order.paymentMethod
    const wasCompleted = order.status === 'COMPLETED'

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          isPaid:          true,
          paymentMethod:   method,
          billStatus,
          totalCommission,
          status:          'COMPLETED'
        },
        include: { items: { include: { product: true } } }
      })

      if (!wasCompleted) {
        await completeOrderFinancials(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', order.items.length)
      }

      return result
    })

    if (!wasCompleted) {
      await awardLoyaltyBestEffort(cafeId, order.customerPhone, order.totalPrice, orderId)
    }

    logger.info({ msg: 'POS checkout', orderId, staffId, totalCommission, method, billStatus })
    return res.json({ order: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/orders/:orderId/checkout error', err })
    return res.status(500).json({ error: 'Checkout failed' })
  }
})

// ─── PATCH /api/pos/tables/:tableId/checkout — close ALL open orders for a table ──

router.patch('/api/pos/tables/:tableId/checkout', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const tableId = req.params['tableId'] as string
    const { paymentMethod, printReceipt } = req.body as {
      paymentMethod?: 'CASH' | 'CARD' | 'ONLINE'
      printReceipt?:  boolean
    }

    const orders = await prisma.order.findMany({
      where: { cafeId, tableId, isPaid: false, billStatus: { in: ['OPENED', 'BILL_REQUESTED'] } },
      include: { items: { include: { product: true } } }
    })

    if (!orders.length) return res.status(404).json({ error: 'No open orders for this table' })

    const billStatus = printReceipt ? 'CLOSED_PRINTED' : 'CLOSED_VIRTUAL'
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    const updated = await prisma.$transaction(async (tx) => {
      const results = []
      for (const o of orders) {
        const wasCompleted = o.status === 'COMPLETED'
        const result = await tx.order.update({
          where: { id: o.id },
          data: {
            isPaid:          true,
            paymentMethod:   paymentMethod ?? o.paymentMethod,
            billStatus,
            status:          'COMPLETED',
            totalCommission: o.items.reduce((s, i) => s + i.unitPrice * i.quantity * i.commissionRate, 0),
          },
          include: { items: { include: { product: true } } }
        })
        if (!wasCompleted) {
          await completeOrderFinancials(tx, cafeId, o.id, o.totalPrice, cafe?.country ?? 'MA', o.items.length)
        }
        results.push({ result, wasCompleted })
      }
      return results
    })

    for (const { result, wasCompleted } of updated) {
      if (!wasCompleted) {
        await awardLoyaltyBestEffort(cafeId, result.customerPhone, result.totalPrice, result.id)
      }
    }

    const totalPrice = updated.reduce((s, { result }) => s + result.totalPrice, 0)
    // Merge items by productId for receipt
    const itemMap = new Map<string, { name: string; quantity: number; unitPrice: number }>()
    for (const { result } of updated) {
      for (const i of result.items) {
        const ex = itemMap.get(i.productId)
        if (ex) { ex.quantity += i.quantity }
        else { itemMap.set(i.productId, { name: i.product.nameEn || i.product.nameAr || '', quantity: i.quantity, unitPrice: i.unitPrice }) }
      }
    }
    const items = Array.from(itemMap.values())
    const ordersOut = updated.map(({ result }) => result)

    logger.info({ msg: 'POS table checkout', tableId, staffId, orderCount: ordersOut.length, totalPrice })
    return res.json({ orders: ordersOut, totalPrice, items })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/tables/:tableId/checkout error', err })
    return res.status(500).json({ error: 'Checkout failed' })
  }
})

export default router
