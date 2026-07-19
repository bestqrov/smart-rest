/**
 * POST /api/pos/orders
 *
 * Create a POS order or smart-merge items into an existing open bill for the table.
 * Merge logic: if the table already has an OPENED-status order for this shift,
 * append new items rather than creating a second order.
 *
 * Requires POS Bearer token (authorizePOS).
 */

import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'
import requireUnlockedShift from '../../middleware/requireUnlockedShift'
import { emitKdsTicket } from '../../services/kds'
import { autoCheckInReservationForTable } from '../../reservations/ReservationService'

const router = express.Router()

type ItemInput = { productId: string; quantity: number; notes?: string }

router.post('/api/pos/orders', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId, shiftId } = req.staff!
    const { tableId, items, paymentMethod, customerPhone, orderType } = req.body as {
      tableId?:       string
      items:          ItemInput[]
      paymentMethod:  'CASH' | 'CARD' | 'ONLINE'
      customerPhone?: string
      orderType?:     'DINE_IN' | 'TAKEAWAY'
    }

    if (!items?.length || !paymentMethod) {
      return res.status(400).json({ error: 'items and paymentMethod are required' })
    }

    // Fetch products to snapshot price + commission
    const productIds = [...new Set(items.map(i => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isAvailable: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return res.status(400).json({ error: `Product not found or unavailable: ${item.productId}` })
      }
    }

    const lineItems = items.map(item => {
      const p = productMap.get(item.productId)!
      // WEIGHT products: `quantity` is grams, `price` is per-KG — snapshot
      // unitPrice as the per-gram rate so downstream quantity*unitPrice
      // totals (kitchen, receipts, analytics) stay correct unmodified.
      const unitPrice = p.unitType === 'WEIGHT' ? p.price / 1000 : p.price
      return {
        productId:      item.productId,
        quantity:       item.quantity,
        notes:          item.notes ?? null,
        unitPrice,
        commissionRate: p.commissionRate
      }
    })

    const orderTotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)

    // ── Smart merge: find an open (OPENED) bill for this table ───────────────
    let existingOrder = tableId
      ? await prisma.order.findFirst({
          where: {
            cafeId,
            tableId,
            billStatus: 'OPENED',
            orderSource: 'POS_MANUAL'
          },
          include: { items: true }
        })
      : null

    if (existingOrder) {
      // Merge: add items + recalculate totals
      const newTotal = existingOrder.totalPrice + orderTotal
      const newCommission = lineItems.reduce(
        (sum, li) => sum + li.unitPrice * li.quantity * li.commissionRate,
        existingOrder.totalCommission
      )

      const updated = await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          totalPrice:      newTotal,
          totalCommission: newCommission,
          items: {
            create: lineItems
          }
        },
        include: { items: { include: { product: true } } }
      })

      const io = req.app.get('io') as SocketIOServer | undefined
      if (io) await emitKdsTicket(io, updated.id)

      logger.info({ msg: 'POS order merged', orderId: updated.id, staffId, shiftId })
      return res.json({ merged: true, order: updated })
    }

    // ── Create fresh order ───────────────────────────────────────────────────
    const totalCommission = lineItems.reduce(
      (sum, li) => sum + li.unitPrice * li.quantity * li.commissionRate,
      0
    )

    const order = await prisma.order.create({
      data: {
        cafeId,
        tableId:         tableId ?? null,
        paymentMethod,
        orderSource:     'POS_MANUAL',
        billStatus:      'OPENED',
        status:          'PENDING',
        totalPrice:      orderTotal,
        totalCommission,
        customerPhone:   customerPhone ?? null,
        orderType:       orderType ?? null,
        createdById:     staffId,
        items: {
          create: lineItems
        }
      },
      include: { items: { include: { product: true } } }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) await emitKdsTicket(io, order.id)

    await autoCheckInReservationForTable(cafeId, tableId ?? null)

    logger.info({ msg: 'POS order created', orderId: order.id, staffId, shiftId })
    return res.status(201).json({ merged: false, order })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/orders error', err })
    return res.status(500).json({ error: 'Failed to create POS order' })
  }
})

