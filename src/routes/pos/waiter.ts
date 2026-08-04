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
import { completeOrderFinancials, awardLoyaltyBestEffort } from '../../services/orderCompletion'
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

// ─── GET /api/pos/waiter/today ────────────────────────────────────────────────
// Today's served/completed/cancelled orders — powers the "Today" history tab.
// Count-focused (no money totals) since the waiter view doesn't own payment.

router.get('/api/pos/waiter/today', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const orders = await prisma.order.findMany({
      where:   { cafeId, status: { in: ['COMPLETED', 'CANCELLED'] }, createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, createdAt: true, seatNumber: true,
        table:         { select: { tableNumber: true } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } },
        items: {
          select: {
            quantity: true,
            product: { select: { id: true, nameEn: true } },
          },
        },
      },
    })
    return res.json({ count: orders.length, orders })
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/waiter/today error', err })
    return res.status(500).json({ error: 'Failed to fetch today\'s orders' })
  }
})

// ─── PATCH /api/pos/waiter/orders/:id/served ─────────────────────────────────

router.patch('/api/pos/waiter/orders/:id/served', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const orderId = req.params['id'] as string

    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        id: true, cafeId: true, status: true, totalPrice: true, tableId: true,
        customerPhone: true, _count: { select: { items: true } }
      }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (order.status === 'COMPLETED') return res.json({ orderId, status: 'COMPLETED', message: 'Already completed' })

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    // Atomic guard: only the request that actually flips status away from
    // COMPLETED runs financials — closes the race where two concurrent
    // "served" calls both pass the pre-check above and both charge/deduct.
    const didComplete = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: { not: 'COMPLETED' } },
        data:  { status: 'COMPLETED' }
      })
      if (result.count === 1) {
        await completeOrderFinancials(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', order._count.items)
        return true
      }
      return false
    })

    if (didComplete) {
      await awardLoyaltyBestEffort(cafeId, order.customerPhone, order.totalPrice, orderId)
    }

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) emitOrderStatusUpdate(io, cafeId, orderId, 'COMPLETED', order.tableId ?? null)

    return res.json({ orderId, status: 'COMPLETED' })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/pos/waiter/orders served error', err })
    return res.status(500).json({ error: 'Failed to mark order as served' })
  }
})

// ─── PATCH /api/waiter/notifications/ack ─────────────────────────────────────
// Waiter dismisses an active notification (stops the POS beep/flash).
// Body: { orderId }   — clears waiterNotification.isActive on that specific order.

router.patch('/api/waiter/notifications/ack', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const { orderId } = req.body as { orderId?: string }

    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { cafeId: true, tableId: true, waiterNotification: true }
    })
    if (!order)              return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })

    // Preserve the notification type; only toggle isActive off
    const prevType = order.waiterNotification?.type ?? 'none'

    await prisma.order.update({
      where: { id: orderId },
      data:  {
        waiterNotification: {
          type:     prevType,
          isActive: false
        }
      }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${cafeId}`).emit('waiter_notification_acked', {
        orderId,
        tableId:  order.tableId,
        type:     prevType,
        isActive: false
      })
    }

    return res.json({ orderId, isActive: false })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/waiter/notifications/ack error', err })
    return res.status(500).json({ error: 'Failed to acknowledge notification' })
  }
})

export default router
