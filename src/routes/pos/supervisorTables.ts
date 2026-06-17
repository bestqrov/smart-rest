/**
 * GET /api/supervisor/tables
 *
 * Enhanced table status for the supervisor view.
 * Returns per-table: status, total amount, time open, waiter name, seat count.
 * Requires POS token with role SUPERVISOR or admin JWT.
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'

const router = express.Router()

router.get('/api/supervisor/tables', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!

    const [tables, openOrders, todayRevenue] = await Promise.all([
      prisma.table.findMany({
        where: { cafeId },
        orderBy: { tableNumber: 'asc' }
      }),
      prisma.order.findMany({
        where: {
          cafeId,
          tableId: { not: null },
          billStatus: { in: ['OPENED', 'BILL_REQUESTED'] }
        },
        include: {
          items: { include: { product: { select: { nameEn: true, nameAr: true, nameFr: true } } } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.order.aggregate({
        where: {
          cafeId,
          OR: [{ isPaid: true }, { status: 'COMPLETED' }],
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        },
        _sum: { totalPrice: true }
      })
    ])

    // Group open orders by tableId
    const byTable = new Map<string, typeof openOrders>()
    for (const o of openOrders) {
      if (!o.tableId) continue
      if (!byTable.has(o.tableId)) byTable.set(o.tableId, [])
      byTable.get(o.tableId)!.push(o)
    }

    const result = tables.map(t => {
      const orders = byTable.get(t.id) ?? []
      const totalPrice = orders.reduce((s, o) => s + o.totalPrice, 0)
      const firstOrder = orders[0]
      const openedAt = firstOrder?.createdAt ?? null
      const waiterName = firstOrder?.createdBy?.name ?? null
      const hasBillReq = orders.some(o => o.billStatus === 'BILL_REQUESTED')
      const allItems = orders.flatMap(o => o.items)

      // Merge items by product for display
      const itemMap = new Map<string, { name: string; quantity: number; unitPrice: number }>()
      for (const i of allItems) {
        const key = i.productId
        const ex = itemMap.get(key)
        if (ex) { ex.quantity += i.quantity }
        else { itemMap.set(key, { name: i.product.nameEn || i.product.nameAr || '', quantity: i.quantity, unitPrice: i.unitPrice }) }
      }

      let status: 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'
      if (!t.isActive) status = 'INACTIVE'
      else if (orders.length === 0) status = 'EMPTY'
      else if (hasBillReq) status = 'BILL_REQUESTED'
      else if (orders.some(o => o.orderSource === 'QR_CODE')) status = 'OPEN_QR'
      else status = 'OPEN_MANUAL'

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        isActive: t.isActive,
        capacity: t.capacity,
        status,
        totalPrice,
        openedAt,
        waiterName,
        items: Array.from(itemMap.values()),
        orderIds: orders.map(o => o.id)
      }
    })

    const openCount    = result.filter(t => t.status !== 'EMPTY' && t.status !== 'INACTIVE').length
    const billCount    = result.filter(t => t.status === 'BILL_REQUESTED').length
    const dailyRevenue = Number(todayRevenue._sum.totalPrice ?? 0)

    return res.json({ tables: result, stats: { openCount, billCount, dailyRevenue } })
  } catch (err) {
    logger.error({ msg: 'GET /api/supervisor/tables error', err })
    return res.status(500).json({ error: 'Failed to fetch supervisor tables' })
  }
})

export default router
