import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import { applyOrderFee } from '../services/billing'
import { emitKdsTicket, emitOrderStatusUpdate } from '../services/kds'

const router = express.Router()

type ChosenModifierInput = {
  groupId:        string
  groupName:      string
  optionId:       string
  optionLabel:    string
  priceAdjustment: number
}

type OrderItemInput = {
  productId:       string
  quantity:        number
  notes?:          string
  chosenModifiers?: ChosenModifierInput[]
}

// ─── POST /api/orders — customer places an order ──────────────────────────────

router.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { tableToken, seatToken, sessionId, customerPhone, items } = req.body as {
      tableToken?:    string
      seatToken?:     string
      sessionId?:     string   // Dynamic QR flow — new single-QR-per-table approach
      customerPhone?: string
      items:          OrderItemInput[]
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] is required and must not be empty' })
    }
    if (!tableToken && !seatToken && !sessionId) {
      return res.status(400).json({ error: 'Provide tableToken, seatToken, or sessionId' })
    }

    let cafeId: string
    let physicalTableId: string
    let billingTableId: string
    let seatId: string | null         = null
    let seatNumber: number | null     = null
    let resolvedSessionId: string | null = null

    if (sessionId) {
      // ── New dynamic-QR flow ──────────────────────────────────────────────
      const now     = new Date()
      const session = await prisma.clientSession.findUnique({
        where: { id: sessionId },
        include: {
          table: {
            select: { id: true, cafeId: true, isActive: true, mergedIntoTableId: true }
          }
        }
      })
      if (!session || session.status !== 'active' || session.expiresAt <= now) {
        return res.status(401).json({ error: 'Session expired — please scan the QR code again', code: 'SESSION_EXPIRED' })
      }
      if (!session.table.isActive) {
        return res.status(403).json({ error: 'Table is inactive' })
      }
      cafeId              = session.cafeId
      physicalTableId     = session.tableId
      billingTableId      = session.table.mergedIntoTableId ?? session.tableId
      seatNumber          = session.seatNumber
      resolvedSessionId   = session.id

    } else if (seatToken) {
      // ── Legacy per-seat QR flow (backward compat) ────────────────────────
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
      // ── Table-level token (no seat) ──────────────────────────────────────
      const table = await prisma.table.findUnique({ where: { qrToken: tableToken! } })
      if (!table || !table.isActive) return res.status(404).json({ error: 'Invalid or inactive table token' })
      cafeId          = table.cafeId
      physicalTableId = table.id
      billingTableId  = table.mergedIntoTableId ?? table.id
    }

    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { isActive: true, orderingEnabled: true, country: true }
    })
    if (!cafe?.isActive) {
      return res.status(403).json({ error: 'This venue is currently unavailable. Please contact staff.' })
    }
    if (cafe.orderingEnabled === false) {
      return res.status(403).json({ error: 'Online ordering is currently disabled. Please ask a staff member for assistance.' })
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
      const basePrice = priceMap.get(it.productId)
      if (basePrice === undefined) return res.status(400).json({ error: `Product ${it.productId} price not found` })

      // Sum price adjustments from chosen modifiers (validated to finite numbers)
      const modifiersDelta = (it.chosenModifiers ?? []).reduce((sum, m) => {
        const adj = Number(m.priceAdjustment)
        return sum + (Number.isFinite(adj) ? adj : 0)
      }, 0)

      total += (basePrice + modifiersDelta) * qty
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
          sessionId:       resolvedSessionId ?? undefined,
          customerPhone:   customerPhone || null,
          totalPrice:      total,
          paymentMethod:   'CASH',
          isPaid:          false
        }
      })

      await tx.orderItem.createMany({
        data: items.map((it) => {
          const basePrice      = priceMap.get(it.productId) ?? 0
          const modifiersDelta = (it.chosenModifiers ?? []).reduce((s, m) => {
            const adj = Number(m.priceAdjustment)
            return s + (Number.isFinite(adj) ? adj : 0)
          }, 0)
          return {
            orderId:         order.id,
            productId:       it.productId,
            quantity:        it.quantity,
            notes:           it.notes || null,
            unitPrice:       basePrice,
            modifiersDelta,
            chosenModifiers: (it.chosenModifiers ?? []).map(m => ({
              groupId:         m.groupId,
              groupName:       m.groupName,
              optionId:        m.optionId,
              optionLabel:     m.optionLabel,
              priceAdjustment: Number(m.priceAdjustment) || 0,
            })),
          }
        })
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

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        id: true, cafeId: true, status: true, totalPrice: true,
        tableId: true, customerPhone: true,
        _count: { select: { items: true } }
      }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.cafeId !== cafeId) return res.status(403).json({ error: 'Forbidden' })
    if (order.status === status) return res.json({ message: 'No change', status })

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } })

    await prisma.$transaction(async (tx) => {
      const updateData: any = { status }

      // Record the moment the kitchen marks the order ready (drives avgPreparationTime metric)
      if (status === 'READY' && order.status !== 'READY') {
        updateData.preparedAt = new Date()
      }

      await tx.order.update({ where: { id: orderId }, data: updateData })

      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        await applyOrderFee(tx, cafeId, orderId, order.totalPrice, cafe?.country ?? 'MA', false, order._count.items)

        // Award loyalty points: 10 MAD = 1 point, rounded down
        if (order.customerPhone) {
          const earned = Math.floor(order.totalPrice / 10)
          if (earned > 0) {
            await tx.loyaltyAccount.upsert({
              where:  { cafeId_phone: { cafeId, phone: order.customerPhone } },
              create: {
                cafeId,
                phone:  order.customerPhone,
                points: earned,
                ledger: [{ type: 'EARN', points: earned, orderId, note: `Order completed`, createdAt: new Date() }],
              },
              update: {
                points: { increment: earned },
                ledger: {
                  push: { type: 'EARN', points: earned, orderId, note: `Order completed`, createdAt: new Date() }
                }
              }
            })
          }
        }
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
    const orderId = req.params.orderId as string
    const { type, seatToken, tableToken, sessionId } = req.body as {
      type:         string
      seatToken?:   string
      tableToken?:  string
      sessionId?:   string   // Dynamic QR flow
    }

    const VALID_TYPES = ['call_waiter', 'pay_cash', 'pay_tpe'] as const
    type NotifType = typeof VALID_TYPES[number]

    if (!VALID_TYPES.includes(type as NotifType)) {
      return res.status(400).json({ error: 'type must be call_waiter, pay_cash, or pay_tpe' })
    }
    if (!seatToken && !tableToken && !sessionId) {
      return res.status(400).json({ error: 'Provide sessionId, seatToken, or tableToken for ownership validation' })
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
    if (sessionId) {
      // Dynamic QR flow: session must be active and belong to the same table
      const session = await prisma.clientSession.findUnique({
        where:  { id: sessionId },
        select: { tableId: true, status: true, expiresAt: true }
      })
      if (!session || session.status !== 'active' || session.expiresAt <= new Date()) {
        return res.status(403).json({ error: 'Session expired or invalid' })
      }
      // Accept both the physical table and the billing (master) table
      const billingTable = await prisma.table.findUnique({
        where:  { id: session.tableId },
        select: { mergedIntoTableId: true }
      })
      const billingTableId = billingTable?.mergedIntoTableId ?? session.tableId
      if (session.tableId !== order.tableId && billingTableId !== order.tableId) {
        return res.status(403).json({ error: 'Forbidden: session does not belong to this order table' })
      }
    } else if (seatToken) {
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
