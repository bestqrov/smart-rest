import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// POST /api/orders/:orderId/review
// Public — validated by seatToken or tableToken (same pattern as notify-waiter).
// ≥4 stars: fires n8n webhook for social media automation.
// ≤3 stars: emits 'internal_alert' socket event to the cafe's POS room.
router.post('/api/orders/:orderId/review', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string
    const { rating, reviewText, seatToken, tableToken } = req.body as {
      rating: number
      reviewText?: string
      seatToken?: string
      tableToken?: string
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1–5' })
    }
    if (!seatToken && !tableToken) {
      return res.status(400).json({ error: 'Provide seatToken or tableToken' })
    }

    // Verify token ownership
    let order
    if (seatToken) {
      const seat = await prisma.seat.findUnique({
        where: { qrToken: seatToken },
        select: { id: true },
      })
      if (!seat) return res.status(403).json({ error: 'Invalid seatToken' })
      order = await prisma.order.findFirst({
        where: { id: orderId, seatId: seat.id },
        select: { id: true, cafeId: true, tableId: true, rating: true },
      })
    } else {
      const table = await prisma.table.findUnique({
        where: { qrToken: tableToken! },
        select: { id: true },
      })
      if (!table) return res.status(403).json({ error: 'Invalid tableToken' })
      order = await prisma.order.findFirst({
        where: { id: orderId, tableId: table.id },
        select: { id: true, cafeId: true, tableId: true, rating: true },
      })
    }

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.rating != null) {
      return res.status(409).json({ error: 'Order already reviewed' })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { rating, reviewText: reviewText ?? null },
    })

    // High-rating path: fire n8n webhook for social media automation
    if (rating >= 4) {
      const webhookUrl = process.env.N8N_WEBHOOK_URL
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, cafeId: order.cafeId, rating, reviewText }),
        }).catch((err) => logger.warn('n8n webhook failed:', err))
      }
    }

    // Low-rating path: alert waiter via socket
    if (rating <= 3) {
      const io = req.app.get('io') as SocketIOServer | undefined
      if (io) {
        io.to(`room_${order.cafeId}`).emit('internal_alert', {
          type: 'low_rating',
          orderId,
          tableId: order.tableId,
          rating,
          reviewText,
        })
      }
    }

    return res.json({ success: true })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
