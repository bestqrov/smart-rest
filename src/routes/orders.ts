import express, { Request, Response } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'

const prisma = new PrismaClient()
const router = express.Router()

type OrderItemInput = { productId: number; quantity: number; notes?: string }

router.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { cafeId, tableId, customerPhone, items } = req.body as {
      cafeId: number
      tableId: number
      customerPhone?: string
      items: OrderItemInput[]
    }

    if (!cafeId || !tableId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload. Required: cafeId, tableId, items[]' })
    }

    // Validate table exists and belongs to cafe
    const table = await prisma.table.findUnique({ where: { id: tableId } })
    if (!table || table.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Table not found for the specified cafe' })
    }

    // Validate items and fetch current prices in parallel
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products do not exist' })
    }

    // Map productId -> price
    const priceMap = new Map<number, Prisma.Decimal>()
    for (const p of products) priceMap.set(p.id, p.price as unknown as Prisma.Decimal)

    // Calculate totalPrice (server-side authoritative)
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

    // Use a transaction to create order and order items
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

      const orderItemsData = items.map((it) => ({
        orderId: order.id,
        productId: it.productId,
        quantity: it.quantity,
        notes: it.notes || null
      }))

      // createMany for efficiency
      await tx.orderItem.createMany({ data: orderItemsData })

      return order
    })

    // Emit real-time notification via Socket.io if available on the app
    const io = (req.app.get('io') || (req.app.locals && (req.app.locals.io as SocketIOServer))) as
      | SocketIOServer
      | undefined

    if (io) {
      io.to(`room_${cafeId}`).emit('new_order', { orderId: result.id, totalPrice: total.toString() })
    }

    return res.status(201).json({ orderId: result.id, totalPrice: total.toString() })
  } catch (err: any) {
    logger.error({ msg: 'Create order error', err })
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

export default router
