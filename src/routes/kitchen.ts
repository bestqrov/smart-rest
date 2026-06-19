/**
 * Kitchen Display System — HTTP REST endpoints
 *
 * PATCH /api/kitchen/orders/:orderId
 *   body: { status: 'preparing' | 'ready' }
 *   preparing → PENDING  → PREPARING  (chef acks order)
 *   ready     → PREPARING → DELIVERED  (kitchen done, notify waiter + customer)
 *
 * Auth: admin JWT (same credential used by the KDS browser session)
 * Multi-tenancy: authorizeKitchen validates orderId belongs to admin's cafeId
 */

import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { authorizeKitchen } from '../middleware/authorizeKitchen'
import logger from '../logger'
import prisma from '../prisma'
import { emitOrderStatusUpdate } from '../services/kds'

const router = express.Router()

// Map of incoming status label → Prisma OrderStatus target
const STATUS_TARGET: Record<string, 'PREPARING' | 'DELIVERED'> = {
  preparing: 'PREPARING',
  ready:     'DELIVERED'
}

// Allowed predecessor for each target status
const REQUIRED_PREDECESSOR: Record<'PREPARING' | 'DELIVERED', string> = {
  PREPARING: 'PENDING',
  DELIVERED: 'PREPARING'
}

// ─── PATCH /api/kitchen/orders/:orderId ───────────────────────────────────────

router.patch('/api/kitchen/orders/:orderId', authorizeKitchen, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const orderId = req.params.orderId as string
    const { status } = req.body as { status?: string }

    if (!status || !STATUS_TARGET[status]) {
      return res.status(400).json({
        error: 'Body field "status" must be "preparing" or "ready"'
      })
    }

    const targetStatus    = STATUS_TARGET[status]
    const requiredCurrent = REQUIRED_PREDECESSOR[targetStatus]

    // authorizeKitchen already confirmed the order belongs to this cafeId
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, tableId: true }
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })

    if (order.status !== requiredCurrent) {
      return res.status(422).json({
        error:    `Invalid transition: ${order.status} → ${targetStatus}`,
        current:  order.status,
        expected: requiredCurrent
      })
    }

    await prisma.order.update({
      where: { id: orderId },
      data:  { status: targetStatus }
    })

    // Broadcast: KDS room, admin room, customer table room
    // When DELIVERED also emits waiter_order_ready (handled inside emitOrderStatusUpdate)
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) emitOrderStatusUpdate(io, cafeId, orderId, targetStatus, order.tableId ?? null)

    return res.json({ orderId, status: targetStatus })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/kitchen/orders error', err })
    return res.status(500).json({ error: 'Failed to update kitchen order status' })
  }
})

// ─── GET /api/kitchen/orders/queue — pending + preparing orders ───────────────
// Replaces the two separate /api/orders?status= calls so kitchen page works
// with authorizeKitchen instead of needing the general admin orders route.

router.get('/api/kitchen/orders/queue', authorizeKitchen, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const orders = await prisma.order.findMany({
      where:   { cafeId, status: { in: ['PENDING', 'PREPARING'] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, status: true, totalPrice: true, createdAt: true, seatNumber: true,
        table:         { select: { tableNumber: true, mergedIntoTableId: true, mergedIntoTable: { select: { tableNumber: true } } } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } },
        items: {
          select: {
            quantity: true, notes: true,
            product: { select: { id: true, nameEn: true } },
          },
        },
      },
    })
    return res.json(orders)
  } catch (err) {
    logger.error({ msg: 'GET /api/kitchen/orders/queue error', err })
    return res.status(500).json({ error: 'Failed to fetch order queue' })
  }
})

// ─── GET /api/kitchen/daily-stats ────────────────────────────────────────────

router.get('/api/kitchen/daily-stats', authorizeKitchen, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [completed, cancelled] = await Promise.all([
      prisma.order.count({ where: { cafeId, status: 'COMPLETED', createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { cafeId, status: 'CANCELLED', createdAt: { gte: todayStart } } }),
    ])
    return res.json({ completed, cancelled })
  } catch (err) {
    logger.error({ msg: 'GET /api/kitchen/daily-stats error', err })
    return res.status(500).json({ error: 'Failed to fetch daily stats' })
  }
})

export default router
