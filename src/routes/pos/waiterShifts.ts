/**
 * Waiter Zone & Shift Management
 *
 * POST   /api/pos/waiters/clock-in              — Start shift (JWT staffId)
 * POST   /api/pos/waiters/clock-out             — End shift, release tables
 * GET    /api/pos/waiters/status                — Active waiters for this cafe
 * PATCH  /api/pos/tables/:tableId/zone          — Set zone label on a table
 * PATCH  /api/pos/orders/:orderId/acknowledge   — Claim table + ACK notification
 * DELETE /api/pos/tables/:tableId/release       — Release table assignment (bill closed)
 *
 * Multi-tenancy: every operation is scoped to req.staff.cafeId from the POS JWT.
 */

import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { authorizePOS } from '../../middleware/authorizePOS'
import prisma from '../../prisma'
import logger from '../../logger'

const router = express.Router()

// ─── POST /api/pos/waiters/clock-in ──────────────────────────────────────────

router.post('/api/pos/waiters/clock-in', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, cafeId: true, name: true, isActive: true, shiftStatus: true },
    })

    if (!staff || staff.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Staff member not found' })
    }
    if (!staff.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' })
    }
    if (staff.shiftStatus === 'ACTIVE') {
      return res.status(409).json({ error: 'Already clocked in', name: staff.name })
    }

    const now = new Date()

    await prisma.$transaction([
      prisma.staff.update({
        where: { id: staffId },
        data: { shiftStatus: 'ACTIVE', clockInTime: now },
      }),
      prisma.waiterShift.create({
        data: { cafeId, staffId, clockIn: now },
      }),
    ])

    logger.info({ msg: 'waiter clock-in', staffId, cafeId })
    return res.json({ success: true, name: staff.name, clockInTime: now })
  } catch (err) {
    logger.error({ msg: 'clock-in error', err })
    return res.status(500).json({ error: 'Clock-in failed' })
  }
})

// ─── POST /api/pos/waiters/clock-out ─────────────────────────────────────────

router.post('/api/pos/waiters/clock-out', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, cafeId: true, name: true, shiftStatus: true },
    })

    if (!staff || staff.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Staff member not found' })
    }
    if (staff.shiftStatus === 'OFF_DUTY') {
      return res.status(409).json({ error: 'Not currently clocked in' })
    }

    const now = new Date()

    // Find open WaiterShift for this staff
    const openShift = await prisma.waiterShift.findFirst({
      where: { staffId, cafeId, clockOut: null },
      orderBy: { clockIn: 'desc' },
      select: { id: true },
    })

    await prisma.$transaction([
      prisma.staff.update({
        where: { id: staffId },
        data: { shiftStatus: 'OFF_DUTY', clockInTime: null },
      }),
      // Close the open shift record
      ...(openShift
        ? [prisma.waiterShift.update({ where: { id: openShift.id }, data: { clockOut: now } })]
        : []),
      // Release all tables assigned to this waiter
      prisma.table.updateMany({
        where: { cafeId, assignedWaiterId: staffId },
        data: { assignedWaiterId: null },
      }),
    ])

    logger.info({ msg: 'waiter clock-out', staffId, cafeId })
    return res.json({ success: true, name: staff.name, clockOutTime: now })
  } catch (err) {
    logger.error({ msg: 'clock-out error', err })
    return res.status(500).json({ error: 'Clock-out failed' })
  }
})

// ─── GET /api/pos/waiters/status ─────────────────────────────────────────────

router.get('/api/pos/waiters/status', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!

    const waiters = await prisma.staff.findMany({
      where: { cafeId, isActive: true },
      select: {
        id: true, name: true, role: true, shiftStatus: true, clockInTime: true,
        assignedTables: { select: { id: true, tableNumber: true, zone: true } },
      },
      orderBy: [{ shiftStatus: 'asc' }, { name: 'asc' }],
    })

    return res.json({ waiters })
  } catch (err) {
    logger.error({ msg: 'GET waiters/status error', err })
    return res.status(500).json({ error: 'Failed to fetch waiter status' })
  }
})

// ─── PATCH /api/pos/tables/:tableId/zone ─────────────────────────────────────