// ─── POST /api/pos/orders/marketplace — log an order from a 3rd-party app ─────
// Manual entry: staff sees a new order notification on the Glovo/Uber Eats/etc
// tablet and re-keys it here so it flows through the same kitchen queue,
// stats, and inventory deduction as any other order. Already paid by the
// platform, so isPaid=true / billStatus=CLOSED_VIRTUAL from creation — no
// table involved (courier pickup), status still starts PENDING for the
// kitchen to prepare it like any ticket.

router.post('/api/pos/orders/marketplace', authorizePOS, requireUnlockedShift, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const { items, platform, externalOrderRef } = req.body as {
      items: ItemInput[]
      platform: string
      externalOrderRef?: string
    }

    if (!items?.length)     return res.status(400).json({ error: 'items are required' })
    if (!platform?.trim())  return res.status(400).json({ error: 'platform is required (e.g. Glovo, Uber Eats)' })

    const productIds = [...new Set(items.map(i => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isAvailable: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return res.status(400).json({ error: `Product not found or unavailable: ${item.productId}` })
      }
    }

    const lineItems = items.map(item => {
      const p = productMap.get(item.productId)!
      const unitPrice = p.unitType === 'WEIGHT' ? p.price / 1000 : p.price
      return {
        productId:      item.productId,
        quantity:       item.quantity,
        notes:          item.notes ?? null,
        unitPrice,
        commissionRate: p.commissionRate
      }
    })

    const orderTotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)
    const totalCommission = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity * li.commissionRate, 0)

    const order = await prisma.order.create({
      data: {
        cafeId,
        paymentMethod:    'ONLINE',
        isPaid:           true,
        orderSource:      'MARKETPLACE',
        billStatus:       'CLOSED_VIRTUAL',
        status:           'PENDING',
        totalPrice:       orderTotal,
        totalCommission,
        orderType:        'DELIVERY',
        externalPlatform: platform.trim(),
        externalOrderRef: externalOrderRef?.trim() ?? '',
        createdById:      staffId,
        items: { create: lineItems }
      },
      include: { items: { include: { product: true } } }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) await emitKdsTicket(io, order.id)

    logger.info({ msg: 'Marketplace order logged', orderId: order.id, platform, staffId })
    return res.status(201).json({ order })
  } catch (err) {
    logger.error({ msg: 'POST /api/pos/orders/marketplace error', err })
    return res.status(500).json({ error: 'Failed to log marketplace order' })
  }
})

// ─── GET /api/pos/orders/table/:tableId — fetch open order for POS cashier ────

router.get('/api/pos/orders/table/:tableId', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const tableId = req.params['tableId'] as string

    const table = await prisma.table.findFirst({
      where: { id: tableId, cafeId },
      select: { tableNumber: true }
    })
    if (!table) return res.status(404).json({ error: 'Table not found' })

    const orders = await prisma.order.findMany({
      where: {
        cafeId,
        tableId,
        billStatus: { in: ['OPENED', 'BILL_REQUESTED'] }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: {
            product: { select: { nameAr: true, nameEn: true, nameFr: true } }
          }
        }
      }
    })

    return res.json({ tableNumber: table.tableNumber, orders })
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/orders/table/:tableId error', err })
    return res.status(500).json({ error: 'Failed to fetch table orders' })
  }
})

// ─── GET /api/pos/menu — fetch menu categories + products for POS browser ─────

router.get('/api/pos/menu', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { currency: true } })
    const categories = await prisma.category.findMany({
      where: { cafeId },
      orderBy: { order: 'asc' },
      include: {
        products: {
          where:   { isAvailable: true },
          orderBy: { nameEn: 'asc' },
          select:  { id: true, nameAr: true, nameEn: true, nameFr: true, price: true, imageUrl: true, unitType: true }
        }
      }
    })
    return res.json({ categories, currency: cafe?.currency ?? 'MAD' })
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/menu error', err })
    return res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

export default router
