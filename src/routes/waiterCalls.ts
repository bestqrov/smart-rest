import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

const VALID_TYPES = ['WATER', 'CLEAN', 'QUESTION'] as const
type CallType = typeof VALID_TYPES[number]

// POST /api/waiter-calls
// body: { tableToken, type, message? }
router.post('/api/waiter-calls', async (req: Request, res: Response) => {
  try {
    const { tableToken, type, message } = req.body as {
      tableToken: string
      type: string
      message?: string
    }

    if (!tableToken || !type) {
      return res.status(400).json({ error: 'tableToken and type are required' })
    }

    if (!VALID_TYPES.includes(type as CallType)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` })
    }

    // Derive cafeId and tableId from secure token
    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || !table.isActive) {
      return res.status(404).json({ error: 'Invalid or inactive table token' })
    }

    const call = await prisma.waiterCall.create({
      data: {
        cafeId: table.cafeId,
        tableId: table.id,
        type: type as CallType,
        message: message || null
      }
    })

    // Notify admin room via socket
    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${table.cafeId}`).emit('waiter_called', {
        id: call.id,
        tableId: call.tableId,
        tableNumber: table.tableNumber,
        type: call.type,
        message: call.message,
        createdAt: call.createdAt
      })
    }

    return res.status(201).json({ id: call.id, tableId: call.tableId, type: call.type, createdAt: call.createdAt })
  } catch (err) {
    logger.error({ msg: 'Waiter call error', err })
    return res.status(500).json({ error: 'Failed to create waiter call' })
  }
})

export default router
