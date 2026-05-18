import express, { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

type OrderItemInput = { productId: number; quantity: number; notes?: string }

router.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { tableToken, customerPhone, items } = req.body as {
      tableToken: string
      customerPhone?: string
      items: OrderItemInput[]
    }

    if (!tableToken || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload. Required: tableToken, items[]' })
    }

    // Derive cafeId from the table token — never trust cafeId from the client
    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || !table.isActive) {
      return res.status(404).json({ error: 'Invalid or inactive table token' })
    }
    const cafeId = table.cafeId
    const tableId = table.id

    // Fetch products and enforce they belong to the same cafe (via category)
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isAvailable: true,
        category: { cafeId }
      },
      include: { category: { select: { cafeId: true } } }
    })

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable or do not belong to this cafe' })
    }

    // Build server-side price map
    const priceMap = new Map<number, Prisma.Decimal>()
    for (const p of products) priceMap.set(p.id, p.price as unknown as Prisma.Decimal)

    // Calculate total server-side
    let total = new Prisma.Decimal(0)
    for (const it of items) {
      const qty = Number(it.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Invalid quantity for product ' + it.productId })
      }
      const price = priceMap.get(it.productId)
      if (!price) return res.status(400).json({ error: `Product ${it.productId} price not found` })
      total = total.add(price.mul(qty))
    }

    // Atomic transaction: create order + items
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          cafeId,
          tableId,
          customerPhone: customerPhone || null,
          totalPrice: total,
          paymentMethod: 'CASH',
          isPaid: false
        }
      })

      await tx.orderItem.createMany({
        data: items.map((it) => ({
          orderId: order.id,
          productId: it.productId,
          quantity: it.quantity,
          notes: it.notes || null
        }))
      })

      return order
    })

    // Emit real-time notification to admin room
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${cafeId}`).emit('new_order', { orderId: result.id, tableId, totalPrice: total.toString() })
    }

    return res.status(201).json({ orderId: result.id, totalPrice: total.toString() })
  } catch (err: any) {
    logger.error({ msg: 'Create order error', err })
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

export default router
