import { Server as SocketIOServer, Socket } from 'socket.io'
import logger from '../logger'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'

// ─── Room naming conventions ──────────────────────────────────────────────────
// Admin dashboard  : room_{cafeId}
// Kitchen Display  : kds_room_{cafeId}
// Customer table   : table_room_{cafeId}_{tableId}
// ─────────────────────────────────────────────────────────────────────────────

export function registerSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {

    // ── Admin / KDS authentication ──────────────────────────────────────────
    try {
      const raw =
        (socket.handshake?.auth as any)?.token ||
        (socket.handshake?.headers?.authorization as string | undefined)
      if (raw) {
        const token = (raw as string).startsWith('Bearer ') ? (raw as string).slice(7) : raw
        try {
          const payload = jwt.verify(token, JWT_SECRET) as any
          ;(socket as any).data = { ...(socket as any).data, admin: payload }
          logger.info({ msg: 'Socket authenticated', userId: payload.userId, cafeId: payload.cafeId })
        } catch (_) {
          logger.debug({ msg: 'Socket auth failed — guest connection' })
        }
      }
    } catch (e) {
      logger.error({ msg: 'Socket auth check error', err: e })
    }

    // ── join — admin/KDS room ───────────────────────────────────────────────
    socket.on('join', (room: string) => {
      try {
        if (typeof room !== 'string') return

        if (room.startsWith('room_') || room.startsWith('kds_room_')) {
          const parts = room.split('_')
          const cafeId = parts[parts.length - 1]
          const admin = (socket as any).data?.admin
          if (!admin || String(admin.cafeId) !== cafeId) {
            socket.emit('error', { message: 'Forbidden to join admin/KDS room' })
            return
          }
          socket.join(room)
          logger.debug({ msg: 'Admin/KDS joined room', room, socketId: socket.id })
          return
        }

        socket.emit('error', { message: 'Use join_table_room for customer rooms' })
      } catch (e) {
        logger.error({ msg: 'join event error', err: e, room })
      }
    })

    // ── join_table_room — customer device joins their seat room ─────────────
    socket.on('join_table_room', async (payload: { cafeId: string; tableId: string; seatToken: string }) => {
      try {
        const { cafeId, tableId, seatToken } = payload
        if (!cafeId || !tableId || !seatToken) return

        const seat = await prisma.seat.findFirst({
          where: { qrToken: seatToken, tableId, cafeId },
          select: { id: true, seatNumber: true }
        })

        if (!seat) {
          socket.emit('error', { message: 'Invalid seat token' })
          return
        }

        const room = `table_room_${cafeId}_${tableId}`
        socket.join(room)
        ;(socket as any).data = {
          ...(socket as any).data,
          cafeId,
          tableId,
          seatId: seat.id,
          seatNumber: seat.seatNumber
        }

        const table = await prisma.table.findUnique({
          where: { id: tableId },
          select: {
            tableNumber: true,
            mergedIntoTableId: true,
            mergedIntoTable: { select: { tableNumber: true } }
          }
        })

        if (table?.mergedIntoTableId) {
          socket.emit('TABLES_MERGED', {
            targetTableNumber: table.mergedIntoTable?.tableNumber,
            message: `You are now connected with the group at Table ${table.mergedIntoTable?.tableNumber}`
          })
        }

        logger.debug({ msg: 'Customer joined table room', room, seatNumber: seat.seatNumber })
      } catch (err) {
        logger.error({ msg: 'join_table_room error', err, payload })
      }
    })

    // ── request_bill ────────────────────────────────────────────────────────
    socket.on('request_bill', async (payload: { cafeId: string; tableId: string; message?: string }) => {
      try {
        const { cafeId, tableId, message } = payload
        if (!cafeId || !tableId) return

        const table = await prisma.table.findUnique({ where: { id: tableId }, select: { cafeId: true, tableNumber: true } })
        if (!table || table.cafeId !== cafeId) return

        const bill = await prisma.billRequest.create({ data: { cafeId, tableId, message: message || null } })
        io.to(`room_${cafeId}`).emit('bill_requested', {
          id: bill.id, tableId: bill.tableId, tableNumber: table.tableNumber, createdAt: bill.createdAt
        })
      } catch (err) {
        logger.error({ msg: 'request_bill error', err, payload })
      }
    })

    // ── waiter_call ──────────────────────────────────────────────────────────
    socket.on('waiter_call', async (payload: { cafeId: string; tableId: string; type: string; message?: string }) => {
      try {
        const { cafeId, tableId, type, message } = payload
        if (!cafeId || !tableId || !type) return

        const table = await prisma.table.findUnique({ where: { id: tableId }, select: { cafeId: true, tableNumber: true } })
        if (!table || table.cafeId !== cafeId) return

        const call = await prisma.waiterCall.create({
          data: { cafeId, tableId, type: type as any, message: message || null }
        })
        io.to(`room_${cafeId}`).emit('waiter_called', {
          id: call.id, tableId: call.tableId, tableNumber: table.tableNumber,
          type: call.type, message: call.message, createdAt: call.createdAt
        })
      } catch (err) {
        logger.error({ msg: 'waiter_call error', err, payload })
      }
    })

    // ── ack_call ─────────────────────────────────────────────────────────────
    socket.on('ack_call', async (payload: { cafeId: string; callId: string }) => {
      try {
        const { cafeId, callId } = payload
        if (!cafeId || !callId) return

        const call = await prisma.waiterCall.findUnique({ where: { id: callId } })
        if (!call || call.cafeId !== cafeId) return

        const updated = await prisma.waiterCall.update({
          where: { id: callId },
          data: { acknowledgedAt: new Date() }
        })

        const responseTimeMs = updated.acknowledgedAt
          ? updated.acknowledgedAt.getTime() - updated.createdAt.getTime()
          : null

        io.to(`room_${cafeId}`).emit('waiter_acknowledged', {
          id: updated.id, tableId: updated.tableId,
          acknowledgedAt: updated.acknowledgedAt, responseTimeMs
        })
      } catch (err) {
        logger.error({ msg: 'ack_call error', err, payload })
      }
    })

    // ── kds_ack_order — kitchen confirms order → PREPARING ───────────────────
    // Multi-tenancy guard: admin.cafeId must match the payload cafeId.
    socket.on('kds_ack_order', async (payload: { cafeId: string; orderId: string }) => {
      try {
        const { cafeId, orderId } = payload
        const admin = (socket as any).data?.admin
        if (!admin || String(admin.cafeId) !== cafeId) return

        const order = await prisma.order.findUnique({
          where: { id: orderId }, select: { cafeId: true, tableId: true, status: true }
        })
        // Double-check DB cafeId to prevent cross-tenant mutation via crafted payloads
        if (!order || order.cafeId !== cafeId || order.status !== 'PENDING') return

        await prisma.order.update({ where: { id: orderId }, data: { status: 'PREPARING' } })

        const update = { orderId, status: 'PREPARING', tableId: order.tableId }
        io.to(`room_${cafeId}`).emit('order_status_updated', update)
        io.to(`kds_room_${cafeId}`).emit('kds_order_updated', update)
        // Inform the customer so they see "your order is being prepared"
        if (order.tableId) {
          io.to(`table_room_${cafeId}_${order.tableId}`).emit('your_order_updated', update)
        }
      } catch (err) {
        logger.error({ msg: 'kds_ack_order error', err, payload })
      }
    })

    // ── kds_ready — kitchen marks order ready → DELIVERED ───────────────────
    // Multi-tenancy guard: admin.cafeId must match payload cafeId.
    // Emits waiter_order_ready so the POS waiter UI can alert with beep/flash.
    socket.on('kds_ready', async (payload: { cafeId: string; orderId: string }) => {
      try {
        const { cafeId, orderId } = payload
        const admin = (socket as any).data?.admin
        if (!admin || String(admin.cafeId) !== cafeId) return

        const order = await prisma.order.findUnique({
          where: { id: orderId }, select: { cafeId: true, tableId: true, status: true }
        })
        // Double-check DB cafeId to prevent cross-tenant mutation via crafted payloads
        if (!order || order.cafeId !== cafeId || order.status !== 'PREPARING') return

        await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } })

        const update = { orderId, status: 'DELIVERED', tableId: order.tableId }
        io.to(`room_${cafeId}`).emit('order_status_updated', update)
        io.to(`kds_room_${cafeId}`).emit('kds_order_updated', update)
        // Inform the customer their order is ready
        if (order.tableId) {
          io.to(`table_room_${cafeId}_${order.tableId}`).emit('your_order_updated', update)
        }
        // Dedicated event for the waiter POS to trigger audio/visual alert
        io.to(`room_${cafeId}`).emit('waiter_order_ready', {
          orderId,
          tableId: order.tableId
        })
      } catch (err) {
        logger.error({ msg: 'kds_ready error', err, payload })
      }
    })

    socket.on('disconnect', (reason) => {
      logger.debug({ msg: 'Socket disconnected', socketId: socket.id, reason })
    })
  })
}
