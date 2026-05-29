import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { applyOrderFee } from '../services/billing'
import { emitKdsTicket, emitOrderStatusUpdate } from '../services/kds'

const router = express.Router()

type OrderItemInput = { productId: string; quantity: number; notes?: string }

// ─── POST /api/orders — customer places an order ──────────────────────────────

router.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { tableToken, seatToken, customerPhone, items } = req.body as {
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

    let cafeId: string
    let physicalTableId: string
    let billingTableId: string
    let seatId: string | null = null
    let seatNumber: number | null = null

    if (seatToken) {
      const seat = await prisma.seat.findUnique({
        where: { qrToken: seatToken },
        include: { table: { select: { id: true, cafeId: true, isActive: true, mergedIntoTableId: true } } }
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
      if (!table || !table.isActive) return res.status(404).json({ error: 'Invalid or inactive table token' })
      cafeId          = table.cafeId
      physicalTableId = table.id
      billingTableId  = table.mergedIntoTableId ?? table.id
    }

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { isActive: true, country: true }
    })
    if (!cafe?.isActive) {
      return res.status(403).json({ error: 'This venue is currently unavailable. Please contact staff.' })
    }

    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isAvailable: true, category: { cafeId } },
      select: { id: true, price: true }
    })

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable or do not belong to this cafe' })
    }

    const priceMap = new Map<string, number>(products.map((p) => [p.id, p.price]))

    let total = 0
    for (const it of items) {
      const qty = Number(it.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for product ${it.productId}` })
      }
      const price = priceMap.get(it.productId)
      if (price === undefined) return res.status(400).json({ error: `Product ${it.productId} price not found` })
      total += price * qty
    }
    total = parseFloat(total.toFixed(2))

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          cafeId,
          tableId:         billingTableId,
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

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) await emitKdsTicket(io, result.id)

    return res.status(201).json({ orderId: result.id, totalPrice: total, billingTableId, physicalTableId, seatNumber })
  } catch (err: any) {
    logger.error({ msg: 'Create order error', err })
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

// ─── PATCH /api/orders/:orderId/status ───────────────────────────────────────

router.patch('/api/orders/:orderId/status', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string
    const { status } = req.body as { status: string }
    const cafeId = req.admin!.cafeId

    const validStatuses = ['PENDING', 'PREPARING', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, cafeId: true, status: true, totalPrice: true, tableId: true, _count: { select: { items: true } } }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (order.status === status) return res.json({ message: 'No change', status })

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: status as any } })
      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        await applyOrderFee(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', false, order._count.items)
      }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) emitOrderStatusUpdate(io, cafeId, orderId, status, order.tableId ?? null)

    return res.json({ orderId, status })
  } catch (err) {
    logger.error({ msg: 'PATCH order status error', err })
    return res.status(500).json({ error: 'Failed to update order status' })
  }
})

// ─── PATCH /api/orders/:orderId/notify-waiter ────────────────────────────────
// Public endpoint — customer signals the waiter (call, pay cash, pay by TPE).
// Validates ownership via seatToken or tableToken to prevent cross-table abuse.

router.patch('/api/orders/:orderId/notify-waiter', async (req: Request, res: Response) => {
  try {
    const orderId                        = req.params.orderId as string
    const { type, seatToken, tableToken } = req.body as {
      type:        string
      seatToken?:  string
      tableToken?: string
    }

    const VALID_TYPES = ['call_waiter', 'pay_cash', 'pay_tpe'] as const
    type NotifType = typeof VALID_TYPES[number]

    if (!VALID_TYPES.includes(type as NotifType)) {
      return res.status(400).json({ error: 'type must be call_waiter, pay_cash, or pay_tpe' })
    }
    if (!seatToken && !tableToken) {
      return res.status(400).json({ error: 'Provide seatToken or tableToken for ownership validation' })
    }

    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { cafeId: true, tableId: true, status: true }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      return res.status(422).json({ error: 'Cannot notify for a closed order' })
    }

    // ── Ownership check ──────────────────────────────────────────────────────
    if (seatToken) {
      const seat = await prisma.seat.findUnique({
        where:  { qrToken: seatToken },
        select: { tableId: true }
      })
      if (!seat || seat.tableId !== order.tableId) {
        return res.status(403).json({ error: 'Forbidden: seat does not belong to this order table' })
      }
    } else {
      const table = await prisma.table.findUnique({
        where:  { qrToken: tableToken! },
        select: { id: true }
      })
      if (!table || table.id !== order.tableId) {
        return res.status(403).json({ error: 'Forbidden: table token mismatch' })
      }
    }

    // ── Persist notification state on the order ──────────────────────────────
    await prisma.order.update({
      where: { id: orderId },
      data:  { waiterNotification: { type: type as NotifType, isActive: true } }
    })

    // ── Fetch table number for the socket payload ─────────────────────────────
    const tableRow = order.tableId
      ? await prisma.table.findUnique({
          where:  { id: order.tableId },
          select: { tableNumber: true }
        })
      : null

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${order.cafeId}`).emit('waiter_notification', {
        orderId,
        tableId:     order.tableId,
        tableNumber: tableRow?.tableNumber ?? null,
        type,
        isActive:    true
      })
    }

    return res.json({ orderId, type, isActive: true })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/orders/notify-waiter error', err })
    return res.status(500).json({ error: 'Failed to notify waiter' })
  }
})

