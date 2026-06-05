/**
 * GET /api/pos/tables-status
 *
 * Returns all tables for a cafe with their current occupancy color:
 *   EMPTY          — no active orders
 *   OPEN_QR        — has QR_CODE order with billStatus OPENED
 *   OPEN_MANUAL    — has POS_MANUAL order with billStatus OPENED
 *   BILL_REQUESTED — customer/waiter requested the bill (BILL_REQUESTED status)
 *
 * Requires POS Bearer token (authorizePOS).
 */

import express, { Request, Response } from 'express'
import prisma from '../../prisma'
import logger from '../../logger'
import authorizePOS from '../../middleware/authorizePOS'

const router = express.Router()

type TableColor = 'EMPTY' | 'OPEN_QR' | 'OPEN_MANUAL' | 'BILL_REQUESTED' | 'INACTIVE'

router.get('/api/pos/tables-status', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!

    const [tables, activeOrders] = await Promise.all([
      // Fetch ALL tables (active + inactive) — POS shows inactive ones in gray
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
        select: {
          tableId:     true,
          billStatus:  true,
          orderSource: true
        }
      })
    ])

    // Build per-table status: BILL_REQUESTED takes highest priority
    const tableStatusMap = new Map<string, TableColor>()

    for (const order of activeOrders) {
      if (!order.tableId) continue
      const current = tableStatusMap.get(order.tableId)

      if (order.billStatus === 'BILL_REQUESTED') {
        tableStatusMap.set(order.tableId, 'BILL_REQUESTED')
      } else if (current !== 'BILL_REQUESTED') {
        const color: TableColor = order.orderSource === 'QR_CODE' ? 'OPEN_QR' : 'OPEN_MANUAL'
        tableStatusMap.set(order.tableId, color)
      }
    }

    const result = tables.map(t => ({
      id:          t.id,
      tableNumber: t.tableNumber,
      qrToken:     t.qrToken,
      isActive:    t.isActive,
      capacity:    t.capacity,
      // Inactive tables always show as INACTIVE regardless of orders
      status:      !t.isActive ? 'INACTIVE' : ((tableStatusMap.get(t.id) ?? 'EMPTY') as TableColor)
    }))

    return res.json({ tables: result })
  } catch (err) {
    logger.error({ msg: 'GET /api/pos/tables-status error', err })
    return res.status(500).json({ error: 'Failed to fetch tables status' })
  }
})

export default router
