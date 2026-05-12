import express, { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'

const prisma = new PrismaClient()
const router = express.Router()

// POST /api/bill-requests
// body: { cafeId, tableId, message? }
router.post('/api/bill-requests', async (req: Request, res: Response) => {
  try {
    const { cafeId, tableId, message } = req.body as {
      cafeId: number
      tableId: number
      message?: string
    }

    if (!cafeId || !tableId) return res.status(400).json({ error: 'cafeId and tableId are required' })

    // Validate cafe & table
    const table = await prisma.table.findUnique({ where: { id: tableId } })
    if (!table || table.cafeId !== cafeId) return res.status(404).json({ error: 'Table not found for cafe' })

    const bill = await prisma.billRequest.create({
      data: { cafeId, tableId, message: message || null }
    })

    // Emit to admin room
    const io = (req.app.get('io') || (req.app.locals && (req.app.locals.io as SocketIOServer))) as
      | SocketIOServer
      | undefined

    if (io) {
      io.to(`room_${cafeId}`).emit('bill_requested', { id: bill.id, tableId: bill.tableId, createdAt: bill.createdAt })
    }

    return res.status(201).json({ id: bill.id, tableId: bill.tableId, createdAt: bill.createdAt })
  } catch (err) {
    logger.error({ msg: 'Bill request error', err })
    return res.status(500).json({ error: 'Failed to create bill request' })
  }
})

export default router
