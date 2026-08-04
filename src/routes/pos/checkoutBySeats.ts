/**
 * POST /api/pos/checkout/by-seats
 *
 * Close all open orders for a table, optionally filtering to specific seat numbers.
 * Used for split-bill: TABLE scope closes every open order at the table; SEATS scope
 * closes only orders whose seatNumber is in the provided list.
 *
 * Body: { tableId, seatNumbers?: number[], paymentMethod?, printReceipt? }
 * Requires POS Bearer token (authorizePOS).
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'
import { completeOrderFinancials, awardLoyaltyBestEffort } from '../../services/orderCompletion'

const router = express.Router()

router.post('/api/pos/checkout/by-seats', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const {
      tableId,
      seatNumbers,
      paymentMethod,
      printReceipt,
    } = req.body as {
      tableId:        string
      seatNumbers?:   number[]
      paymentMethod?: 'CASH' | 'CARD' | 'ONLINE'
      printReceipt?:  boolean
    }

    if (!tableId) return res.status(400).json({ error: 'tableId is required' })

    const OBJECT_ID_RE = /^[a-f\d]{24}$/i
    if (!OBJECT_ID_RE.test(tableId)) return res.status(400).json({ error: 'Invalid tableId' })

    // Verify the table belongs to this cafe
    const table = await prisma.table.findFirst({
      where:  { id: tableId, cafeId },
      select: { id: true, tableNumber: true }
    })
    if (!table) return res.status(404).json({ error: 'Table not found' })

    // Validate seatNumbers when provided
    const seats: number[] = Array.isArray(seatNumbers)
      ? seatNumbers.filter(n => Number.isInteger(n) && n > 0)
      : []

    const scope = seats.length > 0 ? 'SEATS' : 'TABLE'

    // Find all open orders for the table
    const openOrders = await prisma.order.findMany({
      where: {
        tableId,
        cafeId,
        isPaid:     false,
        billStatus: { in: ['OPENED', 'BILL_REQUESTED'] },
      },
      include: { items: { include: { product: true } } }
    })

    if (openOrders.length === 0) {
      return res.status(404).json({ error: 'No open orders found for this table' })
    }

    // Filter by seat if scope is SEATS
    // Orders store seatNumber (from ClientSession at order creation time)
    const ordersToClose = scope === 'SEATS'
      ? openOrders.filter(o => o.seatNumber != null && seats.includes(o.seatNumber))
      : openOrders

    if (ordersToClose.length === 0) {
      return res.status(404).json({ error: 'No orders found for the specified seats' })
    }

    const billStatus = printReceipt ? 'CLOSED_PRINTED' : 'CLOSED_VIRTUAL'
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    // Close each order in a transaction
    const closedResults = await prisma.$transaction(async (tx) => {
      const results = []
      for (const order of ordersToClose) {
        const totalCommission = order.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity * item.commissionRate,
          0
        )
        const method = paymentMethod ?? order.paymentMethod

        // Atomic guard: isPaid: false in the where clause closes the race
        // where two concurrent split-bill checkout calls both process this order.
        const writeResult = await tx.order.updateMany({
          where: { id: order.id, isPaid: false },
          data: {
            isPaid:          true,
            paymentMethod:   method,
            billStatus,
            totalCommission,
            status:          'COMPLETED',
          }
        })
        const didComplete = writeResult.count === 1 && order.status !== 'COMPLETED'

        if (didComplete) {
          await completeOrderFinancials(tx, cafeId, order.id, order.totalPrice, cafe?.country ?? 'MA', order.items.length)
        }

        const result = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { id: true, tableId: true, seatNumber: true, totalPrice: true, customerPhone: true }
        })

        results.push({ result, didComplete })
      }
      return results
    })

    for (const { result, didComplete } of closedResults) {
      if (didComplete) {
        await awardLoyaltyBestEffort(cafeId, result.customerPhone, result.totalPrice, result.id)
      }
    }

    const closedOrders = closedResults.map(({ result }) => result)

    logger.info({
      msg:    'POS checkout by-seats',
      tableId,
      scope,
      seats,
      staffId,
      closedCount: closedOrders.length,
      billStatus,
    })

    return res.json({
      closed:      closedOrders.length,
      scope,
      seatNumbers: scope === 'SEATS' ? seats : [],
      orders:      closedOrders,
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/checkout/by-seats error', err })
    return res.status(500).json({ error: 'Checkout by seats failed' })
  }
})

export default router
