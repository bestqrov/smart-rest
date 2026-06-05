import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// POST /api/bill-requests
// Legacy QR:  { tableToken, message?, seatNumbers?, payScope? }
// Dynamic QR: { sessionId,  message?, seatNumbers?, payScope? }
// payScope: 'TABLE' | 'SEATS' — TABLE = everyone, SEATS = only listed seat numbers
router.post('/api/bill-requests', async (req: Request, res: Response) => {
  try {
    const {
      tableToken,
      sessionId,
      message,
      seatNumbers,
      payScope,
    } = req.body as {
      tableToken?:  string
      sessionId?:   string
      message?:     string
      seatNumbers?: number[]
      payScope?:    string
    }

    if (!tableToken && !sessionId) {
      return res.status(400).json({ error: 'tableToken or sessionId is required' })
    }

    let cafeId:      string
    let tableId:     string
    let tableNumber: number

    if (sessionId) {
      // Dynamic QR path — derive IDs from the session
      const now     = new Date()
      const session = await prisma.clientSession.findUnique({
        where:  { id: sessionId },
        select: { id: true, cafeId: true, tableId: true, status: true, expiresAt: true,
                  table: { select: { tableNumber: true, isActive: true } } }
      })
      if (!session || session.status !== 'active' || session.expiresAt <= now) {
        return res.status(404).json({ error: 'Invalid or expired session' })
      }
      if (!session.table.isActive) {
        return res.status(403).json({ error: 'Table is inactive' })
      }
      cafeId      = session.cafeId
      tableId     = session.tableId
      tableNumber = session.table.tableNumber
    } else {
      // Legacy QR path — derive IDs from the table token
      const table = await prisma.table.findUnique({ where: { qrToken: tableToken! } })
      if (!table || !table.isActive) {
        return res.status(404).json({ error: 'Invalid or inactive table token' })
      }
      cafeId      = table.cafeId
      tableId     = table.id
      tableNumber = table.tableNumber
    }

    // Validate seatNumbers if provided
    const seats: number[] = Array.isArray(seatNumbers)
      ? seatNumbers.filter((n) => Number.isInteger(n) && n > 0)
      : []

    const scope = payScope === 'SEATS' && seats.length > 0 ? 'SEATS' : 'TABLE'

    const bill = await prisma.billRequest.create({
      data: {
        cafeId,
        tableId,
        message:     message || null,
        seatNumbers: seats,
        payScope:    scope,
      }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      io.to(`room_${cafeId}`).emit('bill_requested', {
        id:          bill.id,
        tableId:     bill.tableId,
        tableNumber,
        seatNumbers: seats,
        payScope:    scope,
        message:     message || null,
        createdAt:   bill.createdAt,
      })
    }

    return res.status(201).json({
      id:          bill.id,
      tableId:     bill.tableId,
      seatNumbers: seats,
      payScope:    scope,
      createdAt:   bill.createdAt,
    })
  } catch (err) {
    logger.error({ msg: 'Bill request error', err })
    return res.status(500).json({ error: 'Failed to create bill request' })
  }
})

export default router
