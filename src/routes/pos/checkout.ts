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

const router = express.Router()

router.patch('/api/pos/orders/:orderId/checkout', authorizePOS, async (req: Request, res: Response) => {
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

    const updated = await prisma.order.update({
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

    logger.info({ msg: 'POS checkout', orderId, staffId, totalCommission, method, billStatus })
    return res.json({ order: updated })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/orders/:orderId/checkout error', err })
    return res.status(500).json({ error: 'Checkout failed' })
  }
})

export default router
