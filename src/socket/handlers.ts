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

    // ── join_menu_room — customer device joins cafe-wide menu broadcast room ─
    // Used to receive live price_updated events without exposing admin rooms.
    socket.on('join_menu_room', async (payload: { cafeId: string; tableToken: string }) => {
      try {
        const { cafeId, tableToken } = payload
        if (!cafeId || !tableToken) return

        const table = await prisma.table.findFirst({
          where: { qrToken: tableToken, cafeId, isActive: true },
          select: { id: true }
        })
        if (!table) {
          socket.emit('error', { message: 'Invalid table token for menu room' })
          return
        }

        const room = `menu_room_${cafeId}`
        socket.join(room)
        logger.debug({ msg: 'Customer joined menu room', room, socketId: socket.id })
      } catch (err) {
        logger.error({ msg: 'join_menu_room error', err, payload })
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

    // ── join_session_room — dynamic QR customer joins via sessionId ─────────
    // Used by /[subdomain]/t/[tableNumber] (new single-QR-per-table flow).
    // Validates sessionId against DB then joins the correct table_room.
    // Also auto-joins the master table room if the table is merged.
    socket.on('join_session_room', async (payload: { sessionId: string }) => {
      try {
        const { sessionId } = payload
        if (!sessionId) return

        const now     = new Date()
        const session = await prisma.clientSession.findUnique({
          where:  { id: sessionId },
          select: {
            id:         true,
            cafeId:     true,
            tableId:    true,
            seatNumber: true,
            status:     true,
            expiresAt:  true,
            table: {
              select: {
                tableNumber:       true,
                mergedIntoTableId: true,
                mergedIntoTable:   { select: { tableNumber: true } }
              }
            }
          }
        })

        if (!session || session.status !== 'active' || session.expiresAt <= now) {
          socket.emit('error', { message: 'Session expired' })
          return
        }

        const physicalRoom = `table_room_${session.cafeId}_${session.tableId}`
        socket.join(physicalRoom)

        // If the table is merged, also join the master room so order updates arrive
        if (session.table.mergedIntoTableId) {
          const masterRoom = `table_room_${session.cafeId}_${session.table.mergedIntoTableId}`
          socket.join(masterRoom)
          socket.emit('TABLES_MERGED', {
            targetTableId:     session.table.mergedIntoTableId,
            targetTableNumber: session.table.mergedIntoTable?.tableNumber,
            message: `You are now connected with the group at Table ${session.table.mergedIntoTable?.tableNumber}`
          })
        }

        ;(socket as any).data = {
          ...(socket as any).data,
          cafeId:     session.cafeId,
          tableId:    session.tableId,
          sessionId:  session.id,
          seatNumber: session.seatNumber
        }

        logger.debug({ msg: 'Dynamic QR customer joined session room', physicalRoom, sessionId })
      } catch (err) {
        logger.error({ msg: 'join_session_room error', err, payload })
      }
    })

    // ── join_zone_session_room — ActiveSession customer joins their dedicated room
    // Room: zone_session_room_{cafeId}_{activeSessionId}
    // Scoped per-session so flash events reach exactly one device.
    socket.on('join_zone_session_room', async (payload: { activeSessionId: string }) => {
      try {
        const { activeSessionId } = payload
        if (!activeSessionId) return

        const session = await prisma.activeSession.findUnique({
          where:  { id: activeSessionId },
          select: { id: true, cafeId: true, zoneId: true, status: true }
        })

        if (!session || session.status === 'PAID') {
          socket.emit('error', { message: 'Session not found or already closed' })
          return
        }

        const room = `zone_session_room_${session.cafeId}_${session.id}`
        socket.join(room)
        ;(socket as any).data = {
          ...(socket as any).data,
          cafeId:          session.cafeId,
          activeSessionId: session.id,
          zoneId:          session.zoneId
        }

        logger.debug({ msg: 'Zone-session customer joined room', room, activeSessionId })
      } catch (err) {
        logger.error({ msg: 'join_zone_session_room error', err, payload })
      }
    })

    // ── waiter_mark_served — waiter marks zone-session order as delivered ──────
    // Transitions order READY → DELIVERED, dismisses client flash overlay.
    // Guard: admin JWT required (waiter tablet is authenticated).
    socket.on('waiter_mark_served', async (payload: {
      cafeId:          string
      orderId:         string
      activeSessionId: string
    }) => {
      try {
        const { cafeId, orderId, activeSessionId } = payload
        const admin = (socket as any).data?.admin
        if (!admin || String(admin.cafeId) !== cafeId) return

        const order = await prisma.order.findUnique({
          where:  { id: orderId },
          select: {
            cafeId:          true,
            status:          true,
            activeSessionId: true,
            activeSession: {
              select: { id: true, tokenNumber: true, zoneId: true, zone: { select: { name: true } } }
            }
          }
        })

        if (!order || order.cafeId !== cafeId) return
        if (order.status !== 'READY') {
          socket.emit('error', { message: 'Order must be in READY status to mark as served' })
          return
        }

        await prisma.order.update({
          where: { id: orderId },
          data:  { status: 'DELIVERED', preparedAt: new Date() }
        })

        const broadcastPayload = { orderId, status: 'DELIVERED', activeSessionId }

        // Notify admin/waiter dashboard
        io.to(`room_${cafeId}`).emit('order_status_updated', broadcastPayload)
        io.to(`kds_room_${cafeId}`).emit('kds_order_updated', broadcastPayload)

        // Tell the specific client device to dismiss the flash overlay
        const clientRoom = `zone_session_room_${cafeId}_${activeSessionId}`
        io.to(clientRoom).emit('flash_dismiss', { orderId })

        logger.info({ msg: 'Waiter marked as served', orderId, activeSessionId, cafeId })
      } catch (err) {
        logger.error({ msg: 'waiter_mark_served error', err, payload })
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

    // ── kds_ready — kitchen marks order ready ────────────────────────────────
    // Normal table orders:  PREPARING → DELIVERED  (existing flow unchanged)
    // Zone / ActiveSession: PREPARING → READY + flash signal to client device
    // Multi-tenancy guard: admin.cafeId must match payload cafeId.
    socket.on('kds_ready', async (payload: { cafeId: string; orderId: string }) => {
      try {
        const { cafeId, orderId } = payload
        const admin = (socket as any).data?.admin
        if (!admin || String(admin.cafeId) !== cafeId) return

        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            cafeId:          true,
            tableId:         true,
            status:          true,
            activeSessionId: true,
            activeSession: {
              select: {
                id:          true,
                tokenNumber: true,
                zone:        { select: { id: true, name: true } }
              }
            }
          }
        })
        if (!order || order.cafeId !== cafeId || order.status !== 'PREPARING') return

        // ── Zone / Match Mode order — stop at READY, trigger flash signal ──
        if (order.activeSession) {
          await prisma.order.update({ where: { id: orderId }, data: { status: 'READY', preparedAt: new Date() } })

          const update = { orderId, status: 'READY', activeSessionId: order.activeSession.id }
          io.to(`room_${cafeId}`).emit('order_status_updated', update)
          io.to(`kds_room_${cafeId}`).emit('kds_order_updated', update)

          // Flash signal to the specific customer device
          const clientRoom = `zone_session_room_${cafeId}_${order.activeSession.id}`
          io.to(clientRoom).emit('ready_for_service', {
            orderId,
            tokenNumber: order.activeSession.tokenNumber,
            zoneName:    order.activeSession.zone?.name ?? ''
          })

          // Alert waiter dashboard: this token needs service
          io.to(`room_${cafeId}`).emit('zone_token_ready', {
            orderId,
            activeSessionId: order.activeSession.id,
            tokenNumber:     order.activeSession.tokenNumber,
            zoneName:        order.activeSession.zone?.name ?? '',
            zoneId:          order.activeSession.zone?.id   ?? ''
          })

          logger.info({ msg: 'Zone order ready — flash signal emitted', orderId, activeSessionId: order.activeSession.id })
          return
        }

        // ── Normal table order — existing flow: PREPARING → DELIVERED ────────
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