// ─── POST /api/orders/:orderId/social-verified ────────────────────────────────

// Public — called by the customer browser after a successful Web Share (no auth token)
router.post('/api/orders/:orderId/social-verified', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cafeId: true, totalPrice: true }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Idempotency guard: skip if fee already logged for this share
    const alreadyLogged = await prisma.walletLog.findFirst({
      where: { orderId, type: 'DEBT_ACC_SOCIAL' }
    })
    if (alreadyLogged) return res.json({ message: 'Already recorded.' })

    const cafe = await prisma.cafe.findUnique({
      where: { id: order.cafeId },
      select: { country: true, hasSocialShareAddon: true }
    })
    if (!cafe?.hasSocialShareAddon) return res.json({ message: 'Add-on not active.' })

    await prisma.$transaction(async (tx) => {
      await applyOrderFee(tx, order.cafeId, orderId, order.totalPrice, cafe.country, true)
    })

    return res.json({ message: 'Social share fee applied.' })
  } catch (err) {
    logger.error({ msg: 'POST social-verified error', err })
    return res.status(500).json({ error: 'Failed to apply social share fee' })
  }
})

// ─── GET /api/orders ──────────────────────────────────────────────────────────

router.get('/api/orders', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const statusFilter = req.query.status as string | undefined

    const orders = await prisma.order.findMany({
      where: { cafeId, ...(statusFilter ? { status: statusFilter as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: {
          include: {
            product: { select: { nameEn: true, nameAr: true, nameFr: true, nameEs: true, nameDe: true, price: true } }
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

// ─── GET /api/orders/table/:tableId ──────────────────────────────────────────

router.get('/api/orders/table/:tableId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const tableId = req.params.tableId as string

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

    const masterTableId = table.mergedIntoTableId ?? tableId
    const childIds = table.mergedIntoTableId ? [] : table.mergedTables.map((t) => t.id)
    const allTableIds = [masterTableId, ...childIds]

    const orders = await prisma.order.findMany({
      where: { cafeId, tableId: { in: allTableIds }, isPaid: false, status: { notIn: ['CANCELLED'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { include: { product: { select: { nameEn: true, price: true } } } },
        table:         { select: { tableNumber: true } },
        originalTable: { select: { tableNumber: true } },
        seat:          { select: { seatNumber: true } }
      }
    })

    const mergeLabel = childIds.length > 0
      ? `TABLE ${table.tableNumber} [Merged with ${table.mergedTables.map((t) => t.tableNumber).join(', ')}]`
      : `TABLE ${table.tableNumber}`

    return res.json({ mergeLabel, orders })
  } catch (err) {
    logger.error({ msg: 'GET /api/orders/table error', err })
    return res.status(500).json({ error: 'Failed to fetch table orders' })
  }
})

export default router
