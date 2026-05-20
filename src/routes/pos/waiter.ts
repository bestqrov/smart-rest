/**
 * Waiter-specific routes — accessible with POS staff token (any role).
 *
 * GET  /api/pos/waiter/ready             — DELIVERED orders waiting to be served
 * PATCH /api/pos/waiter/orders/:id/served — mark order COMPLETED (served to table)
 */

import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import authorizePOS from '../../middleware/authorizePOS'
import prisma from '../../prisma'
import logger from '../../logger'
import { applyOrderFee } from '../../services/billing'
import { emitOrderStatusUpdate } from '../../services/kds'

const router = express.Router()

// ─── GET /api/pos/waiter/ready ────────────────────────────────────────────────

router.get('/api/pos/waiter/ready', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const orders = await prisma.order.findMany({
      where: { cafeId, status: 'DELIVERED' },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: { product: { select: { nameEn: true } } }
        },
        table:         { select: { tableNumber: true } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } }
      }
    })
    return res.json(orders)
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/waiter/ready error', err })
    return res.status(500).json({ error: 'Failed to fetch ready orders' })
  }
})

// ─── PATCH /api/pos/waiter/orders/:id/served ─────────────────────────────────

router.patch('/api/pos/waiter/orders/:id/served', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const orderId = req.params['id'] as string

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cafeId: true, status: true, totalPrice: true, tableId: true }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } })
      await applyOrderFee(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', false)
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) emitOrderStatusUpdate(io, cafeId, orderId, 'COMPLETED', order.tableId ?? null)

    return res.json({ orderId, status: 'COMPLETED' })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/waiter/orders served error', err })
    return res.status(500).json({ error: 'Failed to mark order as served' })
  }
})

export default router
