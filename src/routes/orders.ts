import express, { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { applyOrderFee } from '../services/billing'
import { emitKdsTicket, emitOrderStatusUpdate } from '../services/kds'

const router = express.Router()

type OrderItemInput = { productId: number; quantity: number; notes?: string }

// ─── POST /api/orders — customer places an order ──────────────────────────────
// Accepts either:
//   - `tableToken`  (legacy table-level QR)
//   - `seatToken`   (new seat-level QR from Hybrid layout)
// When seatToken is used, the order is linked to the seat and the billing
// table is resolved through the merge chain automatically.

router.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const {
      tableToken,  // legacy table-level
      seatToken,   // new seat-level
      customerPhone,
      items
    } = req.body as {
      tableToken?:    string
      seatToken?:     string
      customerPhone?: string
      items:          OrderItemInput[]
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] is required and must not be empty' })
    }
    if (!tableToken && !seatToken) {
      return res.status(400).json({ error: 'Provide either tableToken or seatToken' })
    }

    // ── Resolve identity from either token type ─────────────────────────────
    let cafeId: number
    let physicalTableId: number      // the real table the customer sat at
    let billingTableId: number       // may differ when merged
    let seatId: number | null = null
    let seatNumber: number | null = null

    if (seatToken) {
      const seat = await prisma.seat.findUnique({
        where: { qrToken: seatToken },
        include: {
          table: {
            select: {
              id: true,
              cafeId: true,
              isActive: true,
              mergedIntoTableId: true
            }
          }
        }
      })

      if (!seat) return res.status(404).json({ error: 'Invalid seat token' })
      if (!seat.table.isActive) return res.status(403).json({ error: 'Table is inactive' })

      cafeId          = seat.cafeId
      physicalTableId = seat.table.id
      billingTableId  = seat.table.mergedIntoTableId ?? seat.table.id
      seatId          = seat.id
      seatNumber      = seat.seatNumber
    } else {
      const table = await prisma.table.findUnique({ where: { qrToken: tableToken! } })
      if (!table || !table.isActive) {
        return res.status(404).json({ error: 'Invalid or inactive table token' })
      }
      cafeId          = table.cafeId
      physicalTableId = table.id
      billingTableId  = table.mergedIntoTableId ?? table.id
    }

    // ── Venue active check ──────────────────────────────────────────────────
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { isActive: true, billingStatus: true, country: true }
    })
    if (!cafe || !cafe.isActive) {
      return res.status(403).json({ error: 'This venue is currently unavailable. Please contact staff.' })
    }

    // ── Validate + price products ───────────────────────────────────────────
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isAvailable: true, category: { cafeId } },
      include: { category: { select: { cafeId: true } } }
    })

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable or do not belong to this cafe' })
    }

    const priceMap = new Map<number, Prisma.Decimal>()
    for (const p of products) priceMap.set(p.id, p.price as unknown as Prisma.Decimal)

    let total = new Prisma.Decimal(0)
    for (const it of items) {
      const qty = Number(it.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for product ${it.productId}` })
      }
      const price = priceMap.get(it.productId)
      if (!price) return res.status(400).json({ error: `Product ${it.productId} price not found` })
      total = total.add(price.mul(qty))
    }

    // ── Atomic order creation ───────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          cafeId,
          tableId:         billingTableId,      // billing/master table
          originalTableId: physicalTableId !== billingTableId ? physicalTableId : null,
          seatId:          seatId ?? undefined,
          seatNumber:      seatNumber ?? undefined,
          customerPhone:   customerPhone || null,
          totalPrice:      total,
          paymentMethod:   'CASH',
          isPaid:          false
        }
      })

      await tx.orderItem.createMany({
        data: items.map((it) => ({
          orderId:   order.id,
          productId: it.productId,
          quantity:  it.quantity,
          notes:     it.notes || null
        }))
      })

      return order
    })

    // ── Real-time: KDS ticket ───────────────────────────────────────────────
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      await emitKdsTicket(io, result.id)
    }

    return res.status(201).json({
      orderId:    result.id,
      totalPrice: total.toString(),
      billingTableId,
      physicalTableId,
      seatNumber
    })
  } catch (err: any) {
    logger.error({ msg: 'Create order error', err })
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

// ─── PATCH /api/orders/:orderId/status — admin updates order status ───────────

router.patch('/api/orders/:orderId/status', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    const { status } = req.body as { status: string }
    const cafeId = req.admin!.cafeId

    const validStatuses = ['PENDING', 'PREPARING', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cafeId: true, status: true, totalPrice: true, tableId: true }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (order.status === status) return res.json({ message: 'No change', status })

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { country: true }
    })

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: status as any } })

      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        const orderTotal = order.totalPrice as unknown as Prisma.Decimal
        await applyOrderFee(tx, cafeId, orderId, orderTotal, cafe?.country ?? 'MA', false)
      }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      emitOrderStatusUpdate(io, cafeId, orderId, status, order.tableId ?? null)
    }

    return res.json({ orderId, status })
  } catch (err) {
    logger.error({ msg: 'PATCH order status error', err })
    return res.status(500).json({ error: 'Failed to update order status' })
  }
})

// ─── POST /api/orders/:orderId/social-verified ────────────────────────────────

router.post('/api/orders/:orderId/social-verified', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    const cafeId = req.admin!.cafeId

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cafeId: true, totalPrice: true }
    })
    if (!order || order.cafeId !== cafeId) return res.status(404).json({ error: 'Order not found' })

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { country: true, hasSocialShareAddon: true }
    })
    if (!cafe?.hasSocialShareAddon) {
      return res.status(403).json({ error: 'Social Share add-on is not active for this venue' })
    }

    await prisma.$transaction(async (tx) => {
      const orderTotal = order.totalPrice as unknown as Prisma.Decimal
      await applyOrderFee(tx, cafeId, orderId, orderTotal, cafe.country, true)
    })

    return res.json({ message: 'Social share fee applied.' })
  } catch (err) {
    logger.error({ msg: 'POST social-verified error', err })
    return res.status(500).json({ error: 'Failed to apply social share fee' })
  }
})

// ─── GET /api/orders — admin fetches orders ───────────────────────────────────

router.get('/api/orders', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const statusFilter = req.query.status as string | undefined

    const orders = await prisma.order.findMany({
      where: {
        cafeId,
        ...(statusFilter ? { status: statusFilter as any } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: {
          include: {
            product: {
              select: { nameEn: true, nameAr: true, nameFr: true, nameEs: true, nameDe: true, price: true }
            }
          }
        },
        table:         { select: { tableNumber: true } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } }
      }
    })

    return res.json(orders)
  } catch (err) {
    logger.error({ msg: 'GET /api/orders error', err })
    return res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// ─── GET /api/orders/table/:tableId — all active orders for a table group ─────

router.get('/api/orders/table/:tableId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const tableId = Number(req.params.tableId)

    // Resolve the full merge group to include orders from all merged tables
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      select: {
        cafeId: true,
        tableNumber: true,
        mergedIntoTableId: true,
        mergedTables: { select: { id: true, tableNumber: true } }
      }
    })

    if (!table || table.cafeId !== cafeId) return res.status(404).json({ error: 'Table not found' })

    // If this table is merged into a master, fetch from the master
    const masterTableId = table.mergedIntoTableId ?? tableId
    const childIds = table.mergedIntoTableId
      ? [] // this IS a child, query against master
      : table.mergedTables.map((t) => t.id)

    const allTableIds = [masterTableId, ...childIds]

    const orders = await prisma.order.findMany({
      where: { cafeId, tableId: { in: allTableIds }, isPaid: false, status: { notIn: ['CANCELLED'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: { product: { select: { nameEn: true, price: true } } }
        },
        table:         { select: { tableNumber: true } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } }
      }
    })

    const mergeLabel =
      childIds.length > 0
        ? `TABLE ${table.tableNumber} [Merged with ${table.mergedTables.map((t) => t.tableNumber).join(', ')}]`
        : `TABLE ${table.tableNumber}`

    return res.json({ mergeLabel, orders })
  } catch (err) {
    logger.error({ msg: 'GET /api/orders/table error', err })
    return res.status(500).json({ error: 'Failed to fetch table orders' })
  }
})

export default router
