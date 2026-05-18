import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// POST /api/bill-requests
// body: { tableToken, message? }
router.post('/api/bill-requests', async (req: Request, res: Response) => {
  try {
    const { tableToken, message } = req.body as {
      tableToken: string
      message?: string
    }

    if (!tableToken) return res.status(400).json({ error: 'tableToken is required' })

    // Derive cafeId and tableId from the secure token — never trust client-supplied IDs
    const table = await prisma.table.findUnique({ where: { qrToken: tableToken } })
    if (!table || !table.isActive) {
      return res.status(404).json({ error: 'Invalid or inactive table token' })
    }

    const bill = await prisma.billRequest.create({
      data: { cafeId: table.cafeId, tableId: table.id, message: message || null }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${table.cafeId}`).emit('bill_requested', {
        id: bill.id,
        tableId: bill.tableId,
        tableNumber: table.tableNumber,
        createdAt: bill.createdAt
      })
    }

    return res.status(201).json({ id: bill.id, tableId: bill.tableId, createdAt: bill.createdAt })
  } catch (err) {
    logger.error({ msg: 'Bill request error', err })
    return res.status(500).json({ error: 'Failed to create bill request' })
  }
})

export default router