router.patch('/api/pos/tables/:tableId/zone', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.staff!
    const tableId = req.params.tableId as string
    const { zone } = req.body as { zone: string }

    if (!zone || typeof zone !== 'string' || zone.trim().length === 0) {
      return res.status(400).json({ error: 'zone is required' })
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      select: { cafeId: true },
    })
    if (!table || table.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Table not found' })
    }

    const updated = await prisma.table.update({
      where: { id: tableId },
      data: { zone: zone.trim() },
      select: { id: true, tableNumber: true, zone: true },
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH table zone error', err })
    return res.status(500).json({ error: 'Failed to update zone' })
  }
})

// ─── PATCH /api/pos/orders/:orderId/acknowledge ───────────────────────────────
//
// Waiter presses "Accept / Serve" on a notification in POS dashboard.
// Steps:
//   1. Verify order belongs to this cafe.
//   2. Find table — check assignedWaiterId (table lock).
//   3. If locked by a different waiter → 403 with colleague name.
//   4. Assign table + order to this waiter.
//   5. ACK the waiterNotification.
//   6. Emit socket events.

router.patch('/api/pos/orders/:orderId/acknowledge', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const orderId = req.params.orderId as string

    // Verify order belongs to this cafe
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        cafeId: true,
        tableId: true,
        waiterNotification: true,
        table: {
          select: {
            id: true,
            tableNumber: true,
            zone: true,
            assignedWaiterId: true,
            assignedWaiter: { select: { name: true } },
          },
        },
      },
    })

    if (!order || order.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // ── Table lock check ─────────────────────────────────────────────────────
    if (
      order.table?.assignedWaiterId &&
      order.table.assignedWaiterId !== staffId
    ) {
      const colName = order.table.assignedWaiter?.name ?? 'your colleague'
      return res.status(403).json({
        error: `This table is currently being served by ${colName}`,
        lockedBy: order.table.assignedWaiterId,
        lockedByName: colName,
      })
    }

    // ── Claim table + order + ACK notification ───────────────────────────────
    await prisma.$transaction([
      // Assign table to this waiter (idempotent if already assigned to them)
      ...(order.tableId
        ? [
            prisma.table.update({
              where: { id: order.tableId },
              data: { assignedWaiterId: staffId },
            }),
          ]
        : []),
      // Stamp the order itself for performance tracking
      prisma.order.update({
        where: { id: orderId },
        data: {
          assignedWaiterId: staffId,
          waiterNotification: {
            set: {
              type: order.waiterNotification?.type ?? 'none',
              isActive: false,
            },
          },
        },
      }),
    ])

    // ── Emit socket events ────────────────────────────────────────────────────
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      // Tell all POS tabs: notification is ACKed
      io.to(`room_${cafeId}`).emit('waiter_notification_acked', {
        orderId,
        waiterId: staffId,
      })
      // Tell all POS tabs: table is now assigned
      if (order.tableId) {
        io.to(`room_${cafeId}`).emit('table_assigned', {
          tableId: order.tableId,
          tableNumber: order.table?.tableNumber,
          assignedWaiterId: staffId,
        })
      }
    }

    logger.info({ msg: 'order acknowledged + table claimed', orderId, staffId })
    return res.json({ success: true, orderId, assignedWaiterId: staffId })
  } catch (err) {
    logger.error({ msg: 'acknowledge error', err })
    return res.status(500).json({ error: 'Acknowledge failed' })
  }
})

// ─── DELETE /api/pos/tables/:tableId/release ─────────────────────────────────
//
// Called when a bill is fully closed to free the table for the next waiter.

router.delete('/api/pos/tables/:tableId/release', authorizePOS, async (req: Request, res: Response) => {
  try {
    const { staffId, cafeId } = req.staff!
    const tableId = req.params.tableId as string

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      select: { cafeId: true, assignedWaiterId: true },
    })
    if (!table || table.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Table not found' })
    }

    // Only the assigned waiter (or a supervisor/manager) may release
    if (table.assignedWaiterId && table.assignedWaiterId !== staffId) {
      const caller = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { role: true },
      })
      if (caller?.role === 'WAITER') {
        return res.status(403).json({ error: 'Only the assigned waiter or a supervisor can release this table' })
      }
    }

    await prisma.table.update({
      where: { id: tableId },
      data: { assignedWaiterId: null },
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${cafeId}`).emit('table_released', { tableId })
    }

    return res.json({ success: true, tableId })
  } catch (err) {
    logger.error({ msg: 'release table error', err })
    return res.status(500).json({ error: 'Failed to release table' })
  }
})

export default router
