import { Server as SocketIOServer, Socket } from 'socket.io'
import logger from '../logger'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'

export function registerSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    // try to authenticate socket (admin users)
    try {
      const token = (socket.handshake && (socket.handshake as any).auth && (socket.handshake as any).auth.token) || (socket.handshake.headers && (socket.handshake.headers.authorization as string))
      if (token) {
        let raw = token as string
        if (raw.startsWith('Bearer ')) raw = raw.slice(7)
        try {
          const payload = jwt.verify(raw, JWT_SECRET) as any
          ;(socket as any).data = (socket as any).data || {}
          ;(socket as any).data.admin = payload
          logger.info({ msg: 'Socket authenticated', userId: payload.userId, cafeId: payload.cafeId })
        } catch (e) {
          logger.debug({ msg: 'Socket auth failed', err: e })
        }
      }
    } catch (e) {
      logger.error({ msg: 'Socket auth check error', err: e })
    }
    // join room event - restrict admin rooms to authenticated admin sockets
    socket.on('join', (room: string) => {
      try {
        if (typeof room === 'string' && room.startsWith('room_')) {
          // parse cafeId
          const parts = room.split('_')
          const cafeId = Number(parts[1])
          const admin = (socket as any).data?.admin
          if (!admin || Number(admin.cafeId) !== cafeId) {
            socket.emit('error', { message: 'Forbidden to join admin room' })
            return
          }
        }
        socket.join(room)
      } catch (e) {
        logger.error({ msg: 'Join room error', err: e, room })
      }
    })

    // client requests bill via socket
    socket.on('request_bill', async (payload: { cafeId: number; tableId: number; message?: string }) => {
      try {
        const { cafeId, tableId, message } = payload
        if (!cafeId || !tableId) return

        // validate table belongs to cafe
        const table = await prisma.table.findUnique({ where: { id: tableId } })
        if (!table || table.cafeId !== cafeId) return

        const bill = await prisma.billRequest.create({ data: { cafeId, tableId, message: message || null } })

        // notify admin room
        io.to(`room_${cafeId}`).emit('bill_requested', { id: bill.id, tableId: bill.tableId, createdAt: bill.createdAt })
      } catch (err) {
        logger.error({ msg: 'request_bill handler error', err, payload })
      }
    })

    // client calls waiter
    socket.on('waiter_call', async (payload: { cafeId: number; tableId: number; type: string; message?: string }) => {
      try {
        const { cafeId, tableId, type, message } = payload
        if (!cafeId || !tableId || !type) return

        const table = await prisma.table.findUnique({ where: { id: tableId } })
        if (!table || table.cafeId !== cafeId) return

        const call = await prisma.waiterCall.create({ data: { cafeId, tableId, type: type as any, message: message || null } })

        io.to(`room_${cafeId}`).emit('waiter_called', { id: call.id, tableId: call.tableId, type: call.type, message: call.message, createdAt: call.createdAt })
      } catch (err) {
        logger.error({ msg: 'waiter_call handler error', err, payload })
      }
    })

    // waiter acknowledges a call (e.g., clicks 'Coming')
    socket.on('ack_call', async (payload: { cafeId: number; callId: number }) => {
      try {
        const { cafeId, callId } = payload
        if (!cafeId || !callId) return

        const call = await prisma.waiterCall.findUnique({ where: { id: callId } })
        if (!call || call.cafeId !== cafeId) return

        const now = new Date()
        const updated = await prisma.waiterCall.update({ where: { id: callId }, data: { acknowledgedAt: now } })

        const responseTimeMs = updated.acknowledgedAt
          ? new Date(updated.acknowledgedAt).getTime() - new Date(updated.createdAt).getTime()
          : null

        io.to(`room_${cafeId}`).emit('waiter_acknowledged', {
          id: updated.id,
          tableId: updated.tableId,
          acknowledgedAt: updated.acknowledgedAt,
          responseTimeMs
        })
      } catch (err) {
        logger.error({ msg: 'ack_call handler error', err, payload })
      }
    })

    socket.on('disconnect', (reason) => {
      logger.debug({ msg: 'Socket disconnected', socketId: socket.id, reason })
    })
  })
}
